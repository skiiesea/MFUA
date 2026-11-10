import { z } from 'zod';
import { colorSchema } from './validation';

export const uiSettingsSchema = z.object({
  theme: z.enum(['dark', 'light', 'system']).default('dark'),
  accent: colorSchema.default('#8f7bff'),
  scale: z.number().int().min(85).max(125).default(100),
});
export type UiSettings = z.infer<typeof uiSettingsSchema>;

export const notifSettingsSchema = z.object({
  sound: z.boolean().default(true),
  volume: z.number().int().min(0).max(100).default(60),
  tone: z.enum(['soft', 'bell', 'pop']).default('soft'),
  categories: z
    .object({
      message: z.boolean().default(true),
      friendRequest: z.boolean().default(true),
      friendAccepted: z.boolean().default(true),
      mention: z.boolean().default(true),
      security: z.boolean().default(true),
    })
    .default({}),
});
export type NotifSettings = z.infer<typeof notifSettingsSchema>;

export const parseUi = (v: unknown): UiSettings => {
  const r = uiSettingsSchema.safeParse(v ?? {});
  return r.success ? r.data : uiSettingsSchema.parse({});
};
export const parseNotif = (v: unknown): NotifSettings => {
  const r = notifSettingsSchema.safeParse(v ?? {});
  return r.success ? r.data : notifSettingsSchema.parse({});
};
