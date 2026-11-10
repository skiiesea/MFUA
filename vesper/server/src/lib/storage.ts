import fs from 'node:fs/promises';
import path from 'node:path';
import { env } from '../config/env';
import { randomToken } from './crypto';

export const uploadRoot = path.resolve(env.UPLOAD_DIR);
export const publicDir = path.join(uploadRoot, 'public');
export const privateDir = path.join(uploadRoot, 'private');

export async function initStorage() {
  await fs.mkdir(publicDir, { recursive: true });
  await fs.mkdir(privateDir, { recursive: true, mode: 0o700 });
}

const KEY_RE = /^[A-Za-z0-9_-]{8,64}\.[a-z0-9]{2,5}$/;
const safeKey = (key: string) => {
  if (!KEY_RE.test(key)) throw new Error('Invalid storage key');
  return key;
};

export async function savePublic(buf: Buffer, ext = 'webp') {
  const key = `${randomToken(18)}.${ext}`;
  await fs.writeFile(path.join(publicDir, key), buf, { mode: 0o644 });
  return key;
}
export async function savePrivate(buf: Buffer, ext: string) {
  const key = `${randomToken(24)}.${ext}`;
  await fs.writeFile(path.join(privateDir, key), buf, { mode: 0o600 });
  return key;
}
export const privatePath = (key: string) => path.join(privateDir, safeKey(key));
export async function removePublic(key?: string | null) {
  if (key) await fs.rm(path.join(publicDir, safeKey(key)), { force: true }).catch(() => {});
}
export async function removePrivate(key?: string | null) {
  if (key) await fs.rm(path.join(privateDir, safeKey(key)), { force: true }).catch(() => {});
}
