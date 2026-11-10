import type { Server as HttpServer } from 'node:http';
import { parse as parseCookie } from 'cookie';
import { Server, type Socket } from 'socket.io';
import { z } from 'zod';
import { allowedOrigins, clientOrigins } from '../config/env';
import { AppError, tooMany } from '../lib/errors';
import { parse } from '../lib/http';
import { logs } from '../lib/logger';
import { prisma } from '../lib/prisma';
import { parseNotif } from '../lib/settings';
import { idSchema } from '../lib/validation';
import { SESSION_COOKIE, validateSession } from '../modules/auth/session.service';
import * as chats from '../modules/chats/chats.service';
import { notify } from '../modules/notifications/notifications.service';
import { addSocket, emitToUser, emitToUsers, isOnline, removeSocket, setIo } from './hub';
import { broadcastPresence } from './presence';

// ── Лимиты на события (token bucket на пользователя) ────────
const buckets = new Map<string, { tokens: number; last: number }>();
function allow(userId: string, cost: number) {
  const now = Date.now();
  const b = buckets.get(userId) ?? { tokens: 30, last: now };
  b.tokens = Math.min(30, b.tokens + ((now - b.last) / 1000) * 8);
  b.last = now;
  if (b.tokens < cost) {
    buckets.set(userId, b);
    return false;
  }
  b.tokens -= cost;
  buckets.set(userId, b);
  return true;
}
setInterval(() => {
  const old = Date.now() - 120_000;
  for (const [k, v] of buckets) if (v.last < old) buckets.delete(k);
}, 60_000).unref();

const memberCache = new Map<string, { ids: string[]; exp: number }>();
async function cachedMembers(chatId: string) {
  const hit = memberCache.get(chatId);
  if (hit && hit.exp > Date.now()) return hit.ids;
  const ids = await chats.memberIdsOf(chatId);
  memberCache.set(chatId, { ids, exp: Date.now() + 20_000 });
  if (memberCache.size > 2000) memberCache.clear();
  return ids;
}

type Ack = (res: Record<string, unknown>) => void;

function handle<S extends z.ZodTypeAny>(
  socket: Socket,
  event: string,
  schema: S,
  fn: (data: z.infer<S>, userId: string) => Promise<Record<string, unknown> | void>,
  cost = 1,
) {
  const userId = socket.data.userId as string;
  socket.on(event, async (raw: unknown, ack?: Ack) => {
    const reply: Ack = typeof ack === 'function' ? ack : () => {};
    try {
      if (!allow(userId, cost)) throw tooMany('Слишком много действий. Помедленнее.');
      const out = await fn(parse(schema, raw), userId);
      reply({ ok: true, ...(out ?? {}) });
    } catch (e) {
      if (e instanceof AppError) reply({ ok: false, error: { code: e.code, message: e.message } });
      else {
        logs.errors.error({ event: 'ws_handler_error', wsEvent: event, userId, err: e }, 'WebSocket handler error');
        reply({ ok: false, error: { code: 'INTERNAL', message: 'Внутренняя ошибка сервера' } });
      }
    }
  });
}

async function markDelivered(userId: string) {
  const now = new Date();
  const rows = await prisma.$queryRaw<{ chatId: string }[]>`
    UPDATE "ChatMember" cm SET "lastDeliveredAt" = ${now}
    FROM "Chat" c
    WHERE cm."chatId" = c.id AND cm."userId" = ${userId} AND cm."lastDeliveredAt" < c."lastMessageAt"
    RETURNING cm."chatId"`;
  for (const { chatId } of rows) {
    emitToUsers(await chats.memberIdsOf(chatId), 'chat:delivered', { chatId, userIds: [userId], at: now });
  }
}

const MENTION_RE = /(?<![\w@])@([a-z0-9_]{3,24})/gi;

async function pushMessageNotifications(
  r: Awaited<ReturnType<typeof chats.sendMessage>>,
  senderId: string,
  senderName: string,
) {
  const recipients = r.memberIds.filter((id) => id !== senderId);
  if (recipients.length === 0) return;
  const users = await prisma.user.findMany({ where: { id: { in: recipients } }, select: { id: true, username: true, notifSettings: true, activity: true } });
  const m = r.message;
  const preview = m.text ? m.text.slice(0, 120) : m.attachments.length ? 'Вложение' : '';
  const mentioned = new Set<string>();
  if (r.chatType === 'GROUP') for (const x of m.text.matchAll(MENTION_RE)) mentioned.add(x[1].toLowerCase());
  for (const u of users) {
    if (mentioned.has(u.username)) {
      await notify(u.id, 'MENTION', {
        title: `${senderName} упомянул(а) вас в «${r.chatTitle ?? 'группе'}»`,
        body: preview,
        data: { chatId: m.chatId, messageId: m.id },
      }).catch((err) => logs.errors.error({ event: 'notify_failed', err }, 'Notify failed'));
    }
    if (parseNotif(u.notifSettings).categories.message) {
      emitToUser(u.id, 'notification:message', {
        chatId: m.chatId,
        messageId: m.id,
        from: senderName,
        chatTitle: r.chatType === 'GROUP' ? r.chatTitle : null,
        preview,
        silent: u.activity === 'DND',
      });
    }
  }
}

export function initSocket(server: HttpServer) {
  const io = new Server(server, {
    cors: { origin: clientOrigins, credentials: true },
    // WebSocket не подчиняется CORS, поэтому Origin проверяем вручную (защита от Cross-Site WebSocket Hijacking)
    allowRequest: (req, cb) => {
      const o = req.headers.origin;
      cb(null, !o || allowedOrigins.has(o));
    },
    maxHttpBufferSize: 64 * 1024,
    serveClient: false,
  });
  setIo(io);

  io.use(async (socket, next) => {
    try {
      const token = parseCookie(socket.handshake.headers.cookie ?? '')[SESSION_COOKIE];
      const session = token ? await validateSession(token) : null;
      if (!session) return next(new Error('unauthorized'));
      socket.data.userId = session.userId;
      socket.data.sessionId = session.id;
      next();
    } catch (err) {
      logs.errors.error({ event: 'ws_auth_error', err }, 'WebSocket auth error');
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.data.userId as string;
    socket.join([`user:${userId}`, `session:${socket.data.sessionId as string}`]);
    const first = addSocket(userId, socket.id);
    logs.app.debug({ event: 'ws_connect', userId, first }, 'Socket connected');

    if (first) {
      prisma.user
        .update({ where: { id: userId }, data: { lastSeenAt: new Date() } })
        .then(() => Promise.all([markDelivered(userId), broadcastPresence(userId)]))
        .catch((err) => logs.errors.error({ event: 'ws_connect_failed', err }, 'Socket connect hook failed'));
    }

    socket.on('disconnect', () => {
      if (!removeSocket(userId, socket.id)) return;
      prisma.user
        .update({ where: { id: userId }, data: { lastSeenAt: new Date() } })
        .then(() => broadcastPresence(userId))
        .catch((err) => logs.errors.error({ event: 'ws_disconnect_failed', err }, 'Socket disconnect hook failed'));
    });

    handle(socket, 'message:send', z.object({
      chatId: idSchema,
      text: z.string().max(4000).default(''),
      replyToId: idSchema.optional(),
      attachmentIds: z.array(idSchema).max(5).optional(),
    }), async (d, uid) => {
      const r = await chats.sendMessage(uid, d);
      emitToUsers(r.memberIds, 'message:new', r.message);
      const online = r.memberIds.filter((id) => id !== uid && isOnline(id));
      if (online.length) {
        const at = new Date();
        await prisma.chatMember.updateMany({ where: { chatId: d.chatId, userId: { in: online } }, data: { lastDeliveredAt: at } });
        emitToUsers(r.memberIds, 'chat:delivered', { chatId: d.chatId, userIds: online, at });
      }
      if (r.chatType === 'DIRECT') emitToUsers(r.memberIds, 'chats:changed'); // у собеседника появляется новый диалог
      pushMessageNotifications(r, uid, r.message.sender.displayName).catch((err) => logs.errors.error({ event: 'push_notifications_failed', err }, 'Push notifications failed'));
      return { message: r.message };
    });

    handle(socket, 'message:edit', z.object({ id: idSchema, text: z.string().max(4000) }), async (d, uid) => {
      const r = await chats.editMessage(uid, d.id, d.text);
      emitToUsers(r.memberIds, 'message:updated', r.message);
      return { message: r.message };
    });

    handle(socket, 'message:delete', z.object({ id: idSchema }), async (d, uid) => {
      const r = await chats.deleteMessage(uid, d.id);
      emitToUsers(r.memberIds, 'message:deleted', { chatId: r.chatId, messageId: r.messageId });
    });

    handle(socket, 'message:react', z.object({ id: idSchema, emoji: z.string().min(1).max(16) }), async (d, uid) => {
      const r = await chats.toggleReaction(uid, d.id, d.emoji);
      emitToUsers(r.memberIds, 'message:reactions', { chatId: r.chatId, messageId: r.messageId, reactions: r.reactions });
    });

    handle(socket, 'message:pin', z.object({ id: idSchema, pinned: z.boolean() }), async (d, uid) => {
      const r = await chats.setPinned(uid, d.id, d.pinned);
      emitToUsers(r.memberIds, 'message:pinned', { chatId: r.chatId, messageId: r.messageId, pinned: r.pinned });
    });

    handle(socket, 'chat:read', z.object({ chatId: idSchema }), async (d, uid) => {
      const r = await chats.markRead(uid, d.chatId);
      emitToUsers(r.memberIds, 'chat:read', { chatId: d.chatId, userId: uid, at: r.at });
    }, 0.5);

    handle(socket, 'typing', z.object({ chatId: idSchema, typing: z.boolean() }), async (d, uid) => {
      const ids = await cachedMembers(d.chatId);
      if (!ids.includes(uid)) return;
      emitToUsers(ids.filter((id) => id !== uid), 'typing', { chatId: d.chatId, userId: uid, typing: d.typing });
    }, 0.3);
  });

  return io;
}
