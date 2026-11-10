import { z } from 'zod';

export const RESERVED = new Set([
  'admin', 'administrator', 'root', 'support', 'help', 'api', 'me', 'settings', 'login', 'register', 'system', 'vesper',
  'moderator', 'mod', 'security', 'null', 'undefined', 'files', 'media', 'user', 'users', 'friends', 'messages', 'search',
  'notifications', 'profile', 'logout', 'static', 'assets',
]);

export const usernameSchema = z
  .string({ required_error: 'Введите логин' })
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,24}$/, 'Логин: 3–24 символа — латиница, цифры и _')
  .refine((v) => !RESERVED.has(v), 'Этот логин зарезервирован');

export const displayNameSchema = z.string({ required_error: 'Введите имя' }).trim().min(1, 'Введите имя').max(40, 'Не более 40 символов');
export const emailSchema = z.string({ required_error: 'Введите email' }).trim().toLowerCase().email('Некорректный email').max(254);
export const colorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Цвет в формате #RRGGBB');
export const idSchema = z.string().min(1).max(40);
