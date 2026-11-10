import { prisma } from './prisma';

export async function friendIdsOf(userId: string): Promise<Set<string>> {
  const rows = await prisma.friendship.findMany({
    where: { status: 'ACCEPTED', OR: [{ requesterId: userId }, { addresseeId: userId }] },
    select: { requesterId: true, addresseeId: true },
  });
  return new Set(rows.map((r) => (r.requesterId === userId ? r.addresseeId : r.requesterId)));
}

/** Все, кого я заблокировал, и все, кто заблокировал меня. */
export async function blockedPairIds(userId: string): Promise<Set<string>> {
  const rows = await prisma.block.findMany({
    where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
    select: { blockerId: true, blockedId: true },
  });
  return new Set(rows.map((r) => (r.blockerId === userId ? r.blockedId : r.blockerId)));
}

export type SendPolicy = { ok: true } | { ok: false; reason: 'BLOCKED' | 'PRIVACY' };

export function messagePolicy(
  target: { id: string; privacyMessages: 'EVERYONE' | 'FRIENDS' | 'NOBODY' },
  friends: Set<string>,
  blocked: Set<string>,
): SendPolicy {
  if (blocked.has(target.id)) return { ok: false, reason: 'BLOCKED' };
  if (target.privacyMessages === 'NOBODY') return { ok: false, reason: 'PRIVACY' };
  if (target.privacyMessages === 'FRIENDS' && !friends.has(target.id)) return { ok: false, reason: 'PRIVACY' };
  return { ok: true };
}
