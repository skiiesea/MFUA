import fs from 'node:fs/promises';
import path from 'node:path';
import { Router } from 'express';
import { z } from 'zod';
import { badRequest, forbidden, notFound } from '../../lib/errors';
import { ah, ipOf, parse } from '../../lib/http';
import { LOG_FILES, logDir, logs } from '../../lib/logger';
import { prisma } from '../../lib/prisma';
import { mediaUrl } from '../../lib/serialize';
import { requireAdmin, requireAuth, requireRootAdmin } from '../../middleware/auth';
import { onlineCount } from '../../realtime/hub';
import { revokeAllSessions } from '../auth/session.service';

export const adminRouter = Router();
adminRouter.use(requireAuth, requireAdmin);

adminRouter.get('/stats', ah(async (_req, res) => {
  const day = new Date(Date.now() - 24 * 3_600_000);
  const [users, verified, active24h, banned, messages, messages24h, chats, openReports] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { emailVerifiedAt: { not: null } } }),
    prisma.user.count({ where: { lastSeenAt: { gte: day } } }),
    prisma.user.count({ where: { bannedAt: { not: null } } }),
    prisma.message.count({ where: { deletedAt: null } }),
    prisma.message.count({ where: { deletedAt: null, createdAt: { gte: day } } }),
    prisma.chat.count(),
    prisma.report.count({ where: { status: 'OPEN' } }),
  ]);
  res.json({ users, verified, active24h, online: onlineCount(), banned, messages, messages24h, chats, openReports });
}));

adminRouter.get('/users', ah(async (req, res) => {
  const q = parse(z.object({ q: z.string().trim().max(60).optional(), page: z.coerce.number().int().min(1).default(1), filter: z.enum(['all', 'banned', 'admins']).default('all') }), req.query);
  const where = {
    ...(q.q ? { OR: [{ username: { contains: q.q.toLowerCase() } }, { displayName: { contains: q.q, mode: 'insensitive' as const } }, { email: { contains: q.q.toLowerCase() } }] } : {}),
    ...(q.filter === 'banned' ? { bannedAt: { not: null } } : q.filter === 'admins' ? { role: 'ADMIN' as const } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * 25, take: 25 }),
  ]);
  res.json({
    total,
    pageSize: 25,
    users: rows.map((u) => ({
      id: u.id, publicId: u.publicId, username: u.username, displayName: u.displayName, email: u.email, role: u.role,
      avatarUrl: mediaUrl(u.avatarKey), emailVerified: !!u.emailVerifiedAt, twoFactor: !!u.totpEnabledAt,
      banned: !!u.bannedAt, banReason: u.banReason, createdAt: u.createdAt, lastSeenAt: u.lastSeenAt,
    })),
  });
}));

adminRouter.post('/users/:id/ban', ah(async (req, res) => {
  const { reason } = parse(z.object({ reason: z.string().trim().min(3, 'Укажите причину').max(200) }), req.body);
  const target = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!target) throw notFound('Пользователь не найден');
  if (target.id === req.auth!.user.id) throw badRequest('Нельзя заблокировать самого себя');
  if (target.role === 'ADMIN') throw forbidden('Нельзя заблокировать администратора');
  await prisma.user.update({ where: { id: target.id }, data: { bannedAt: new Date(), banReason: reason } });
  await revokeAllSessions(target.id);
  logs.security.warn({ event: 'admin_ban', adminId: req.auth!.user.id, targetId: target.id, reason, ip: ipOf(req) }, 'User banned by admin');
  res.json({ ok: true });
}));

adminRouter.post('/users/:id/unban', ah(async (req, res) => {
  const target = await prisma.user.findUnique({ where: { id: req.params.id }, select: { id: true } });
  if (!target) throw notFound('Пользователь не найден');
  await prisma.user.update({ where: { id: target.id }, data: { bannedAt: null, banReason: null, failedLoginCount: 0, lockedUntil: null } });
  logs.security.info({ event: 'admin_unban', adminId: req.auth!.user.id, targetId: target.id, ip: ipOf(req) }, 'User unbanned by admin');
  res.json({ ok: true });
}));

adminRouter.get('/reports', ah(async (req, res) => {
  const { status } = parse(z.object({ status: z.enum(['OPEN', 'RESOLVED', 'DISMISSED', 'ALL']).default('OPEN') }), req.query);
  const rows = await prisma.report.findMany({
    where: status === 'ALL' ? {} : { status },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      reporter: { select: { id: true, username: true, displayName: true } },
      target: { select: { id: true, username: true, displayName: true, bannedAt: true } },
    },
  });
  res.json({
    reports: rows.map((r) => ({
      id: r.id, reason: r.reason, details: r.details, snapshot: r.snapshot, status: r.status, createdAt: r.createdAt, resolvedNote: r.resolvedNote,
      reporter: r.reporter, target: { id: r.target.id, username: r.target.username, displayName: r.target.displayName, banned: !!r.target.bannedAt },
    })),
  });
}));

adminRouter.post('/reports/:id/resolve', ah(async (req, res) => {
  const b = parse(z.object({ status: z.enum(['RESOLVED', 'DISMISSED']), note: z.string().trim().max(300).optional() }), req.body);
  const r = await prisma.report.findUnique({ where: { id: req.params.id } });
  if (!r) throw notFound('Жалоба не найдена');
  await prisma.report.update({ where: { id: r.id }, data: { status: b.status, resolvedNote: b.note, resolvedById: req.auth!.user.id, resolvedAt: new Date() } });
  logs.security.info({ event: 'admin_report_resolved', adminId: req.auth!.user.id, reportId: r.id, status: b.status }, 'Report processed');
  res.json({ ok: true });
}));

// ── Просмотр технических логов (только администратор) ───────
adminRouter.get('/logs', ah(async (req, res) => {
  const q = parse(
    z.object({
      file: z.enum(LOG_FILES).default('application'),
      level: z.enum(['ALL', 'DEBUG', 'INFO', 'WARN', 'ERROR']).default('ALL'),
      q: z.string().trim().max(80).optional(),
      limit: z.coerce.number().int().min(10).max(500).default(200),
    }),
    req.query,
  );
  const file = path.join(logDir, `${q.file}.log`);
  let text = '';
  try {
    const fh = await fs.open(file, 'r');
    try {
      const { size } = await fh.stat();
      const len = Math.min(size, 2 * 1024 * 1024);
      const buf = Buffer.alloc(len);
      await fh.read(buf, 0, len, size - len);
      text = buf.toString('utf8');
      if (size > len) text = text.slice(text.indexOf('\n') + 1);
    } finally {
      await fh.close();
    }
  } catch {
    /* файла ещё нет */
  }
  const needle = q.q?.toLowerCase();
  const entries: Record<string, unknown>[] = [];
  const lines = text.split('\n');
  for (let i = lines.length - 1; i >= 0 && entries.length < q.limit; i--) {
    const line = lines[i];
    if (!line) continue;
    if (needle && !line.toLowerCase().includes(needle)) continue;
    try {
      const e = JSON.parse(line) as Record<string, unknown>;
      if (q.level !== 'ALL' && e.level !== q.level) continue;
      entries.push(e);
    } catch {
      /* битая строка */
    }
  }
  res.json({ file: q.file, entries });
}));



// ── Расширенное управление владельца системы ─────────────────
const rootReason = z.string().trim().min(8, 'Укажите причину (не менее 8 символов)').max(300);
const rootProfileSchema = z.object({
  reason: rootReason,
  publicId: z.coerce.number().int().positive().max(2_000_000_000).optional(),
  username: z.string().trim().min(3).max(24).regex(/^[a-zA-Z0-9_]+$/).transform((v) => v.toLowerCase()).optional(),
  displayName: z.string().trim().min(1).max(40).optional(),
  email: z.string().trim().email().max(254).transform((v) => v.toLowerCase()).optional(),
  statusText: z.string().max(80).optional(),
  about: z.string().max(500).optional(),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  profileBg: z.string().max(80).nullable().optional(),
  activity: z.enum(['AUTO', 'DND', 'OFFLINE', 'WORK', 'FREE']).optional(),
  privacyMessages: z.enum(['EVERYONE', 'FRIENDS', 'NOBODY']).optional(),
  privacyRequests: z.enum(['EVERYONE', 'NOBODY']).optional(),
  privacyOnline: z.enum(['EVERYONE', 'FRIENDS', 'NOBODY']).optional(),
  privacyLastSeen: z.enum(['EVERYONE', 'FRIENDS', 'NOBODY']).optional(),
  privacyProfile: z.enum(['EVERYONE', 'FRIENDS', 'NOBODY']).optional(),
  role: z.enum(['USER', 'ADMIN']).optional(),
  emailVerified: z.boolean().optional(),
  banned: z.boolean().optional(),
  banReason: z.string().max(200).nullable().optional(),
}).refine((v) => Object.keys(v).some((k) => k !== 'reason'), 'Нет изменений');

async function writeRootAudit(actorId: string, targetId: string | null, action: string, reason: string, req: import('express').Request, metadata: Record<string, unknown> = {}) {
  await prisma.adminAuditLog.create({
    data: { actorId, targetId, action, reason, ip: ipOf(req), metadata: JSON.parse(JSON.stringify(metadata)) },
  });
}

adminRouter.get('/root/audit', requireRootAdmin, ah(async (req, res) => {
  const q = parse(z.object({ page: z.coerce.number().int().min(1).default(1), targetId: z.string().optional() }), req.query);
  const where = q.targetId ? { targetId: q.targetId } : {};
  const [total, rows] = await Promise.all([
    prisma.adminAuditLog.count({ where }),
    prisma.adminAuditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * 50, take: 50 }),
  ]);
  res.json({ total, logs: rows });
}));

adminRouter.patch('/root/users/:id', requireRootAdmin, ah(async (req, res) => {
  const b = parse(rootProfileSchema, req.body);
  const target = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!target) throw notFound('Пользователь не найден');
  if (target.id === req.auth!.user.id && b.banned === true) throw badRequest('Нельзя заблокировать собственный аккаунт');
  if (target.role === 'ROOT_ADMIN' && target.id !== req.auth!.user.id) throw forbidden('Нельзя изменять другой root_admin');
  if (b.publicId !== undefined && b.publicId !== target.publicId) {
    const collision = await prisma.user.findUnique({ where: { publicId: b.publicId }, select: { id: true } });
    if (collision && collision.id !== target.id) throw badRequest('Этот ID уже занят');
  }
  if (b.username && b.username !== target.username) {
    const collision = await prisma.user.findUnique({ where: { username: b.username }, select: { id: true } });
    if (collision && collision.id !== target.id) throw badRequest('Этот логин уже занят');
  }
  if (b.email && b.email !== target.email) {
    const collision = await prisma.user.findUnique({ where: { email: b.email }, select: { id: true } });
    if (collision && collision.id !== target.id) throw badRequest('Этот email уже используется');
  }

  const { reason, emailVerified, banned, banReason, ...fields } = b;
  const data: Record<string, unknown> = { ...fields };
  if (b.email && b.email !== target.email) {
    data.emailVerifiedAt = null;
    await prisma.emailToken.updateMany({ where: { userId: target.id, type: 'VERIFY', usedAt: null }, data: { usedAt: new Date() } });
  } else if (emailVerified !== undefined) {
    data.emailVerifiedAt = emailVerified ? (target.emailVerifiedAt ?? new Date()) : null;
  }
  if (b.banned !== undefined) {
    data.bannedAt = b.banned ? (target.bannedAt ?? new Date()) : null;
    data.banReason = b.banned ? (banReason ?? target.banReason ?? 'Решение администрации') : null;
  } else if (banReason !== undefined) {
    data.banReason = banReason;
  }

  const updated = await prisma.user.update({ where: { id: target.id }, data });
  if (b.banned === true || b.role === 'USER' && target.role === 'ADMIN') await revokeAllSessions(target.id);
  const changedFields = Object.keys(data).filter((k) => !['emailVerifiedAt', 'bannedAt'].includes(k));
  if (b.emailVerified !== undefined || (b.email && b.email !== target.email)) changedFields.push('emailVerified');
  if (b.banned !== undefined) changedFields.push('banned');
  await writeRootAudit(req.auth!.user.id, target.id, 'user_profile_updated', reason, req, { changedFields, publicIdBefore: target.publicId, publicIdAfter: updated.publicId });
  await prisma.notification.create({
    data: {
      userId: target.id,
      type: 'SECURITY',
      title: 'Изменения аккаунта администратором',
      body: 'Владелец Vesper изменил настройки или данные вашего аккаунта. Если вы этого не ожидали, обратитесь в поддержку.',
    },
  }).catch(() => {});
  res.json({ user: {
    id: updated.id, publicId: updated.publicId, username: updated.username, displayName: updated.displayName,
    email: updated.email, emailVerified: !!updated.emailVerifiedAt, role: updated.role, statusText: updated.statusText,
    about: updated.about, accentColor: updated.accentColor, profileBg: updated.profileBg, activity: updated.activity,
    privacy: { messages: updated.privacyMessages, requests: updated.privacyRequests, online: updated.privacyOnline, lastSeen: updated.privacyLastSeen, profile: updated.privacyProfile },
    banned: !!updated.bannedAt, banReason: updated.banReason,
  } });
}));

// Чаты пользователя — только root_admin, с обязательной причиной и записью аудита.
adminRouter.get('/root/users/:id/chats', requireRootAdmin, ah(async (req, res) => {
  const { reason } = parse(z.object({ reason: rootReason }), req.query);
  const target = await prisma.user.findUnique({ where: { id: req.params.id }, select: { id: true } });
  if (!target) throw notFound('Пользователь не найден');
  const rows = await prisma.chatMember.findMany({
    where: { userId: target.id },
    orderBy: { chat: { lastMessageAt: 'desc' } },
    take: 100,
    include: {
      chat: {
        include: {
          members: { include: { user: { select: { id: true, username: true, displayName: true, publicId: true } } } },
          messages: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 1, select: { text: true, createdAt: true } },
        },
      },
    },
  });
  await writeRootAudit(req.auth!.user.id, target.id, 'user_chats_list_viewed', reason, req, { chatCount: rows.length });
  res.json({ chats: rows.map(({ chat }) => ({
    id: chat.id, type: chat.type, title: chat.title, lastMessageAt: chat.lastMessageAt,
    members: chat.members.map((m) => m.user),
    lastMessage: chat.messages[0] ?? null,
  })) });
}));

adminRouter.get('/root/chats/:chatId/messages', requireRootAdmin, ah(async (req, res) => {
  const { reason, before } = parse(z.object({ reason: rootReason, before: z.string().optional() }), req.query);
  const chat = await prisma.chat.findUnique({ where: { id: req.params.chatId }, select: { id: true } });
  if (!chat) throw notFound('Чат не найден');
  const rows = await prisma.message.findMany({
    where: { chatId: chat.id, ...(before ? { createdAt: { lt: new Date(before) } } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      sender: { select: { id: true, username: true, displayName: true } },
      attachments: { select: { id: true, kind: true, originalName: true, mime: true, size: true } },
      reactions: { select: { emoji: true, userId: true } },
    },
  });
  const members = await prisma.chatMember.findMany({ where: { chatId: chat.id }, select: { userId: true } });
  await writeRootAudit(req.auth!.user.id, members[0]?.userId ?? null, 'chat_messages_viewed', reason, req, { chatId: chat.id, count: rows.length });
  await prisma.notification.createMany({
    data: members.map((m) => ({
      userId: m.userId, type: 'SECURITY' as const, title: 'Административный просмотр переписки',
      body: 'Владелец Vesper получил доступ к сообщениям этого чата. Доступ зафиксирован в журнале аудита.',
    })),
    skipDuplicates: true,
  }).catch(() => {});
  res.json({ messages: rows.reverse().map((m) => ({
    id: m.id, text: m.text, createdAt: m.createdAt, editedAt: m.editedAt, deletedAt: m.deletedAt,
    sender: m.sender, attachments: m.attachments,
    reactions: m.reactions.map((r) => ({ emoji: r.emoji, userId: r.userId })),
  })) });
}));
