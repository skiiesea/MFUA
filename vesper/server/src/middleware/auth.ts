import type { RequestHandler } from 'express';
import { forbidden, unauthorized } from '../lib/errors';
import { logs } from '../lib/logger';
import { SESSION_COOKIE, validateSession } from '../modules/auth/session.service';

export const requireAuth: RequestHandler = async (req, _res, next) => {
  try {
    const token = req.cookies?.[SESSION_COOKIE];
    if (!token || typeof token !== 'string') throw unauthorized();
    const session = await validateSession(token);
    if (!session) throw unauthorized('Сессия истекла. Войдите снова.');
    req.auth = { user: session.user, sessionId: session.id };
    next();
  } catch (e) {
    next(e);
  }
};

/** Роль берётся из БД при каждом запросе — не из клиента и не из токена. */
export const requireAdmin: RequestHandler = (req, _res, next) => {
  if (req.auth?.user.role !== 'ADMIN' && req.auth?.user.role !== 'ROOT_ADMIN') {
    logs.security.warn({ event: 'admin_access_denied', userId: req.auth?.user.id, ip: req.ip, path: req.originalUrl.split('?')[0] }, 'Non-admin tried to access admin API');
    return next(forbidden('Требуются права администратора'));
  }
  next();
};

/** Самые чувствительные операции доступны только владельцу системы. */
export const requireRootAdmin: RequestHandler = (req, _res, next) => {
  if (req.auth?.user.role !== 'ROOT_ADMIN') {
    logs.security.warn({ event: 'root_admin_access_denied', userId: req.auth?.user.id, ip: req.ip, path: req.originalUrl.split('?')[0] }, 'Non-root admin tried to access root API');
    return next(forbidden('Требуются права root_admin'));
  }
  next();
};
