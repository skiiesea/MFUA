import type { RequestHandler } from 'express';
import { logs } from '../lib/logger';

export const accessLogger: RequestHandler = (req, res, next) => {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const url = req.originalUrl.split('?')[0]; // query не пишем: там могут быть поисковые запросы
    if (url.startsWith('/assets/') || url.startsWith('/socket.io')) return;
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    logs.access[level](
      {
        event: 'http_request',
        method: req.method,
        url,
        status: res.statusCode,
        durationMs: Math.round(ms * 10) / 10,
        ip: req.ip,
        userId: req.auth?.user.id,
        bytes: Number(res.getHeader('content-length')) || undefined,
        ua: (req.get('user-agent') ?? '').slice(0, 160),
      },
      `${req.method} ${url} ${res.statusCode}`,
    );
  });
  next();
};
