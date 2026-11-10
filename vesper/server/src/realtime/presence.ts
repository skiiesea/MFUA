import { prisma } from '../lib/prisma';
import { friendIdsOf } from '../lib/relations';
import { presenceOf } from '../lib/serialize';
import { emitToUsers } from './hub';

/** Все, кому интересен мой статус: друзья и собеседники по общим чатам. */
export async function contactsOf(userId: string): Promise<Set<string>> {
  const [friends, shared] = await Promise.all([
    friendIdsOf(userId),
    prisma.chatMember.findMany({
      where: { chat: { members: { some: { userId } } }, userId: { not: userId } },
      select: { userId: true },
    }),
  ]);
  const all = new Set<string>(friends);
  shared.forEach((m) => all.add(m.userId));
  return all;
}

/** Рассылает контактам событие presence. Каждому — только то, что разрешают настройки приватности. */
export async function broadcastPresence(userId: string) {
  const [u, contacts, friends] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, activity: true, lastSeenAt: true, privacyOnline: true, privacyLastSeen: true },
    }),
    contactsOf(userId),
    friendIdsOf(userId),
  ]);
  if (!u) return;
  for (const cid of contacts) {
    // дружба симметрична: если cid — мой друг, то я друг для cid
    const viewerFriends = friends.has(cid) ? new Set([userId]) : new Set<string>();
    emitToUsers([cid], 'presence', { userId, ...presenceOf(u, cid, viewerFriends) });
  }
  emitToUsers([userId], 'presence', { userId, ...presenceOf(u, userId, new Set()) });
}
