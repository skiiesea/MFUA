import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { badRequest } from '../../lib/errors';
import { ah, parse } from '../../lib/http';
import { toWebp } from '../../lib/images';
import { idSchema } from '../../lib/validation';
import { removePublic, savePublic } from '../../lib/storage';
import { requireAuth } from '../../middleware/auth';
import { searchLimiter, uploadLimiter } from '../../middleware/rateLimit';
import * as svc from './chats.service';

export const chatsRouter = Router();
chatsRouter.use(requireAuth);
const imageUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024, files: 1 } });

chatsRouter.get('/', ah(async (req, res) => {
  const chats = await svc.loadChatDtos(req.auth!.user.id);
  res.json({ chats, unreadTotal: chats.reduce((s, c) => s + c.unread, 0) });
}));

chatsRouter.post('/direct', ah(async (req, res) => {
  const { userId } = parse(z.object({ userId: idSchema }), req.body);
  res.json({ chat: await svc.openDirect(req.auth!.user.id, userId) });
}));

chatsRouter.post('/group', ah(async (req, res) => {
  const b = parse(
    z.object({
      title: z.string().trim().min(1, 'Введите название').max(60, 'Не более 60 символов'),
      description: z.string().trim().max(300).optional(),
      memberIds: z.array(idSchema).max(49),
    }),
    req.body,
  );
  res.status(201).json({ chat: await svc.createGroup(req.auth!.user.id, b) });
}));

chatsRouter.get('/:id', ah(async (req, res) => {
  await svc.assertMember(req.params.id, req.auth!.user.id);
  res.json({ chat: await svc.getChatDto(req.params.id, req.auth!.user.id) });
}));

chatsRouter.patch('/:id', ah(async (req, res) => {
  const b = parse(z.object({ title: z.string().trim().min(1).max(60).optional(), description: z.string().trim().max(300).optional() }), req.body);
  await svc.updateGroup(req.params.id, req.auth!.user.id, b);
  res.json({ chat: await svc.getChatDto(req.params.id, req.auth!.user.id) });
}));

chatsRouter.post('/:id/avatar', uploadLimiter, imageUpload.single('file'), ah(async (req, res) => {
  if (!req.file) throw badRequest('Файл не выбран');
  const key = await savePublic(await toWebp(req.file.buffer, 512, 512));
  try {
    await removePublic(await svc.setGroupAvatar(req.params.id, req.auth!.user.id, key));
  } catch (e) {
    await removePublic(key);
    throw e;
  }
  res.json({ chat: await svc.getChatDto(req.params.id, req.auth!.user.id) });
}));

chatsRouter.delete('/:id/avatar', ah(async (req, res) => {
  await removePublic(await svc.setGroupAvatar(req.params.id, req.auth!.user.id, null));
  res.json({ chat: await svc.getChatDto(req.params.id, req.auth!.user.id) });
}));

chatsRouter.post('/:id/members', ah(async (req, res) => {
  const { userIds } = parse(z.object({ userIds: z.array(idSchema).min(1).max(49) }), req.body);
  await svc.addMembers(req.params.id, req.auth!.user.id, userIds);
  res.json({ chat: await svc.getChatDto(req.params.id, req.auth!.user.id) });
}));

chatsRouter.delete('/:id/members/:userId', ah(async (req, res) => {
  await svc.removeMember(req.params.id, req.auth!.user.id, req.params.userId);
  res.json({ chat: await svc.getChatDto(req.params.id, req.auth!.user.id) });
}));

chatsRouter.patch('/:id/members/:userId', ah(async (req, res) => {
  const { role } = parse(z.object({ role: z.enum(['ADMIN', 'MEMBER']) }), req.body);
  await svc.setMemberRole(req.params.id, req.auth!.user.id, req.params.userId, role);
  res.json({ chat: await svc.getChatDto(req.params.id, req.auth!.user.id) });
}));

chatsRouter.post('/:id/leave', ah(async (req, res) => {
  await svc.leaveGroup(req.params.id, req.auth!.user.id);
  res.json({ ok: true });
}));

chatsRouter.get('/:id/messages', ah(async (req, res) => {
  const q = parse(z.object({ before: idSchema.optional(), around: idSchema.optional(), limit: z.coerce.number().int().min(1).max(100).default(40) }), req.query);
  res.json(await svc.listMessages(req.params.id, req.auth!.user.id, q));
}));

chatsRouter.get('/:id/search', searchLimiter, ah(async (req, res) => {
  const { q } = parse(z.object({ q: z.string().trim().min(2, 'Минимум 2 символа').max(100) }), req.query);
  res.json({ messages: await svc.searchMessages(req.params.id, req.auth!.user.id, q) });
}));

chatsRouter.get('/:id/pinned', ah(async (req, res) => {
  res.json({ messages: await svc.listPinned(req.params.id, req.auth!.user.id) });
}));
