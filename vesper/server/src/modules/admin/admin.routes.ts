import fs from 'node:fs/promises';
import path from 'node:path';
import { Router } from 'express';
import { z } from 'zod';
import { badRequest, forbidden, notFound } from '../../lib/errors';
import { ah, ipOf, parse } from '../../lib/http';
import { LOG_FILES, logDir, logs } from '../../lib/logger';
import { prisma } from '../../lib/prisma';
import { mediaUrl } from '../../lib/serialize';
import { requireAdmin, requireAuth } from '../../middleware/auth';
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

