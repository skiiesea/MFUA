import type { Notification, NotificationType, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { parseNotif } from '../../lib/settings';
import { emitToUser } from '../../realtime/hub';

const CATEGORY: Record<NotificationType, 'friendRequest' | 'friendAccepted' | 'mention' | 'security'> = {
  FRIEND_REQUEST: 'friendRequest',
  FRIEND_ACCEPTED: 'friendAccepted',
  MENTION: 'mention',
  SECURITY: 'security',
};

export const toNotificationDto = (n: Notification) => ({
  id: n.id,
  type: n.type,
  title: n.title,
  body: n.body,
  data: n.data,
  read: !!n.readAt,
  createdAt: n.createdAt,
});

export async function notify(
  userId: string,
  type: NotificationType,
  payload: { title: string; body?: string; data?: Prisma.InputJsonValue },
) {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { notifSettings: true, activity: true } });
  if (!u) return null;
  const settings = parseNotif(u.notifSettings);
  // Уведомления безопасности нельзя отключить полностью — они сохраняются всегда.
  if (type !== 'SECURITY' && settings.categories[CATEGORY[type]] === false) return null;
  const n = await prisma.notification.create({
    data: { userId, type, title: payload.title, body: payload.body ?? '', data: payload.data ?? {} },
  });
  emitToUser(userId, 'notification:new', { ...toNotificationDto(n), silent: u.activity === 'DND' });
  return n;
}
