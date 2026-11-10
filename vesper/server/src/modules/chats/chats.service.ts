import { Prisma } from '@prisma/client';
import { badRequest, forbidden, notFound } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { blockedPairIds, friendIdsOf, messagePolicy } from '../../lib/relations';
import { cardSelect, mediaUrl, toCard } from '../../lib/serialize';
import { removePrivate } from '../../lib/storage';
import { emitToUser } from '../../realtime/hub';

// ── Включения и DTO ─────────────────────────────────────────
const chatInclude = {
  members: { include: { user: { select: cardSelect } } },
  messages: {
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 1,
    select: { id: true, text: true, senderId: true, createdAt: true, attachments: { select: { id: true } } },
  },
} satisfies Prisma.ChatInclude;
type ChatRow = Prisma.ChatGetPayload<{ include: typeof chatInclude }>;

export const messageInclude = {
  sender: { select: { id: true, username: true, displayName: true, avatarKey: true } },
  attachments: true,
  reactions: { select: { emoji: true, userId: true } },
  replyTo: {
    select: {
      id: true,
      text: true,
      deletedAt: true,
      senderId: true,
      sender: { select: { displayName: true } },
      attachments: { select: { id: true } },
    },
  },
} satisfies Prisma.MessageInclude;
export type MessageRow = Prisma.MessageGetPayload<{ include: typeof messageInclude }>;

export function toMessageDto(m: MessageRow) {
  const grouped = new Map<string, string[]>();
  for (const r of m.reactions) grouped.set(r.emoji, [...(grouped.get(r.emoji) ?? []), r.userId]);
  return {
    id: m.id,
    chatId: m.chatId,
    senderId: m.senderId,
    sender: { id: m.sender.id, username: m.sender.username, displayName: m.sender.displayName, avatarUrl: mediaUrl(m.sender.avatarKey) },
    text: m.text,
    createdAt: m.createdAt,
    editedAt: m.editedAt,
    pinned: !!m.pinnedAt,
    replyTo: m.replyTo
      ? {
          id: m.replyTo.id,
          senderId: m.replyTo.senderId,
          senderName: m.replyTo.sender.displayName,
          text: m.replyTo.deletedAt ? null : m.replyTo.text.slice(0, 140),
          deleted: !!m.replyTo.deletedAt,
          hasAttachment: m.replyTo.attachments.length > 0,
        }
      : null,
    attachments: m.attachments.map((a) => ({
      id: a.id,
      kind: a.kind,
      name: a.originalName,
      mime: a.mime,
      size: a.size,
      width: a.width,
      height: a.height,
      url: `/api/files/${a.id}`,
    })),
    reactions: [...grouped.entries()].map(([emoji, userIds]) => ({ emoji, userIds })),
  };
}

function toChatDto(c: ChatRow, viewerId: string, unread: number, friends: Set<string>, blocked: Set<string>) {
  const me = c.members.find((m) => m.userId === viewerId)!;
  let peer = null as ReturnType<typeof toCard> | null;
  let canSend = true;
  let sendBlockReason: 'BLOCKED' | 'PRIVACY' | null = null;
  if (c.type === 'DIRECT') {
    const other = c.members.find((m) => m.userId !== viewerId);
    if (other) {
      peer = toCard(other.user, viewerId, friends);
      const p = messagePolicy(other.user, friends, blocked);
      if (!p.ok) {
        canSend = false;
        sendBlockReason = p.reason;
      }
    }
  }
  const last = c.messages[0];
  return {
    id: c.id,
    type: c.type,
    title: c.title,
    description: c.description,
    avatarUrl: mediaUrl(c.avatarKey),
    createdAt: c.createdAt,
    lastMessageAt: c.lastMessageAt,
    unread,
    myRole: me.role,
    canSend,
    sendBlockReason,
    peer,
    members: c.members.map((m) => ({
      userId: m.userId,
      role: m.role,
      joinedAt: m.joinedAt,
      lastReadAt: m.lastReadAt,
      lastDeliveredAt: m.lastDeliveredAt,
      user: toCard(m.user, viewerId, friends),
    })),
    lastMessage: last ? { id: last.id, text: last.text.slice(0, 140), senderId: last.senderId, createdAt: last.createdAt, hasAttachment: last.attachments.length > 0 } : null,
  };
}

export async function loadChatDtos(viewerId: string, onlyChatId?: string) {
  const rows = await prisma.chat.findMany({
    where: { members: { some: { userId: viewerId } }, ...(onlyChatId ? { id: onlyChatId } : {}) },
    include: chatInclude,
    orderBy: { lastMessageAt: 'desc' },
  });
  const unread = await prisma.$queryRaw<{ chatId: string; n: number }[]>`
    SELECT m."chatId", COUNT(*)::int AS n
    FROM "Message" m
    JOIN "ChatMember" cm ON cm."chatId" = m."chatId" AND cm."userId" = ${viewerId}
    WHERE m."senderId" <> ${viewerId} AND m."deletedAt" IS NULL AND m."createdAt" > cm."lastReadAt"
    GROUP BY m."chatId"`;
  const unreadMap = new Map<string, number>(unread.map((r): [string, number] => [r.chatId, r.n]));
  const [friends, blocked] = await Promise.all([friendIdsOf(viewerId), blockedPairIds(viewerId)]);
  return rows
    // пустые личные чаты не показываем собеседнику, пока ему ничего не написали
    .filter((c) => !(c.type === 'DIRECT' && c.messages.length === 0 && c.createdById !== viewerId))
    .map((c) => toChatDto(c, viewerId, unreadMap.get(c.id) ?? 0, friends, blocked));
}

export async function getChatDto(chatId: string, viewerId: string) {
  const [dto] = await loadChatDtos(viewerId, chatId);
  if (!dto) throw notFound('Чат не найден');
  return dto;
}

/** Отправляет каждому участнику его персональную версию карточки чата. */
export async function broadcastChat(chatId: string, removedUserIds: string[] = []) {
  const members = await prisma.chatMember.findMany({ where: { chatId }, select: { userId: true } });
  await Promise.all(
    members.map(async (m) => {
      const [dto] = await loadChatDtos(m.userId, chatId);
      if (dto) emitToUser(m.userId, 'chat:updated', dto);
    }),
  );
  for (const id of removedUserIds) emitToUser(id, 'chat:removed', { chatId });
}

// ── Доступ ──────────────────────────────────────────────────
export async function assertMember(chatId: string, userId: string) {
  const m = await prisma.chatMember.findUnique({ where: { chatId_userId: { chatId, userId } }, include: { chat: true } });
  if (!m) throw forbidden('Вы не участник этого чата');
  return m;
}
const isStaff = (role: string) => role === 'ADMIN' || role === 'OWNER';

// ── Личные чаты ─────────────────────────────────────────────
export async function openDirect(viewerId: string, targetId: string) {
  if (viewerId === targetId) throw badRequest('Нельзя написать самому себе');
  const target = await prisma.user.findUnique({ where: { id: targetId }, select: { ...cardSelect, bannedAt: true } });
  if (!target || target.bannedAt) throw notFound('Пользователь не найден');
  const key = [viewerId, targetId].sort().join(':');
  let chat = await prisma.chat.findUnique({ where: { directKey: key } });
  if (!chat) {
    const [friends, blocked] = await Promise.all([friendIdsOf(viewerId), blockedPairIds(viewerId)]);
    const p = messagePolicy(target, friends, blocked);
    if (!p.ok) throw forbidden(p.reason === 'BLOCKED' ? 'Вы не можете написать этому пользователю' : 'Пользователь ограничил круг тех, кто может ему писать');
    try {
      chat = await prisma.chat.create({
        data: { type: 'DIRECT', directKey: key, createdById: viewerId, members: { create: [{ userId: viewerId }, { userId: targetId }] } },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') chat = await prisma.chat.findUniqueOrThrow({ where: { directKey: key } });
      else throw e;
    }
  }
  return getChatDto(chat.id, viewerId);
}

// ── Группы ──────────────────────────────────────────────────
async function assertCanAdd(viewerId: string, userIds: string[]) {
  if (userIds.length === 0) return;
  const [friends, blocked] = await Promise.all([friendIdsOf(viewerId), blockedPairIds(viewerId)]);
  for (const id of userIds) {
    if (!friends.has(id) || blocked.has(id)) throw forbidden('В группу можно добавлять только друзей');
  }
}

export async function createGroup(viewerId: string, input: { title: string; description?: string; memberIds: string[] }) {
  const ids = [...new Set(input.memberIds)].filter((id) => id !== viewerId);
  if (ids.length > 49) throw badRequest('В группе не может быть больше 50 участников');
  await assertCanAdd(viewerId, ids);
  const chat = await prisma.chat.create({
    data: {
      type: 'GROUP',
      title: input.title,
      description: input.description,
      createdById: viewerId,
      members: { create: [{ userId: viewerId, role: 'OWNER' as const }, ...ids.map((userId) => ({ userId }))] },
    },
  });
  await broadcastChat(chat.id);
  return getChatDto(chat.id, viewerId);
}

async function groupStaff(chatId: string, userId: string) {
  const m = await assertMember(chatId, userId);
  if (m.chat.type !== 'GROUP') throw badRequest('Это личный чат');
  if (!isStaff(m.role)) throw forbidden('Только администраторы могут это делать');
  return m;
}

export async function updateGroup(chatId: string, userId: string, data: { title?: string; description?: string }) {
  await groupStaff(chatId, userId);
  await prisma.chat.update({ where: { id: chatId }, data });
  await broadcastChat(chatId);
}

export async function setGroupAvatar(chatId: string, userId: string, key: string | null) {
  const m = await groupStaff(chatId, userId);
  await prisma.chat.update({ where: { id: chatId }, data: { avatarKey: key } });
  await broadcastChat(chatId);
  return m.chat.avatarKey;
}

export async function addMembers(chatId: string, userId: string, userIds: string[]) {
  await groupStaff(chatId, userId);
  const existing = await prisma.chatMember.findMany({ where: { chatId }, select: { userId: true } });
  const fresh = [...new Set(userIds)].filter((id) => !existing.some((e) => e.userId === id));
  if (existing.length + fresh.length > 50) throw badRequest('В группе не может быть больше 50 участников');
  await assertCanAdd(userId, fresh);
  await prisma.chatMember.createMany({ data: fresh.map((id) => ({ chatId, userId: id })), skipDuplicates: true });
  await broadcastChat(chatId);
}

export async function removeMember(chatId: string, actorId: string, targetId: string) {
  const actor = await groupStaff(chatId, actorId);
  const target = await prisma.chatMember.findUnique({ where: { chatId_userId: { chatId, userId: targetId } } });
  if (!target) throw notFound('Участник не найден');
  if (targetId === actorId) throw badRequest('Чтобы выйти из группы, используйте «Покинуть группу»');
  if (target.role === 'OWNER') throw forbidden('Нельзя удалить владельца группы');
  if (actor.role === 'ADMIN' && target.role === 'ADMIN') throw forbidden('Администратор не может удалить другого администратора');
  await prisma.chatMember.delete({ where: { chatId_userId: { chatId, userId: targetId } } });
  await broadcastChat(chatId, [targetId]);
}

export async function setMemberRole(chatId: string, actorId: string, targetId: string, role: 'ADMIN' | 'MEMBER') {
  const actor = await assertMember(chatId, actorId);
  if (actor.chat.type !== 'GROUP') throw badRequest('Это личный чат');
  if (actor.role !== 'OWNER') throw forbidden('Назначать администраторов может только владелец');
  const target = await prisma.chatMember.findUnique({ where: { chatId_userId: { chatId, userId: targetId } } });
  if (!target || target.role === 'OWNER') throw notFound('Участник не найден');
  await prisma.chatMember.update({ where: { chatId_userId: { chatId, userId: targetId } }, data: { role } });
  await broadcastChat(chatId);
}

export async function leaveGroup(chatId: string, userId: string) {
  const me = await assertMember(chatId, userId);
  if (me.chat.type !== 'GROUP') throw badRequest('Из личного чата выйти нельзя');
  const rest = await prisma.chatMember.findMany({ where: { chatId, userId: { not: userId } }, orderBy: { joinedAt: 'asc' } });
  if (rest.length === 0) {
    await deleteChatFiles(chatId);
    await prisma.chat.delete({ where: { id: chatId } });
    emitToUser(userId, 'chat:removed', { chatId });
    return;
  }
  await prisma.chatMember.delete({ where: { chatId_userId: { chatId, userId } } });
  if (me.role === 'OWNER') {
    const heir = rest.find((m) => m.role === 'ADMIN') ?? rest[0];
    await prisma.chatMember.update({ where: { chatId_userId: { chatId, userId: heir.userId } }, data: { role: 'OWNER' } });
  }
  await broadcastChat(chatId, [userId]);
}

async function deleteChatFiles(chatId: string) {
  const files = await prisma.attachment.findMany({ where: { message: { chatId } }, select: { storageKey: true } });
  await Promise.all(files.map((f) => removePrivate(f.storageKey)));
}

// ── Сообщения ───────────────────────────────────────────────
export async function listMessages(chatId: string, userId: string, opts: { before?: string; around?: string; limit: number }) {
  await assertMember(chatId, userId);
  const base = { chatId, deletedAt: null } as const;
  if (opts.around) {
    const target = await prisma.message.findFirst({ where: { ...base, id: opts.around } });
    if (!target) throw notFound('Сообщение не найдено');
    const [older, newer] = await Promise.all([
      prisma.message.findMany({ where: { ...base, createdAt: { lt: target.createdAt } }, orderBy: { createdAt: 'desc' }, take: 25, include: messageInclude }),
      prisma.message.findMany({ where: { ...base, createdAt: { gte: target.createdAt } }, orderBy: { createdAt: 'asc' }, take: 26, include: messageInclude }),
    ]);
    return { messages: [...older.reverse(), ...newer].map(toMessageDto), hasMore: older.length === 25, detached: newer.length === 26 };
  }
  const cursor = opts.before ? await prisma.message.findFirst({ where: { id: opts.before, chatId }, select: { createdAt: true } }) : null;
  const rows = await prisma.message.findMany({
    where: { ...base, ...(cursor ? { createdAt: { lt: cursor.createdAt } } : {}) },
    orderBy: { createdAt: 'desc' },
    take: opts.limit + 1,
    include: messageInclude,
  });
  return { messages: rows.slice(0, opts.limit).reverse().map(toMessageDto), hasMore: rows.length > opts.limit, detached: false };
}

export async function searchMessages(chatId: string, userId: string, q: string) {
  await assertMember(chatId, userId);
  const rows = await prisma.message.findMany({
    where: { chatId, deletedAt: null, text: { contains: q, mode: 'insensitive' } },
    orderBy: { createdAt: 'desc' },
    take: 40,
    include: messageInclude,
  });
  return rows.map(toMessageDto);
}

export async function listPinned(chatId: string, userId: string) {
  await assertMember(chatId, userId);
  const rows = await prisma.message.findMany({ where: { chatId, deletedAt: null, pinnedAt: { not: null } }, orderBy: { pinnedAt: 'desc' }, take: 20, include: messageInclude });
  return rows.map(toMessageDto);
}

export async function sendMessage(
  userId: string,
  input: { chatId: string; text: string; replyToId?: string; attachmentIds?: string[] },
) {
  const member = await assertMember(input.chatId, userId);
  const text = input.text.trim();
  const attachmentIds = [...new Set(input.attachmentIds ?? [])];
  if (!text && attachmentIds.length === 0) throw badRequest('Сообщение пустое');
  if (text.length > 4000) throw badRequest('Сообщение слишком длинное (максимум 4000 символов)');

  const members = await prisma.chatMember.findMany({ where: { chatId: input.chatId }, select: { userId: true } });
  if (member.chat.type === 'DIRECT') {
    const otherId = members.find((m) => m.userId !== userId)?.userId;
    const other = otherId ? await prisma.user.findUnique({ where: { id: otherId }, select: { ...cardSelect, bannedAt: true } }) : null;
    if (!other || other.bannedAt) throw forbidden('Пользователь недоступен');
    const [friends, blocked] = await Promise.all([friendIdsOf(userId), blockedPairIds(userId)]);
    const p = messagePolicy(other, friends, blocked);
    if (!p.ok) throw forbidden(p.reason === 'BLOCKED' ? 'Вы не можете писать этому пользователю' : 'Пользователь ограничил круг тех, кто может ему писать', 'CANNOT_SEND');
  }
  if (input.replyToId) {
    const ok = await prisma.message.findFirst({ where: { id: input.replyToId, chatId: input.chatId }, select: { id: true } });
    if (!ok) throw badRequest('Сообщение, на которое вы отвечаете, не найдено');
  }
  if (attachmentIds.length) {
    const count = await prisma.attachment.count({ where: { id: { in: attachmentIds }, uploaderId: userId, messageId: null } });
    if (count !== attachmentIds.length) throw badRequest('Вложения недоступны. Загрузите файлы заново.');
  }

  const now = new Date();
  const message = await prisma.$transaction(async (tx) => {
    const m = await tx.message.create({
      data: { chatId: input.chatId, senderId: userId, text, replyToId: input.replyToId, createdAt: now },
    });
    if (attachmentIds.length) await tx.attachment.updateMany({ where: { id: { in: attachmentIds } }, data: { messageId: m.id } });
    await tx.chat.update({ where: { id: input.chatId }, data: { lastMessageAt: now } });
    await tx.chatMember.update({ where: { chatId_userId: { chatId: input.chatId, userId } }, data: { lastReadAt: now, lastDeliveredAt: now } });
    return tx.message.findUniqueOrThrow({ where: { id: m.id }, include: messageInclude });
  });
  return { message: toMessageDto(message), memberIds: members.map((m) => m.userId), chatType: member.chat.type, chatTitle: member.chat.title };
}

const MAX_TEXT = 4000;

export async function editMessage(userId: string, messageId: string, textRaw: string) {
  const text = textRaw.trim();
  if (!text) throw badRequest('Сообщение не может быть пустым');
  if (text.length > MAX_TEXT) throw badRequest('Сообщение слишком длинное');
  const m = await prisma.message.findFirst({ where: { id: messageId, senderId: userId, deletedAt: null } });
  if (!m) throw notFound('Сообщение не найдено');
  await assertMember(m.chatId, userId);
  const updated = await prisma.message.update({ where: { id: m.id }, data: { text, editedAt: new Date() }, include: messageInclude });
  return { message: toMessageDto(updated), memberIds: await memberIdsOf(m.chatId) };
}

export async function deleteMessage(userId: string, messageId: string) {
  const m = await prisma.message.findFirst({ where: { id: messageId, deletedAt: null }, include: { attachments: true } });
  if (!m) throw notFound('Сообщение не найдено');
  const member = await assertMember(m.chatId, userId);
  const own = m.senderId === userId;
  if (!own && !(member.chat.type === 'GROUP' && isStaff(member.role))) throw forbidden('Вы не можете удалить это сообщение');
  await prisma.$transaction([
    prisma.message.update({ where: { id: m.id }, data: { deletedAt: new Date(), text: '', pinnedAt: null, pinnedById: null } }),
    prisma.attachment.deleteMany({ where: { messageId: m.id } }),
    prisma.reaction.deleteMany({ where: { messageId: m.id } }),
  ]);
  await Promise.all(m.attachments.map((a) => removePrivate(a.storageKey)));
  return { chatId: m.chatId, messageId: m.id, memberIds: await memberIdsOf(m.chatId) };
}

const EMOJI_RE = /^(?:\p{Extended_Pictographic}|\p{Emoji_Presentation})(?:\u200d\p{Extended_Pictographic}|\ufe0f|\p{Emoji_Modifier})*$/u;

export async function toggleReaction(userId: string, messageId: string, emoji: string) {
  if (emoji.length > 16 || !EMOJI_RE.test(emoji)) throw badRequest('Недопустимая реакция');
  const m = await prisma.message.findFirst({ where: { id: messageId, deletedAt: null } });
  if (!m) throw notFound('Сообщение не найдено');
  await assertMember(m.chatId, userId);
  const key = { messageId_userId_emoji: { messageId, userId, emoji } };
  const had = await prisma.reaction.findUnique({ where: key });
  if (had) await prisma.reaction.delete({ where: key });
  else {
    const distinct = await prisma.reaction.groupBy({ by: ['emoji'], where: { messageId } });
    if (distinct.length >= 12 && !distinct.some((d) => d.emoji === emoji)) throw badRequest('Слишком много разных реакций');
    await prisma.reaction.create({ data: { messageId, userId, emoji } });
  }
  const reactions = await prisma.reaction.findMany({ where: { messageId }, select: { emoji: true, userId: true } });
  const grouped = new Map<string, string[]>();
  for (const r of reactions) grouped.set(r.emoji, [...(grouped.get(r.emoji) ?? []), r.userId]);
  return { chatId: m.chatId, messageId, reactions: [...grouped.entries()].map(([e, userIds]) => ({ emoji: e, userIds })), memberIds: await memberIdsOf(m.chatId) };
}

export async function setPinned(userId: string, messageId: string, pinned: boolean) {
  const m = await prisma.message.findFirst({ where: { id: messageId, deletedAt: null } });
  if (!m) throw notFound('Сообщение не найдено');
  const member = await assertMember(m.chatId, userId);
  if (member.chat.type === 'GROUP' && !isStaff(member.role)) throw forbidden('Закреплять сообщения могут только администраторы');
  await prisma.message.update({ where: { id: m.id }, data: { pinnedAt: pinned ? new Date() : null, pinnedById: pinned ? userId : null } });
  return { chatId: m.chatId, messageId: m.id, pinned, memberIds: await memberIdsOf(m.chatId) };
}

export async function markRead(userId: string, chatId: string) {
  await assertMember(chatId, userId);
  const now = new Date();
  await prisma.chatMember.update({ where: { chatId_userId: { chatId, userId } }, data: { lastReadAt: now, lastDeliveredAt: now } });
  return { at: now, memberIds: await memberIdsOf(chatId) };
}

export async function memberIdsOf(chatId: string) {
  const rows = await prisma.chatMember.findMany({ where: { chatId }, select: { userId: true } });
  return rows.map((r) => r.userId);
}
