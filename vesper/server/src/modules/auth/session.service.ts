import type { Request, Response } from 'express';
import { cookieSecure } from '../../config/env';
import { randomToken, sha256 } from '../../lib/crypto';
import { uaOf } from '../../lib/http';
import { logs } from '../../lib/logger';
import { prisma } from '../../lib/prisma';
import { disconnectSession, disconnectUser } from '../../realtime/hub';

export const SESSION_COOKIE = 'vsp_sid';
const DAY = 86_400_000;
const TTL_REMEMBER = 30 * DAY;
const TTL_SHORT = 12 * 3_600_000;

export function deviceLabel(ua = ''): string {
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Браузер';
  const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad|iOS/.test(ua) ? 'iOS' : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'неизвестной ОС';
  return `${browser} на ${os}`;
}

export async function createSession(userId: string, req: Request, remember: boolean) {
  const token = randomToken(32);
  const ua = uaOf(req);
  const session = await prisma.session.create({
    data: {
      userId,
      tokenHash: sha256(token),
      remember,
      userAgent: ua,
      deviceLabel: deviceLabel(ua),
      ip: req.ip,
      expiresAt: new Date(Date.now() + (remember ? TTL_REMEMBER : TTL_SHORT)),
    },
  });
  return { token, session };
}

export function setSessionCookie(res: Response, token: string, remember: boolean) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: cookieSecure,
    path: '/',
    ...(remember ? { maxAge: TTL_REMEMBER } : {}),
  });
}
export function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: 'lax', secure: cookieSecure, path: '/' });
}

export async function validateSession(token: string) {
  const session = await prisma.session.findUnique({ where: { tokenHash: sha256(token) }, include: { user: true } });
  if (!session || session.revokedAt || session.expiresAt < new Date() || session.user.bannedAt) return null;
  const now = Date.now();
  if (now - session.lastUsedAt.getTime() > 60_000) {
    prisma.session
      .update({
        where: { id: session.id },
        data: { lastUsedAt: new Date(), ...(session.remember ? { expiresAt: new Date(now + TTL_REMEMBER) } : {}) },
      })
      .catch((err) => logs.errors.error({ event: 'session_touch_failed', err }, 'Session touch failed'));
  }
  return session;
}

export async function revokeSession(sessionId: string) {
  await prisma.session.updateMany({ where: { id: sessionId, revokedAt: null }, data: { revokedAt: new Date() } });
  disconnectSession(sessionId);
}

export async function revokeOtherSessions(userId: string, exceptId: string) {
  const others = await prisma.session.findMany({ where: { userId, revokedAt: null, id: { not: exceptId } }, select: { id: true } });
  await prisma.session.updateMany({ where: { id: { in: others.map((s) => s.id) } }, data: { revokedAt: new Date() } });
  others.forEach((s) => disconnectSession(s.id));
  return others.length;
}

export async function revokeAllSessions(userId: string) {
  await prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
  disconnectUser(userId);
}
