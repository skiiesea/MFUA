import type { RequestHandler } from 'express';
import { allowedOrigins } from '../config/env';
import { AppError } from '../lib/errors';
import { logs } from '../lib/logger';

/**
 * Защита от CSRF: SameSite=Lax cookie + проверка Origin + обязательный нестандартный заголовок
 * (браузер не отправит его с чужого сайта без CORS-preflight, который сервер не разрешает).
 */
export const csrfGuard: RequestHandler = (req, _res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
  const origin = req.get('origin');
  const sameHost = origin && origin === `${req.protocol}://${req.get('host')}`;
  if (origin && !allowedOrigins.has(origin) && !sameHost) {
    logs.security.warn({ event: 'csrf_origin_rejected', origin, ip: req.ip, path: req.originalUrl.split('?')[0] }, 'Origin rejected');
    return next(new AppError(403, 'CSRF', 'Запрос отклонён'));
  }
  if (req.get('x-requested-with') !== 'vesper') {
    logs.security.warn({ event: 'csrf_header_missing', ip: req.ip, path: req.originalUrl.split('?')[0] }, 'Missing CSRF header');
    return next(new AppError(403, 'CSRF', 'Запрос отклонён'));
  }
  next();
};
