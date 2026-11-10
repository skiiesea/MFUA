import http from 'node:http';
import { createApp } from './app';
import { env } from './config/env';
import { startJobs, stopJobs } from './lib/jobs';
import { logs } from './lib/logger';
import { prisma } from './lib/prisma';
import { initStorage } from './lib/storage';
import { getIo } from './realtime/hub';
import { initSocket } from './realtime/socket';

async function main() {
  await initStorage();
  await prisma.$connect();
  const server = http.createServer(createApp());
  initSocket(server);
  startJobs();

  server.listen(env.PORT, () => {
    logs.app.info({ event: 'server_start', port: env.PORT, env: env.NODE_ENV }, `Vesper server started on :${env.PORT}`);
  });

  let stopping = false;
  const shutdown = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    logs.app.info({ event: 'server_stop', signal }, 'Vesper server stopping');
    stopJobs();
    getIo()?.close();
    server.close();
    await prisma.$disconnect().catch(() => {});
    setTimeout(() => process.exit(0), 400);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

process.on('unhandledRejection', (reason) => {
  logs.errors.error({ event: 'unhandled_rejection', err: reason instanceof Error ? reason : new Error(String(reason)) }, 'Unhandled promise rejection');
});
process.on('uncaughtException', (err) => {
  logs.errors.error({ event: 'uncaught_exception', err }, 'Uncaught exception');
  setTimeout(() => process.exit(1), 400);
});

main().catch((err) => {
  logs.errors.error({ event: 'startup_failed', err }, 'Failed to start server');
  setTimeout(() => process.exit(1), 400);
});
