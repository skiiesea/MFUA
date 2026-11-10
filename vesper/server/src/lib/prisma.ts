import { PrismaClient } from '@prisma/client';
import { logs } from './logger';

export const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'error' },
    { emit: 'event', level: 'warn' },
  ],
});

prisma.$on('error', (e) => logs.errors.error({ event: 'db_error', target: e.target }, `Database error: ${e.message}`));
prisma.$on('warn', (e) => logs.app.warn({ event: 'db_warn' }, e.message));
