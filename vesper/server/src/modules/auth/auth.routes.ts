import { Prisma, type User } from '@prisma/client';
import type { Request, Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import { env } from '../../config/env';
import { sha256, signTicket, verifyTicket } from '../../lib/crypto';
import { AppError, badRequest, conflict, tooMany, unauthorized } from '../../lib/errors';
import { ah, ipOf, parse, uaOf } from '../../lib/http';
import { logs } from '../../lib/logger';
import { prisma } from '../../lib/prisma';
import { toSelf } from '../../lib/serialize';
import { displayNameSchema, emailSchema, usernameSchema } from '../../lib/validation';
import { requireAuth } from '../../middleware/auth';
import { availabilityLimiter, emailLimiter, loginLimiter, registerLimiter, twoFaLimiter } from '../../middleware/rateLimit';
import { notify } from '../notifications/notifications.service';
import { issueEmailToken, issueEmailVerificationCode } from './emailTokens';
import { dummyVerify, hashPassword, needsRehash, passwordProblems, verifyPassword } from './password';
import { clearSessionCookie, createSession, deviceLabel, revokeSession, setSessionCookie } from './session.service';
import { verifySecondFactor } from './totp.service';

export const authRouter = Router();

const MAX_FAILS = 5;
const LOCK_MS = 15 * 60_000;
const invalidCreds = () => new AppError(401, 'INVALID_CREDENTIALS', 'Неверный логин или пароль');

async function recordLogin(userId: string | null, success: boolean, reason: string, req: Request) {
  await prisma.loginEvent
    .create({ data: { userId, success, reason, ip: ipOf(req), device: deviceLabel(uaOf(req)) } })
    .catch((err) => logs.errors.error({ event: 'login_event_failed', err }, 'Failed to store login event'));
}

async function registerFailure(user: User, req: Request, reason: string) {
  const count = user.failedLoginCount + 1;
  const lock = count >= MAX_FAILS;
  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginCount: lock ? 0 : count, lockedUntil: lock ? new Date(Date.now() + LOCK_MS) : undefined },
  });
  await recordLogin(user.id, false, reason, req);
  logs.auth.warn({ event: 'login_failed', reason, userId: user.id, ip: ipOf(req), attempt: count }, 'Failed login attempt');
  if (lock) {
    logs.security.warn({ event: 'account_locked', userId: user.id, ip: ipOf(req), minutes: LOCK_MS / 60_000 }, 'Account temporarily locked after repeated failures');
    await notify(user.id, 'SECURITY', {
      title: 'Вход временно заблокирован',
      body: 'Было несколько неудачных попыток входа в ваш аккаунт. Вход заблокирован на 15 минут. Если это были не вы — смените пароль.',
    }).catch(() => {});
  }
}

async function completeLogin(req: Request, res: Response, user: User, remember: boolean, method: 'password' | '2fa' | 'backup') {
  const data: Prisma.UserUpdateInput = { failedLoginCount: 0, lockedUntil: null, lastSeenAt: new Date() };
  const pw = (req.body as { password?: string } | undefined)?.password;
  if (method === 'password' && typeof pw === 'string' && needsRehash(user.passwordHash)) data.passwordHash = await hashPassword(pw);
  const updated = await prisma.user.update({ where: { id: user.id }, data });
  const { token, session } = await createSession(user.id, req, remember);
  setSessionCookie(res, token, remember);
  await recordLogin(user.id, true, method, req);
  logs.auth.info({ event: 'login_success', userId: user.id, sessionId: session.id, method, ip: ipOf(req), remember }, 'Successful login');
  res.json({ user: toSelf(updated) });
}

// ── Регистрация ─────────────────────────────────────────────
authRouter.post('/register', registerLimiter, ah(async (req, res) => {
  const body = parse(
    z.object({
      username: usernameSchema,
      displayName: displayNameSchema,
      email: emailSchema,
      password: z.string({ error: 'Введите пароль' }).max(128),
      passwordConfirm: z.string(),
    }),
    req.body,
  );
  if (body.password !== body.passwordConfirm) throw new AppError(400, 'VALIDATION', 'Пароли не совпадают', { passwordConfirm: 'Пароли не совпадают' });
  const problems = passwordProblems(body.password, body);
  if (problems.length) throw new AppError(400, 'VALIDATION', problems[0], { password: problems[0] });

  const [u, e] = await Promise.all([
    prisma.user.findUnique({ where: { username: body.username }, select: { id: true } }),
    prisma.user.findUnique({ where: { email: body.email }, select: { id: true } }),
  ]);
  const fields: Record<string, string> = {};
  if (u) fields.username = 'Этот логин уже занят';
  if (e) fields.email = 'Этот email уже зарегистрирован';
  if (Object.keys(fields).length) throw conflict('Проверьте введённые данные', fields);

  let user: User;
  try {
    user = await prisma.user.create({
      data: {
        username: body.username,
        displayName: body.displayName,
        email: body.email,
        passwordHash: await hashPassword(body.password),
        emailVerifiedAt: env.REQUIRE_EMAIL_VERIFICATION ? null : new Date(),
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') throw conflict('Логин или email уже заняты');
    throw err;
  }
  if (env.REQUIRE_EMAIL_VERIFICATION) {
    if (env.NODE_ENV === 'development') await issueEmailVerificationCode(user, user.email);
    else await issueEmailToken(user, 'VERIFY', user.email);
  }
  logs.auth.info({ event: 'register', userId: user.id, username: user.username, ip: ipOf(req) }, 'New account registered');
  res.status(201).json({ needsVerification: env.REQUIRE_EMAIL_VERIFICATION, verificationMethod: env.NODE_ENV === 'development' ? 'code' : 'link' });
}));

authRouter.get('/availability', availabilityLimiter, ah(async (req, res) => {
  const q = parse(z.object({ username: usernameSchema.optional(), email: emailSchema.optional() }), req.query);
  const [u, e] = await Promise.all([
    q.username ? prisma.user.findUnique({ where: { username: q.username }, select: { id: true } }) : null,
    q.email ? prisma.user.findUnique({ where: { email: q.email }, select: { id: true } }) : null,
  ]);
  res.json({ username: q.username ? !u : undefined, email: q.email ? !e : undefined });
}));

// ── Подтверждение email ─────────────────────────────────────
authRouter.post('/verify-email', emailLimiter, ah(async (req, res) => {
  const { token } = parse(z.object({ token: z.string().min(10).max(200) }), req.body);
  const t = await prisma.emailToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!t || t.usedAt || t.expiresAt < new Date()) throw badRequest('Ссылка недействительна или устарела. Запросите новое письмо.', 'INVALID_TOKEN');
  try {
    await prisma.$transaction([
      prisma.user.update({ where: { id: t.userId }, data: t.type === 'VERIFY' ? { emailVerifiedAt: new Date() } : { email: t.email, emailVerifiedAt: new Date() } }),
      prisma.emailToken.update({ where: { id: t.id }, data: { usedAt: new Date() } }),
    ]);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') throw conflict('Этот email уже используется другим аккаунтом');
    throw err;
  }
  logs.auth.info({ event: t.type === 'VERIFY' ? 'email_verified' : 'email_changed', userId: t.userId, ip: ipOf(req) }, 'Email confirmed');
  if (t.type === 'EMAIL_CHANGE') await notify(t.userId, 'SECURITY', { title: 'Email изменён', body: 'Адрес электронной почты вашего аккаунта был изменён.' }).catch(() => {});
  res.json({ ok: true, type: t.type });
}));

authRouter.post('/verify-email-code', emailLimiter, ah(async (req, res) => {
  const { email, code } = parse(
    z.object({
      email: emailSchema,
      code: z.string().regex(/^\d{6}$/, 'Введите шестизначный код'),
    }),
    req.body,
  );
  const token = await prisma.emailToken.findUnique({ where: { tokenHash: sha256(code) } });
  const now = new Date();
  if (!token || token.type !== 'VERIFY' || token.email.toLowerCase() !== email.toLowerCase() || token.usedAt || token.expiresAt <= now) {
    throw badRequest('Код недействителен или истёк. Запросите новый код.', 'INVALID_CODE');
  }

  await prisma.$transaction(async (tx) => {
    const consumed = await tx.emailToken.updateMany({
      where: { id: token.id, type: 'VERIFY', usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    if (consumed.count !== 1) throw badRequest('Код недействителен или уже использован. Запросите новый код.', 'INVALID_CODE');
    await tx.user.update({ where: { id: token.userId }, data: { emailVerifiedAt: now } });
  });

  logs.auth.info({ event: 'email_verified', userId: token.userId, ip: ipOf(req) }, 'Email confirmed with verification code');
  res.json({ ok: true, type: 'VERIFY' });
}));

authRouter.post('/resend-verification', emailLimiter, ah(async (req, res) => {
  const { identifier } = parse(z.object({ identifier: z.string().trim().min(1).max(254) }), req.body);
  const idf = identifier.toLowerCase();
  const user = await prisma.user.findFirst({ where: idf.includes('@') ? { email: idf } : { username: idf } });
  if (user && !user.emailVerifiedAt) {
    const last = await prisma.emailToken.findFirst({ where: { userId: user.id, type: 'VERIFY' }, orderBy: { createdAt: 'desc' } });
    if (!last || Date.now() - last.createdAt.getTime() > 60_000) {
      if (env.NODE_ENV === 'development') await issueEmailVerificationCode(user, user.email);
      else await issueEmailToken(user, 'VERIFY', user.email);
    }
  }
  res.json({ ok: true }); // одинаковый ответ — не раскрываем, существует ли аккаунт
}));

// ── Вход ────────────────────────────────────────────────────
authRouter.post('/login', loginLimiter, ah(async (req, res) => {
  const { identifier, password, remember } = parse(
    z.object({ identifier: z.string().trim().min(1, 'Введите логин или email').max(254), password: z.string().min(1, 'Введите пароль').max(128), remember: z.boolean().optional() }),
    req.body,
  );
  const idf = identifier.toLowerCase();
  const user = await prisma.user.findFirst({ where: idf.includes('@') ? { email: idf } : { username: idf } });
  if (!user) {
    await dummyVerify(password);
    // идентификатор намеренно не пишем: часто туда по ошибке вводят пароль
    logs.auth.warn({ event: 'login_failed', reason: 'unknown_user', ip: ipOf(req) }, 'Failed login attempt');
    await recordLogin(null, false, 'unknown_user', req);
    throw invalidCreds();
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    logs.security.warn({ event: 'login_while_locked', userId: user.id, ip: ipOf(req) }, 'Login attempt on locked account');
    await recordLogin(user.id, false, 'locked', req);
    const mins = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
    throw tooMany(`Слишком много неудачных попыток. Повторите через ${mins} мин.`);
  }
  if (!(await verifyPassword(user.passwordHash, password))) {
    await registerFailure(user, req, 'bad_password');
    throw invalidCreds();
  }
  if (user.bannedAt) {
    logs.security.warn({ event: 'login_banned', userId: user.id, ip: ipOf(req) }, 'Banned user tried to sign in');
    await recordLogin(user.id, false, 'banned', req);
    throw new AppError(403, 'BANNED', `Аккаунт заблокирован${user.banReason ? `: ${user.banReason}` : ''}`);
  }
  if (env.REQUIRE_EMAIL_VERIFICATION && !user.emailVerifiedAt) {
    await recordLogin(user.id, false, 'email_not_verified', req);
    throw new AppError(403, 'EMAIL_NOT_VERIFIED', 'Подтвердите email с помощью кода, отправленного при регистрации.');
  }
  if (user.totpEnabledAt) {
    res.json({ twoFactorRequired: true, ticket: signTicket({ uid: user.id, rem: !!remember, p: '2fa' }, 300) });
    return;
  }
  await completeLogin(req, res, user, !!remember, 'password');
}));

authRouter.post('/login/2fa', twoFaLimiter, ah(async (req, res) => {
  const { ticket, code } = parse(z.object({ ticket: z.string().min(10).max(600), code: z.string().trim().min(6, 'Введите код').max(20) }), req.body);
  const t = verifyTicket<{ uid: string; rem: boolean; p: string }>(ticket);
  if (!t || t.p !== '2fa') throw unauthorized('Время входа истекло. Введите логин и пароль заново.');
  const user = await prisma.user.findUnique({ where: { id: t.uid } });
  if (!user || !user.totpEnabledAt || user.bannedAt) throw unauthorized();
  if (user.lockedUntil && user.lockedUntil > new Date()) throw tooMany('Слишком много неудачных попыток. Повторите позже.');
  const r = await verifySecondFactor(user, code);
  if (!r.ok) {
    logs.auth.warn({ event: '2fa_failed', userId: user.id, method: r.method, ip: ipOf(req) }, 'Two-factor verification failed');
    await registerFailure(user, req, '2fa_failed');
    throw new AppError(401, 'INVALID_CODE', 'Неверный код. Проверьте время на телефоне или используйте резервный код.');
  }
  logs.auth.info({ event: '2fa_verified', userId: user.id, method: r.method, ip: ipOf(req) }, 'Two-factor verification passed');
  if (r.method === 'backup') await notify(user.id, 'SECURITY', { title: 'Использован резервный код', body: 'Для входа в аккаунт использовали один из резервных кодов 2FA.' }).catch(() => {});
  await completeLogin(req, res, user, t.rem, r.method === 'backup' ? 'backup' : '2fa');
}));

authRouter.post('/logout', requireAuth, ah(async (req, res) => {
  await revokeSession(req.auth!.sessionId);
  clearSessionCookie(res);
  logs.auth.info({ event: 'logout', userId: req.auth!.user.id, sessionId: req.auth!.sessionId, ip: ipOf(req) }, 'User signed out');
  res.json({ ok: true });
}));

authRouter.get('/me', requireAuth, ah(async (req, res) => {
  res.json({ user: toSelf(req.auth!.user) });
}));
