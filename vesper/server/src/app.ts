import fs from 'node:fs';
import path from 'node:path';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { clientOrigins, env } from './config/env';
import { publicDir } from './lib/storage';
import { accessLogger } from './middleware/accessLog';
import { csrfGuard } from './middleware/csrf';
import { errorHandler, notFoundHandler } from './middleware/error';
import { globalLimiter } from './middleware/rateLimit';
import { accountRouter } from './modules/account/account.routes';
import { adminRouter } from './modules/admin/admin.routes';
import { authRouter } from './modules/auth/auth.routes';
import { chatsRouter } from './modules/chats/chats.routes';
import { filesRouter } from './modules/files/files.routes';
import { blocksRouter, friendsRouter, reportsRouter } from './modules/friends/friends.routes';
import { notificationsRouter } from './modules/notifications/notifications.routes';
import { settingsRouter } from './modules/settings/settings.routes';
import { usersRouter } from './modules/users/users.routes';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY);

  app.use(
    helmet({
      crossOriginEmbedderPolicy: false,
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'img-src': ["'self'", 'data:', 'blob:'],
          'media-src': ["'self'", 'blob:'],
          'connect-src': ["'self'", 'ws:', 'wss:'],
          'font-src': ["'self'", 'data:'],
          'style-src': ["'self'", "'unsafe-inline'"],
          'upgrade-insecure-requests': null,
        },
      },
    }),
  );
  app.use(accessLogger);
  app.use(cors({ origin: clientOrigins, credentials: true }));
  app.use(cookieParser());
  app.use(express.json({ limit: '100kb' }));

  // Публичные медиа (аватары, обложки): имена файлов — случайные токены
  const publicMedia = express.static(publicDir, {
    index: false,
    dotfiles: 'deny',
    maxAge: '30d',
    immutable: true,
    setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff'),
  });
  app.use('/media', publicMedia);
  // Keep public profile images behind the same /api proxy as the frontend API.
  app.use('/api/media', publicMedia);

  app.get('/api/health', (_req, res) => void res.json({ ok: true }));
  app.use('/api', csrfGuard, globalLimiter);
  app.use('/api/auth', authRouter);
  app.use('/api/account', accountRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/friends', friendsRouter);
  app.use('/api/blocks', blocksRouter);
  app.use('/api/reports', reportsRouter);
  app.use('/api/chats', chatsRouter);
  app.use('/api/notifications', notificationsRouter);
  app.use('/api/settings', settingsRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api', filesRouter);
  app.use('/api', notFoundHandler);

  // Раздача собранного фронтенда (npm run build)
  const staticDir = path.resolve(env.STATIC_DIR);
  if (fs.existsSync(path.join(staticDir, 'index.html'))) {
    app.use(express.static(staticDir, { index: false, maxAge: '1h' }));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/media') || req.path.startsWith('/socket.io')) return next();
      res.sendFile(path.join(staticDir, 'index.html'));
    });
  }
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
