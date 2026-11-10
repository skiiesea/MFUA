import fs from 'node:fs';
import path from 'node:path';
import pino from 'pino';
import * as rfs from 'rotating-file-stream';
import { env } from '../config/env';

export const logDir = path.resolve(env.LOG_DIR);
fs.mkdirSync(logDir, { recursive: true, mode: 0o700 });
try {
  fs.chmodSync(logDir, 0o700); // логи доступны только владельцу процесса
} catch {
  /* нет прав на chmod (например, смонтированный том) — не критично */
}

// Никогда не пишем в логи пароли, токены, секреты 2FA, резервные коды и содержимое сообщений.
const SENSITIVE = ['password', 'newPassword', 'currentPassword', 'passwordConfirm', 'token', 'ticket', 'secret', 'code', 'backupCodes', 'text', 'content', 'cookie', 'authorization'];
const redactPaths = [...SENSITIVE, ...SENSITIVE.map((k) => `*.${k}`), 'req.headers.cookie', 'req.headers.authorization'];

function create(name: string, alsoStdout = false) {
  const file = rfs.createStream(`${name}.log`, {
    path: logDir,
    size: env.LOG_MAX_SIZE,
    maxFiles: env.LOG_MAX_FILES,
    compress: 'gzip',
  });
  file.on('error', (e: Error) => console.error(`[logger:${name}]`, e.message));
  const streams: pino.StreamEntry[] = [{ level: 'debug', stream: file }];
  if (alsoStdout) streams.push({ level: 'debug', stream: process.stdout });
  return pino(
  {
    level: env.LOG_LEVEL,
    base: { category: name },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label: string) => ({ level: label.toUpperCase() }),
    },
    serializers: { err: pino.stdSerializers.err },
    redact: { paths: redactPaths, censor: '[REDACTED]' },
  },
  pino.multistream(streams),
);
}

export const logs = {
  app: create('application', true),
  auth: create('auth'),
  security: create('security'),
  errors: create('errors', true),
  access: create('access'),
};

export const LOG_FILES = ['application', 'auth', 'security', 'errors', 'access'] as const;
export type LogFile = (typeof LOG_FILES)[number];
