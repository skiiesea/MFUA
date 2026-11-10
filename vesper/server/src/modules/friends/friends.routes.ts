import { Router } from 'express';
import { z } from 'zod';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors';
import { ah, ipOf, parse } from '../../lib/http';
import { logs } from '../../lib/logger';
import { prisma } from '../../lib/prisma';
import { blockedPairIds, friendIdsOf } from '../../lib/relations';
import { cardSelect, toCard } from '../../lib/serialize';
import { idSchema } from '../../lib/validation';
import { requireAuth } from '../../middleware/auth';
import { limiter } from '../../middleware/rateLimit';
import { emitToUsers } from '../../realtime/hub';
import { notify } from '../notifications/notifications.service';

export const friendsRouter = Router();
friendsRouter.use(requireAuth);
const requestLimiter = limiter('friend-requests', 10 * 60_000, 30);
const changed = (...ids: string[]) => emitToUsers(ids, 'friends:changed');

friendsRouter.get('/', ah(async (req, res) => {
  const me = req.auth!.user.id;
  const [rows, blocks, friends] = await Promise.all([
    prisma.friendship.findMany({
      where: { OR: [{ requesterId: me }, { addresseeId: me }] },
      include: { requester: { select: cardSelect }, addressee: { select: cardSelect } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.block.findMany({ where: { blockerId: me }, include: { blocked: { select: cardSelect } }, orderBy: { createdAt: 'desc' } }),
    friendIdsOf(me),
  ]);
  const other = (f: (typeof rows)[number]) => (f.requesterId === me ? f.addressee : f.requester);
  res.json({
    friends: rows.filter((f) => f.status === 'ACCEPTED').map((f) => ({ friendshipId: f.id, since: f.acceptedAt ?? f.createdAt, user: toCard(other(f), me, friends) })),
    incoming: rows.filter((f) => f.status === 'PENDING' && f.addresseeId === me).map((f) => ({ id: f.id, createdAt: f.createdAt, user: toCard(f.requester, me, friends) })),
    outgoing: rows.filter((f) => f.status === 'PENDING' && f.requesterId === me).map((f) => ({ id: f.id, createdAt: f.createdAt, user: toCard(f.addressee, me, friends) })),
    blocked: blocks.map((b) => ({ createdAt: b.createdAt, user: toCard(b.blocked, me, friends) })),
  });
}));

friendsRouter.post('/requests', requestLimiter, ah(async (req, res) => {
  const me = req.auth!.user;
  const { userId } = parse(z.object({ userId: idSchema }), req.body);
  if (userId === me.id) throw badRequest('Нельзя добавить в друзья самого себя');
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target || target.bannedAt) throw notFound('Пользователь не найден');
  if ((await blockedPairIds(me.id)).has(userId)) throw forbidden('Вы не можете отправить заявку этому пользователю');
  const existing = await prisma.friendship.findFirst({ where: { OR: [{ requesterId: me.id, addresseeId: userId }, { requesterId: userId, addresseeId: me.id }] } });
  if (existing) {
    if (existing.status === 'ACCEPTED') throw conflict('Вы уже друзья');
    if (existing.requesterId === me.id) throw conflict('Заявка уже отправлена');
    // встречная заявка — сразу принимаем
    await prisma.friendship.update({ where: { id: existing.id }, data: { status: 'ACCEPTED', acceptedAt: new Date() } });
    await notify(userId, 'FRIEND_ACCEPTED', { title: `${me.displayName} принял(а) вашу заявку`, data: { userId: me.id, username: me.username } });
    changed(me.id, userId);
    res.json({ status: 'FRIEND' });
    return;
  }
  if (target.privacyRequests === 'NOBODY') throw forbidden('Пользователь не принимает заявки в друзья');
  await prisma.friendship.create({ data: { requesterId: me.id, addresseeId: userId } });
  await notify(userId, 'FRIEND_REQUEST', { title: `${me.displayName} хочет добавить вас в друзья`, body: `@${me.username}`, data: { userId: me.id, username: me.username } });
  changed(me.id, userId);
  res.status(201).json({ status: 'OUTGOING' });
}));

friendsRouter.post('/requests/:id/accept', ah(async (req, res) => {
  const me = req.auth!.user;
  const f = await prisma.friendship.findFirst({ where: { id: req.params.id, addresseeId: me.id, status: 'PENDING' } });
  if (!f) throw notFound('Заявка не найдена');
  if ((await blockedPairIds(me.id)).has(f.requesterId)) throw forbidden('Невозможно принять заявку');
  await prisma.friendship.update({ where: { id: f.id }, data: { status: 'ACCEPTED', acceptedAt: new Date() } });
  await notify(f.requesterId, 'FRIEND_ACCEPTED', { title: `${me.displayName} принял(а) вашу заявку`, data: { userId: me.id, username: me.username } });
  changed(me.id, f.requesterId);
  res.json({ ok: true });
}));

// Отклонить входящую или отменить исходящую заявку
friendsRouter.delete('/requests/:id', ah(async (req, res) => {
  const me = req.auth!.user.id;
  const f = await prisma.friendship.findFirst({ where: { id: req.params.id, status: 'PENDING', OR: [{ requesterId: me }, { addresseeId: me }] } });
  if (!f) throw notFound('Заявка не найдена');
  await prisma.friendship.delete({ where: { id: f.id } });
  changed(f.requesterId, f.addresseeId);
  res.json({ ok: true });
}));

friendsRouter.delete('/:userId', ah(async (req, res) => {
  const me = req.auth!.user.id;
  const other = req.params.userId;
  await prisma.friendship.deleteMany({ where: { status: 'ACCEPTED', OR: [{ requesterId: me, addresseeId: other }, { requesterId: other, addresseeId: me }] } });
  changed(me, other);
  res.json({ ok: true });
}));

// ── Чёрный список ───────────────────────────────────────────
export const blocksRouter = Router();
blocksRouter.use(requireAuth);

blocksRouter.post('/', ah(async (req, res) => {
  const me = req.auth!.user.id;
  const { userId } = parse(z.object({ userId: idSchema }), req.body);
  if (userId === me) throw badRequest('Нельзя заблокировать самого себя');
  if (!(await prisma.user.findUnique({ where: { id: userId }, select: { id: true } }))) throw notFound('Пользователь не найден');
  await prisma.$transaction([
    prisma.block.upsert({ where: { blockerId_blockedId: { blockerId: me, blockedId: userId } }, create: { blockerId: me, blockedId: userId }, update: {} }),
    prisma.friendship.deleteMany({ where: { OR: [{ requesterId: me, addresseeId: userId }, { requesterId: userId, addresseeId: me }] } }),
  ]);
  logs.app.info({ event: 'user_blocked', userId: me, targetId: userId }, 'User blocked');
  changed(me, userId);
  emitToUsers([me, userId], 'chats:changed');
  res.json({ ok: true });
}));

blocksRouter.delete('/:userId', ah(async (req, res) => {
  const me = req.auth!.user.id;
  await prisma.block.deleteMany({ where: { blockerId: me, blockedId: req.params.userId } });
  changed(me, req.params.userId);
  emitToUsers([me, req.params.userId], 'chats:changed');
  res.json({ ok: true });
}));

// ── Жалобы ──────────────────────────────────────────────────
export const reportsRouter = Router();
reportsRouter.use(requireAuth);
const reportLimiter = limiter('reports', 60 * 60_000, 15);

reportsRouter.post('/', reportLimiter, ah(async (req, res) => {
  const me = req.auth!.user;
  const b = parse(
    z.object({
      userId: idSchema,
      messageId: idSchema.optional(),
      reason: z.enum(['SPAM', 'ABUSE', 'FAKE', 'ILLEGAL', 'OTHER']),
      details: z.string().trim().max(1000).optional(),
    }),
    req.body,
  );
  if (b.userId === me.id) throw badRequest('Нельзя пожаловаться на самого себя');
  if (!(await prisma.user.findUnique({ where: { id: b.userId }, select: { id: true } }))) throw notFound('Пользователь не найден');
  let snapshot: string | undefined;
  if (b.messageId) {
    // сообщение можно приложить только если пожаловавшийся состоит в этом чате
    const m = await prisma.message.findFirst({
      where: { id: b.messageId, senderId: b.userId, deletedAt: null, chat: { members: { some: { userId: me.id } } } },
      select: { text: true },
    });
    if (!m) throw notFound('Сообщение не найдено');
    snapshot = m.text.slice(0, 500);
  }
  await prisma.report.create({ data: { reporterId: me.id, targetId: b.userId, messageId: b.messageId, snapshot, reason: b.reason, details: b.details } });
  logs.security.info({ event: 'report_created', reporterId: me.id, targetId: b.userId, reason: b.reason, ip: ipOf(req) }, 'User report created');
  res.status(201).json({ ok: true });
}));
