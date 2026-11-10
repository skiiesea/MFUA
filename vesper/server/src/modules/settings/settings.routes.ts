import { Router } from 'express';
import { z } from 'zod';
import { ah, ipOf, parse } from '../../lib/http';
import { logs } from '../../lib/logger';
import { prisma } from '../../lib/prisma';
import { toSelf } from '../../lib/serialize';
import { notifSettingsSchema, parseNotif, parseUi, uiSettingsSchema } from '../../lib/settings';
import { requireAuth } from '../../middleware/auth';
import { broadcastPresence } from '../../realtime/presence';

export const settingsRouter = Router();
settingsRouter.use(requireAuth);

const vis = z.enum(['EVERYONE', 'FRIENDS', 'NOBODY']);
const privacySchema = z.object({
  messages: vis.optional(),
  requests: z.enum(['EVERYONE', 'NOBODY']).optional(),
  online: vis.optional(),
  lastSeen: vis.optional(),
  profile: vis.optional(),
});

settingsRouter.get('/', ah(async (req, res) => {
  res.json({ user: toSelf(req.auth!.user) });
}));

settingsRouter.patch('/privacy', ah(async (req, res) => {
  const b = parse(privacySchema, req.body);
  const user = await prisma.user.update({
    where: { id: req.auth!.user.id },
    data: { privacyMessages: b.messages, privacyRequests: b.requests, privacyOnline: b.online, privacyLastSeen: b.lastSeen, privacyProfile: b.profile },
  });
  logs.security.info({ event: 'security_setting_changed', setting: 'privacy', changed: Object.keys(b), userId: user.id, ip: ipOf(req) }, 'Privacy settings changed');
  if (b.online || b.lastSeen) await broadcastPresence(user.id);
  res.json({ user: toSelf(user) });
}));

settingsRouter.patch('/ui', ah(async (req, res) => {
  const b = parse(uiSettingsSchema.partial(), req.body);
  const user = await prisma.user.update({ where: { id: req.auth!.user.id }, data: { uiSettings: { ...parseUi(req.auth!.user.uiSettings), ...b } } });
  res.json({ user: toSelf(user) });
}));

settingsRouter.patch('/notifications', ah(async (req, res) => {
  const b = parse(notifSettingsSchema.partial().extend({ categories: notifSettingsSchema.shape.categories.removeDefault().partial().optional() }), req.body);
  const cur = parseNotif(req.auth!.user.notifSettings);
  const next = { ...cur, ...b, categories: { ...cur.categories, ...(b.categories ?? {}) } };
  const user = await prisma.user.update({ where: { id: req.auth!.user.id }, data: { notifSettings: next } });
  res.json({ user: toSelf(user) });
}));
