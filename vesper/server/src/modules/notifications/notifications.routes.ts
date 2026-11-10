import { Router } from 'express';
import { z } from 'zod';
import { ah, parse } from '../../lib/http';
import { prisma } from '../../lib/prisma';
import { requireAuth } from '../../middleware/auth';
import { toNotificationDto } from './notifications.service';

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

notificationsRouter.get('/', ah(async (req, res) => {
  const { before } = parse(z.object({ before: z.string().max(40).optional() }), req.query);
  const userId = req.auth!.user.id;
  const cursor = before ? await prisma.notification.findFirst({ where: { id: before, userId }, select: { createdAt: true } }) : null;
  const rows = await prisma.notification.findMany({
    where: { userId, ...(cursor ? { createdAt: { lt: cursor.createdAt } } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 31,
  });
  const unread = await prisma.notification.count({ where: { userId, readAt: null } });
  res.json({ items: rows.slice(0, 30).map(toNotificationDto), hasMore: rows.length > 30, unread });
}));

notificationsRouter.get('/unread-count', ah(async (req, res) => {
  res.json({ unread: await prisma.notification.count({ where: { userId: req.auth!.user.id, readAt: null } }) });
}));

notificationsRouter.post('/read-all', ah(async (req, res) => {
  await prisma.notification.updateMany({ where: { userId: req.auth!.user.id, readAt: null }, data: { readAt: new Date() } });
  res.json({ ok: true });
}));

notificationsRouter.post('/:id/read', ah(async (req, res) => {
  await prisma.notification.updateMany({ where: { id: req.params.id, userId: req.auth!.user.id, readAt: null }, data: { readAt: new Date() } });
  res.json({ ok: true });
}));

notificationsRouter.delete('/', ah(async (req, res) => {
  await prisma.notification.deleteMany({ where: { userId: req.auth!.user.id } });
  res.json({ ok: true });
}));
