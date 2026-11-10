#!/usr/bin/env node
// Создаёт server/.env из примера и подставляет сгенерированные секреты.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const example = path.join(root, 'server', '.env.example');
const target = path.join(root, 'server', '.env');

if (fs.existsSync(target)) {
  console.log('server/.env уже существует — ничего не меняю.');
  process.exit(0);
}
let text = fs.readFileSync(example, 'utf8');
text = text
  .replace(/^APP_SECRET=.*$/m, `APP_SECRET=${crypto.randomBytes(48).toString('base64url')}`)
  .replace(/^ENCRYPTION_KEY=.*$/m, `ENCRYPTION_KEY=${crypto.randomBytes(32).toString('base64')}`);
fs.writeFileSync(target, text, { mode: 0o600 });
console.log('Готово: server/.env создан, секреты сгенерированы.');
console.log('Проверьте DATABASE_URL и (для продакшена) SMTP_*, CLIENT_URL.');
