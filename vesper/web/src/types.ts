export type Visibility = 'EVERYONE' | 'FRIENDS' | 'NOBODY';
export type Activity = 'AUTO' | 'DND' | 'OFFLINE' | 'WORK' | 'FREE';

export interface Presence {
  online: boolean | null;
  lastSeenAt: string | null;
  activity: 'DND' | 'WORK' | 'FREE' | null;
}

export interface Card {
  id: string;
  publicId: number;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  statusText: string;
  accentColor: string | null;
  presence: Presence;
  isFriend?: boolean;
}

export interface UiSettings { theme: 'dark' | 'light' | 'system'; accent: string; scale: number }
export interface NotifSettings {
  sound: boolean;
  volume: number;
  tone: 'soft' | 'bell' | 'pop';
  categories: { message: boolean; friendRequest: boolean; friendAccepted: boolean; mention: boolean; security: boolean };
}

export interface Self {
  id: string;
  publicId: number;
  username: string;
  displayName: string;
  email: string;
  emailVerified: boolean;
  role: 'USER' | 'ADMIN' | 'ROOT_ADMIN';
  avatarUrl: string | null;
  coverUrl: string | null;
  statusText: string;
  about: string;
  accentColor: string | null;
  profileBg: string | null;
  activity: Activity;
  createdAt: string;
  twoFactorEnabled: boolean;
  privacy: { messages: Visibility; requests: 'EVERYONE' | 'NOBODY'; online: Visibility; lastSeen: Visibility; profile: Visibility };
  ui: UiSettings;
  notifications: NotifSettings;
}

export interface Profile {
  id: string;
  publicId: number;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  accentColor: string | null;
  profileBg: string | null;
  statusText: string;
  about: string;
  createdAt: string | null;
  presence: Presence;
  restricted: boolean;
  isSelf: boolean;
  canMessage: boolean;
  canRequest: boolean;
  relation: {
    friendship: 'SELF' | 'FRIEND' | 'OUTGOING' | 'INCOMING' | 'NONE';
    friendshipId: string | null;
    blockedByMe: boolean;
    blockedMe: boolean;
  };
}

export interface AttachmentDto {
  id: string;
  kind: 'IMAGE' | 'FILE';
  name: string;
  mime: string;
  size: number;
  width: number | null;
  height: number | null;
  url: string;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  sender: { id: string; username: string; displayName: string; avatarUrl: string | null };
  text: string;
  createdAt: string;
  editedAt: string | null;
  pinned: boolean;
  replyTo: { id: string; senderId: string; senderName: string; text: string | null; deleted: boolean; hasAttachment: boolean } | null;
  attachments: AttachmentDto[];
  reactions: { emoji: string; userIds: string[] }[];
  /** локальные поля для сообщений, которые ещё не подтверждены сервером */
  pending?: 'sending' | 'failed';
}

export interface ChatMember {
  userId: string;
  role: 'MEMBER' | 'ADMIN' | 'OWNER';
  joinedAt: string;
  lastReadAt: string;
  lastDeliveredAt: string;
  user: Card;
}

export interface Chat {
  id: string;
  type: 'DIRECT' | 'GROUP';
  title: string | null;
  description: string | null;
  avatarUrl: string | null;
  createdAt: string;
  lastMessageAt: string;
  unread: number;
  myRole: 'MEMBER' | 'ADMIN' | 'OWNER';
  canSend: boolean;
  sendBlockReason: 'BLOCKED' | 'PRIVACY' | null;
  peer: Card | null;
  members: ChatMember[];
  lastMessage: { id: string; text: string; senderId: string; createdAt: string; hasAttachment: boolean } | null;
}

export interface NotificationItem {
  id: string;
  type: 'FRIEND_REQUEST' | 'FRIEND_ACCEPTED' | 'MENTION' | 'SECURITY';
  title: string;
  body: string;
  data: Record<string, string>;
  read: boolean;
  createdAt: string;
}
