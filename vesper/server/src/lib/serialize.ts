import type { Prisma, User, Visibility } from '@prisma/client';
import { isOnline } from '../realtime/hub';
import { parseNotif, parseUi } from './settings';

export const mediaUrl = (key?: string | null) => (key ? `/api/media/${key}` : null);

export const cardSelect = {
  id: true,
  publicId: true,
  username: true,
  displayName: true,
  avatarKey: true,
  statusText: true,
  accentColor: true,
  activity: true,
  lastSeenAt: true,
  privacyOnline: true,
  privacyLastSeen: true,
  privacyMessages: true,
} satisfies Prisma.UserSelect;
export type CardUser = Prisma.UserGetPayload<{ select: typeof cardSelect }>;

const canSee = (vis: Visibility, isSelf: boolean, isFriend: boolean) =>
  isSelf || vis === 'EVERYONE' || (vis === 'FRIENDS' && isFriend);

export function presenceOf(
  u: Pick<CardUser, 'id' | 'activity' | 'lastSeenAt' | 'privacyOnline' | 'privacyLastSeen'>,
  viewerId: string,
  friends: Set<string>,
) {
  const self = u.id === viewerId;
  const friend = friends.has(u.id);
  const hidden = u.activity === 'OFFLINE' && !self;
  const online = isOnline(u.id) && !hidden;
  const showOnline = canSee(u.privacyOnline, self, friend);
  const showSeen = canSee(u.privacyLastSeen, self, friend);
  const act = u.activity === 'DND' || u.activity === 'WORK' || u.activity === 'FREE' ? u.activity : null;
  return {
    online: showOnline ? online : null,
    lastSeenAt: showSeen && !online && !hidden ? u.lastSeenAt : null,
    activity: showOnline && online ? act : null,
  };
}

export function toCard(u: CardUser, viewerId: string, friends: Set<string>) {
  return {
    id: u.id,
    publicId: u.publicId,
    username: u.username,
    displayName: u.displayName,
    avatarUrl: mediaUrl(u.avatarKey),
    statusText: u.statusText,
    accentColor: u.accentColor,
    presence: presenceOf(u, viewerId, friends),
  };
}

/** Данные о самом себе — единственное место, где отдаётся email и настройки. Хеш пароля и секреты не выходят наружу. */
export function toSelf(u: User) {
  return {
    id: u.id,
    publicId: u.publicId,
    username: u.username,
    displayName: u.displayName,
    email: u.email,
    emailVerified: !!u.emailVerifiedAt,
    role: u.role,
    avatarUrl: mediaUrl(u.avatarKey),
    coverUrl: mediaUrl(u.coverKey),
    statusText: u.statusText,
    about: u.about,
    accentColor: u.accentColor,
    profileBg: u.profileBg,
    activity: u.activity,
    createdAt: u.createdAt,
    twoFactorEnabled: !!u.totpEnabledAt,
    privacy: {
      messages: u.privacyMessages,
      requests: u.privacyRequests,
      online: u.privacyOnline,
      lastSeen: u.privacyLastSeen,
      profile: u.privacyProfile,
    },
    ui: parseUi(u.uiSettings),
    notifications: parseNotif(u.notifSettings),
  };
}
