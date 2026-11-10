import type { User } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { encrypt } from '../../lib/crypto';
import { AppError, badRequest, conflict, forbidden, notFound } from '../../lib/errors';
import { ah, ipOf, parse } from '../../lib/http';
import { logs } from '../../lib/logger';
import { prisma } from '../../lib/prisma';
import { emailSchema } from '../../lib/validation';
import { requireAuth } from '../../middleware/auth';
import { sensitiveLimiter } from '../../middleware/rateLimit';
import { issueEmailToken } from '../auth/emailTokens';
import { hashPassword, passwordProblems, verifyPassword } from '../auth/password';
import { revokeOtherSessions, revokeSession } from '../auth/session.service';
import { backupCodesLeft, generateBackupCodes, newSecret, qrFor, storeBackupCodes, verifySecondFactor, verifyTotp } from '../auth/totp.service';
import { notify } from '../notifications/notifications.service';

export const accountRouter = Router();
accountRouter.use(requireAuth);

async function confirmPassword(user: User, password: string, req: { ip?: string }, action: string) {
  if (!(await verifyPassword(user.passwordHash, password))) {
    logs.security.warn({ event: 'sensitive_action_bad_password', action, userId: user.id, ip: req.ip }, 'Wrong password for sensitive action');
    throw new AppError(403, 'INVALID_PASSWORD', 'Неверный пароль', { password: 'Неверный пароль' });
  }
}
const passwordField = z.string().min(1, 'Введите пароль').max(128);

// ── Пароль и email ──────────────────────────────────────────
accountRouter.post('/password', sensitiveLimiter, ah(async (req, res) => {
  const user = req.auth!.user;
  const b = parse(z.object({ currentPassword: passwordField, newPassword: z.string().max(128), newPasswordConfirm: z.string() }), req.body);
  await confirmPassword(user, b.currentPassword, req, 'change_password');
  if (b.newPassword !== b.newPasswordConfirm) throw new AppError(400, 'VALIDATION', 'Пароли не совпадают', { newPasswordConfirm: 'Пароли не совпадают' });
  const problems = passwordProblems(b.newPassword, user);
  if (problems.length) throw new AppError(400, 'VALIDATION', problems[0], { newPassword: problems[0] });
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(b.newPassword) } });
  const closed = await revokeOtherSessions(user.id, req.auth!.sessionId);
  logs.auth.info({ event: 'password_changed', userId: user.id, ip: ipOf(req), sessionsClosed: closed }, 'Password changed');
  logs.security.info({ event: 'security_setting_changed', setting: 'password', userId: user.id }, 'Password changed; other sessions revoked');
  await notify(user.id, 'SECURITY', { title: 'Пароль изменён', body: 'Пароль вашего аккаунта изменён. Остальные устройства отключены.' });
  res.json({ ok: true, sessionsClosed: closed });
}));

accountRouter.post('/email', sensitiveLimiter, ah(async (req, res) => {
  const user = req.auth!.user;
  const b = parse(z.object({ password: passwordField, newEmail: emailSchema }), req.body);
  await confirmPassword(user, b.password, req, 'change_email');
  if (b.newEmail === user.email) throw new AppError(400, 'VALIDATION', 'Это ваш текущий email', { newEmail: 'Это ваш текущий email' });
  if (await prisma.user.findUnique({ where: { email: b.newEmail }, select: { id: true } })) throw conflict('Этот email уже используется', { newEmail: 'Этот email уже используется' });
  await issueEmailToken(user, 'EMAIL_CHANGE', b.newEmail);
  logs.security.info({ event: 'email_change_requested', userId: user.id, ip: ipOf(req) }, 'Email change requested');
  await notify(user.id, 'SECURITY', { title: 'Запрошена смена email', body: 'Мы отправили письмо для подтверждения на новый адрес. Пока ссылка не открыта, email не меняется.' });
  res.json({ ok: true });
}));

// ── Сессии и история входов ─────────────────────────────────
accountRouter.get('/sessions', ah(async (req, res) => {
  const rows = await prisma.session.findMany({
    where: { userId: req.auth!.user.id, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { lastUsedAt: 'desc' },
  });
  res.json({
    sessions: rows.map((s) => ({ id: s.id, device: s.deviceLabel ?? 'Неизвестное устройство', ip: s.ip, createdAt: s.createdAt, lastUsedAt: s.lastUsedAt, remember: s.remember, current: s.id === req.auth!.sessionId })),
  });
}));

accountRouter.post('/sessions/revoke-others', ah(async (req, res) => {
  const n = await revokeOtherSessions(req.auth!.user.id, req.auth!.sessionId);
  logs.security.info({ event: 'sessions_revoked', scope: 'others', count: n, userId: req.auth!.user.id, ip: ipOf(req) }, 'Other sessions revoked');
  res.json({ ok: true, closed: n });
}));

accountRouter.delete('/sessions/:id', ah(async (req, res) => {
  const s = await prisma.session.findFirst({ where: { id: req.params.id, userId: req.auth!.user.id, revokedAt: null } });
  if (!s) throw notFound('Сессия не найдена');
  await revokeSession(s.id);
  logs.security.info({ event: 'session_revoked', sessionId: s.id, userId: req.auth!.user.id, ip: ipOf(req) }, 'Session revoked by user');
  res.json({ ok: true, current: s.id === req.auth!.sessionId });
}));

accountRouter.get('/login-history', ah(async (req, res) => {
  const rows = await prisma.loginEvent.findMany({ where: { userId: req.auth!.user.id }, orderBy: { createdAt: 'desc' }, take: 50 });
  res.json({ events: rows.map((e) => ({ id: e.id, success: e.success, reason: e.reason, ip: e.ip, device: e.device, createdAt: e.createdAt })) });
}));

// ── Двухфакторная аутентификация ────────────────────────────
accountRouter.get('/2fa', ah(async (req, res) => {
  const u = req.auth!.user;
  res.json({ enabled: !!u.totpEnabledAt, enabledAt: u.totpEnabledAt, backupCodesLeft: u.totpEnabledAt ? await backupCodesLeft(u.id) : 0 });
}));

accountRouter.post('/2fa/setup', sensitiveLimiter, ah(async (req, res) => {
  const user = req.auth!.user;
  const { password } = parse(z.object({ password: passwordField }), req.body);
  if (user.totpEnabledAt) throw badRequest('2FA уже включена', 'ALREADY_ENABLED');
  await confirmPassword(user, password, req, '2fa_setup');
  const secret = newSecret();
  await prisma.user.update({ where: { id: user.id }, data: { totpSecretEnc: encrypt(secret), totpLastStep: null } });
  res.json({ qr: await qrFor(user.username, secret), secret });
}));

accountRouter.post('/2fa/enable', sensitiveLimiter, ah(async (req, res) => {
  const user = req.auth!.user;
  const { code } = parse(z.object({ code: z.string().trim().regex(/^\d{6}$/, 'Введите 6 цифр') }), req.body);
  if (user.totpEnabledAt) throw badRequest('2FA уже включена', 'ALREADY_ENABLED');
  if (!user.totpSecretEnc) throw badRequest('Сначала начните настройку 2FA');
  if (!(await verifyTotp(user, code))) throw new AppError(400, 'INVALID_CODE', 'Неверный код. Проверьте время на телефоне.', { code: 'Неверный код' });
  const codes = generateBackupCodes();
  await prisma.user.update({ where: { id: user.id }, data: { totpEnabledAt: new Date() } });
  await storeBackupCodes(user.id, codes);
  logs.auth.info({ event: '2fa_enabled', userId: user.id, ip: ipOf(req) }, 'Two-factor authentication enabled');
  logs.security.info({ event: 'security_setting_changed', setting: '2fa', value: 'enabled', userId: user.id }, '2FA enabled');
  await notify(user.id, 'SECURITY', { title: 'Двухфакторная защита включена', body: 'Теперь при входе нужен код из приложения-аутентификатора.' });
  res.json({ ok: true, backupCodes: codes });
}));

accountRouter.post('/2fa/disable', sensitiveLimiter, ah(async (req, res) => {
  const user = req.auth!.user;
  const b = parse(z.object({ password: passwordField, code: z.string().trim().min(6).max(20) }), req.body);
  if (!user.totpEnabledAt) throw badRequest('2FA не включена');
  await confirmPassword(user, b.password, req, '2fa_disable');
  if (!(await verifySecondFactor(user, b.code)).ok) throw new AppError(400, 'INVALID_CODE', 'Неверный код', { code: 'Неверный код' });
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { totpSecretEnc: null, totpEnabledAt: null, totpLastStep: null } }),
    prisma.backupCode.deleteMany({ where: { userId: user.id } }),
  ]);
  logs.auth.info({ event: '2fa_disabled', userId: user.id, ip: ipOf(req) }, 'Two-factor authentication disabled');
  logs.security.warn({ event: 'security_setting_changed', setting: '2fa', value: 'disabled', userId: user.id }, '2FA disabled');
  await notify(user.id, 'SECURITY', { title: 'Двухфакторная защита отключена', body: 'Если это были не вы — немедленно смените пароль.' });
  res.json({ ok: true });
}));

accountRouter.post('/2fa/backup-codes', sensitiveLimiter, ah(async (req, res) => {
  const user = req.auth!.user;
  const b = parse(z.object({ password: passwordField, code: z.string().trim().min(6).max(20) }), req.body);
  if (!user.totpEnabledAt) throw forbidden('Сначала включите 2FA');
  await confirmPassword(user, b.password, req, '2fa_regen_codes');
  if (!(await verifySecondFactor(user, b.code)).ok) throw new AppError(400, 'INVALID_CODE', 'Неверный код', { code: 'Неверный код' });
  const codes = generateBackupCodes();
  await storeBackupCodes(user.id, codes);
  logs.auth.info({ event: '2fa_backup_codes_regenerated', userId: user.id, ip: ipOf(req) }, 'Backup codes regenerated');
  await notify(user.id, 'SECURITY', { title: 'Резервные коды обновлены', body: 'Старые резервные коды больше не действуют.' });
  res.json({ ok: true, backupCodes: codes });
}));

