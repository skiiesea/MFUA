import { randomInt } from 'node:crypto';
import type { EmailTokenType } from '@prisma/client';
import { env, publicUrl } from '../../config/env';
import { randomToken, sha256 } from '../../lib/crypto';
import { mailTemplate, sendMail } from '../../lib/mailer';
import { prisma } from '../../lib/prisma';

export async function issueEmailToken(user: { id: string; displayName: string }, type: EmailTokenType, email: string) {
  const token = randomToken(32);
  await prisma.emailToken.updateMany({ where: { userId: user.id, type, usedAt: null }, data: { usedAt: new Date() } });
  await prisma.emailToken.create({
    data: { userId: user.id, type, email, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 24 * 3_600_000) },
  });
  const link = `${publicUrl}/verify-email?token=${token}`;
  const isChange = type === 'EMAIL_CHANGE';
  const tpl = mailTemplate(
    isChange ? 'Подтвердите новый email' : 'Добро пожаловать в Vesper',
    isChange
      ? `${user.displayName}, подтвердите этот адрес, чтобы использовать его для входа. Ссылка действует 24 часа.`
      : `${user.displayName}, осталось подтвердить email — и можно общаться. Ссылка действует 24 часа.`,
    'Подтвердить email',
    link,
  );
  await sendMail({ to: email, subject: isChange ? 'Подтверждение нового email — Vesper' : 'Подтверждение email — Vesper', ...tpl });
}

/**
 * Development-only email verification. The code is stored as a hash and is
 * printed only to the local development server console, never to application logs.
 */
export async function issueEmailVerificationCode(user: { id: string; displayName: string }, email: string) {
  if (env.NODE_ENV !== 'development') {
    throw new Error('Email verification codes are available only in development');
  }

  const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
  const now = new Date();

  await prisma.emailToken.updateMany({
    where: { userId: user.id, type: 'VERIFY', usedAt: null },
    data: { usedAt: now },
  });
  await prisma.emailToken.create({
    data: {
      userId: user.id,
      type: 'VERIFY',
      email,
      tokenHash: sha256(code),
      expiresAt: new Date(now.getTime() + 5 * 60_000),
    },
  });

  console.log(
    `\n──────── VESPER EMAIL VERIFICATION ────────\nTo: ${email}\nCode: ${code}\nExpires: 5 minutes\n──────────────────────────────────────────\n`,
  );
}
