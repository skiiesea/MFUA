import { Prisma } from '@prisma/client';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { badRequest, conflict, notFound } from '../../lib/errors';
import { ah, parse } from '../../lib/http';
import { toWebp } from '../../lib/images';
import { prisma } from '../../lib/prisma';
import { blockedPairIds, friendIdsOf, messagePolicy } from '../../lib/relations';
import { cardSelect, mediaUrl, presenceOf, toCard, toSelf } from '../../lib/serialize';
import { removePublic, savePublic } from '../../lib/storage';
import { colorSchema, displayNameSchema, usernameSchema } from '../../lib/validation';
import { requireAuth } from '../../middleware/auth';
import { availabilityLimiter, searchLimiter, uploadLimiter } from '../../middleware/rateLimit';

import { broadcastPresence } from '../../realtime/presence';

export const usersRouter = Router();
usersRouter.use(requireAuth);

const imageUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024, files: 1 } });
const BG_PRESETS = ['dusk', 'aurora', 'ember', 'ocean', 'forest', 'graphite'] as const;

usersRouter.get('/search', searchLimiter, ah(async (req, res) => {
  const { q } = parse(z.object({ q: z.string().trim().min(2, 'Минимум 2 символа').max(40) }), req.query);
  const me = req.auth!.user.id;
  const [friends, blocked] = await Promise.all([friendIdsOf(me), blockedPairIds(me)]);
  const term = q.replace(/^@/, '');
  const rows = await prisma.user.findMany({
    where: {
      id: { notIn: [me, ...blocked] },
      bannedAt: null,
      emailVerifiedAt: { not: null },
      OR: [{ username: { contains: term.toLowerCase() } }, { displayName: { contains: term, mode: 'insensitive' } }],
    },
    select: cardSelect,
    take: 20,
    orderBy: [{ username: 'asc' }],
  });
  const sorted = rows.sort((a, b) => Number(b.username.startsWith(term.toLowerCase())) - Number(a.username.startsWith(term.toLowerCase())));
  res.json({ users: sorted.map((u) => ({ ...toCard(u, me, friends), isFriend: friends.has(u.id) })) });
}));

usersRouter.get('/availability', availabilityLimiter, ah(async (req, res) => {
  const { username } = parse(z.object({ username: usernameSchema }), req.query);
  const u = await prisma.user.findUnique({ where: { username }, select: { id: true } });
  res.json({ available: !u || u.id === req.auth!.user.id });
}));

usersRouter.get('/by-username/:username', ah(async (req, res) => {
  const me = req.auth!.user;
  const username = req.params.username.toLowerCase().replace(/^@/, '');
  const target = await prisma.user.findUnique({ where: { username } });
  if (!target || target.bannedAt || !target.emailVerifiedAt) throw notFound('Пользователь не найден');
  const [friends, blocked, friendship, iBlocked] = await Promise.all([
    friendIdsOf(me.id),
    blockedPairIds(me.id),
    prisma.friendship.findFirst({ where: { OR: [{ requesterId: me.id, addresseeId: target.id }, { requesterId: target.id, addresseeId: me.id }] } }),
    prisma.block.findUnique({ where: { blockerId_blockedId: { blockerId: me.id, blockedId: target.id } } }),
  ]);
  const isSelf = target.id === me.id;
  const isFriend = friends.has(target.id);
  const blockedMe = blocked.has(target.id) && !iBlocked;
  const relation = {
    friendship: isSelf ? 'SELF' : isFriend ? 'FRIEND' : friendship ? (friendship.requesterId === me.id ? 'OUTGOING' : 'INCOMING') : 'NONE',
    friendshipId: friendship?.id ?? null,
    blockedByMe: !!iBlocked,
    blockedMe,
  };
  const policy = messagePolicy(target, friends, blocked);
  const canRequest = !isSelf && !isFriend && !friendship && !blocked.has(target.id) && target.privacyRequests !== 'NOBODY';
  const allowed = isSelf || (!blocked.has(target.id) && (target.privacyProfile === 'EVERYONE' || (target.privacyProfile === 'FRIENDS' && isFriend)));
  const base = {
    id: target.id,
    publicId: target.publicId,
    username: target.username,
    displayName: target.displayName,
    avatarUrl: mediaUrl(target.avatarKey),
    accentColor: allowed ? target.accentColor : null,
    relation,
    canMessage: !isSelf && policy.ok,
    canRequest,
    isSelf,
  };
  if (!allowed) {
    res.json({ profile: { ...base, restricted: true, coverUrl: null, profileBg: null, statusText: '', about: '', createdAt: null, presence: { online: null, lastSeenAt: null, activity: null } } });
    return;
  }
  res.json({
    profile: {
      ...base,
      restricted: false,
      coverUrl: mediaUrl(target.coverKey),
      profileBg: target.profileBg,
      statusText: target.statusText,
      about: target.about,
      createdAt: target.createdAt,
      presence: presenceOf(target, me.id, friends),
    },
  });
}));

const profileSchema = z.object({
  displayName: displayNameSchema.optional(),
  username: usernameSchema.optional(),
  statusText: z.string().trim().max(100, 'Не более 100 символов').optional(),
  about: z.string().trim().max(500, 'Не более 500 символов').optional(),
  accentColor: colorSchema.nullable().optional(),
  profileBg: z.enum(BG_PRESETS).nullable().optional(),
  activity: z.enum(['AUTO', 'DND', 'OFFLINE', 'WORK', 'FREE']).optional(),
});

usersRouter.patch('/me', ah(async (req, res) => {
  const me = req.auth!.user;
  const data = parse(profileSchema, req.body);
  if (data.username && data.username !== me.username) {
    const taken = await prisma.user.findUnique({ where: { username: data.username }, select: { id: true } });
    if (taken) throw conflict('Этот логин уже занят', { username: 'Этот логин уже занят' });
  }
  let updated;
  try {
    updated = await prisma.user.update({ where: { id: me.id }, data });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw conflict('Этот логин уже занят', { username: 'Этот логин уже занят' });
    throw e;
  }
  if (data.activity !== undefined && data.activity !== me.activity) await broadcastPresence(me.id);
  res.json({ user: toSelf(updated) });
}));

async function replaceImage(userId: string, kind: 'avatar' | 'cover', file: Express.Multer.File | undefined) {
  if (!file) throw badRequest('Файл не выбран');
  const buf = await toWebp(file.buffer, kind === 'avatar' ? 512 : 1600, kind === 'avatar' ? 512 : 560);
  const key = await savePublic(buf);
  const field = kind === 'avatar' ? 'avatarKey' : 'coverKey';
  const prev = await prisma.user.findUnique({ where: { id: userId }, select: { avatarKey: true, coverKey: true } });
  const updated = await prisma.user.update({ where: { id: userId }, data: { [field]: key } });
  await removePublic(kind === 'avatar' ? prev?.avatarKey : prev?.coverKey);
  return updated;
}

usersRouter.post('/me/avatar', uploadLimiter, imageUpload.single('file'), ah(async (req, res) => {
  res.json({ user: toSelf(await replaceImage(req.auth!.user.id, 'avatar', req.file)) });
}));
usersRouter.post('/me/cover', uploadLimiter, imageUpload.single('file'), ah(async (req, res) => {
  res.json({ user: toSelf(await replaceImage(req.auth!.user.id, 'cover', req.file)) });
}));

usersRouter.delete('/me/avatar', ah(async (req, res) => {
  const me = req.auth!.user;
  await removePublic(me.avatarKey);
  res.json({ user: toSelf(await prisma.user.update({ where: { id: me.id }, data: { avatarKey: null } })) });
}));
usersRouter.delete('/me/cover', ah(async (req, res) => {
  const me = req.auth!.user;
  await removePublic(me.coverKey);
  res.json({ user: toSelf(await prisma.user.update({ where: { id: me.id }, data: { coverKey: null } })) });
}));

