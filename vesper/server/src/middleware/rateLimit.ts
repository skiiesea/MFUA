import rateLimit from 'express-rate-limit';
import { logs } from '../lib/logger';

export const limiter = (name: string, windowMs: number, limit: number) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (req, res) => {
      logs.security.warn({ event: 'rate_limited', limiter: name, ip: req.ip, path: req.originalUrl.split('?')[0] }, 'Rate limit exceeded');
      res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Слишком много запросов. Подождите немного и повторите.' } });
    },
  });

const MIN = 60_000;
export const globalLimiter = limiter('global', MIN, 900);
export const loginLimiter = limiter('login', 15 * MIN, 25);
export const twoFaLimiter = limiter('2fa', 10 * MIN, 12);
export const registerLimiter = limiter('register', 60 * MIN, 12);
export const emailLimiter = limiter('email', 60 * MIN, 8);
export const sensitiveLimiter = limiter('sensitive', 15 * MIN, 15);
export const searchLimiter = limiter('search', MIN, 60);
export const uploadLimiter = limiter('upload', 10 * MIN, 60);
export const availabilityLimiter = limiter('availability', MIN, 40);
