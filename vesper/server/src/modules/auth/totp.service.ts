import crypto from 'node:crypto';
import type { User } from '@prisma/client';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { decrypt, hmac } from '../../lib/crypto';
import { prisma } from '../../lib/prisma';

authenticator.options = { window: 1, step: 30, digits: 6 };

export const newSecret = () => authenticator.generateSecret(20);

export async function qrFor(accountName: string, secret: string) {
  const uri = authenticator.keyuri(accountName, 'Vesper', secret);
  return QRCode.toDataURL(uri, { margin: 1, width: 240, errorCorrectionLevel: 'M' });
}

/** Проверка TOTP с защитой от повторного использования кода (replay). */
export async function verifyTotp(user: Pick<User, 'id' | 'totpSecretEnc'>, code: string): Promise<boolean> {
  if (!user.totpSecretEnc || !/^\d{6}$/.test(code)) return false;
  const delta = authenticator.checkDelta(code, decrypt(user.totpSecretEnc));
  if (delta === null || delta === undefined) return false;
  const step = Math.floor(Date.now() / 30_000) + delta;
  const r = await prisma.user.updateMany({
    where: { id: user.id, OR: [{ totpLastStep: null }, { totpLastStep: { lt: step } }] },
    data: { totpLastStep: step },
  });
  return r.count === 1;
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const normalize = (c: string) => c.toUpperCase().replace(/[^A-Z0-9]/g, '');

export function generateBackupCodes(n = 10): string[] {
  return Array.from({ length: n }, () => {
    let s = '';
    for (let i = 0; i < 10; i++) s += ALPHABET[crypto.randomInt(ALPHABET.length)];
    return `${s.slice(0, 5)}-${s.slice(5)}`;
  });
}

export async function storeBackupCodes(userId: string, codes: string[]) {
  await prisma.$transaction([
    prisma.backupCode.deleteMany({ where: { userId } }),
    prisma.backupCode.createMany({ data: codes.map((c) => ({ userId, codeHash: hmac('backup:' + normalize(c)) })) }),
  ]);
}

async function consumeBackupCode(userId: string, code: string) {
  const r = await prisma.backupCode.updateMany({
    where: { userId, codeHash: hmac('backup:' + normalize(code)), usedAt: null },
    data: { usedAt: new Date() },
  });
  return r.count === 1;
}

export const backupCodesLeft = (userId: string) => prisma.backupCode.count({ where: { userId, usedAt: null } });

export async function verifySecondFactor(user: User, rawCode: string): Promise<{ ok: boolean; method: 'totp' | 'backup' | 'invalid' }> {
  const code = rawCode.trim();
  if (/^\d{6}$/.test(code)) return { ok: await verifyTotp(user, code), method: 'totp' };
  if (normalize(code).length === 10) return { ok: await consumeBackupCode(user.id, code), method: 'backup' };
  return { ok: false, method: 'invalid' };
}
