#!/usr/bin/env node
// Диагностика окружения: npm run doctor. Работает даже при сломанной установке (использует только Node).
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const serverDir = path.join(root, 'server');
const webDir = path.join(root, 'web');
let problems = 0;
const ok = (m) => console.log(`  ✔ ${m}`);
const warn = (m) => console.log(`  ! ${m}`);
const bad = (m, fix) => {
  problems++;
  console.log(`  ✖ ${m}${fix ? `\n      → ${fix}` : ''}`);
};
const section = (t) => console.log(`\n${t}`);

/** Ищет пакет в node_modules рабочей папки и корня (npm workspaces поднимает зависимости в корень). */
function findPkg(name, from) {
  for (const base of [path.join(from, 'node_modules'), path.join(root, 'node_modules')]) {
    const dir = path.join(base, name);
    if (fs.existsSync(path.join(dir, 'package.json'))) return dir;
  }
  return null;
}

const REINSTALL = 'Переустановите: удалите node_modules (корень, server, web) и package-lock.json, затем npm install';

console.log('Vesper doctor');

section('Node.js');
const major = Number(process.versions.node.split('.')[0]);
if (major < 20) bad(`Node ${process.versions.node} слишком старая`, 'Нужна Node 20+, лучше LTS 22 (https://nodejs.org)');
else if (major > 24) warn(`Node ${process.versions.node}: очень новая версия. Если npm install падает на argon2/sharp/prisma, поставьте LTS 22`);
else ok(`Node ${process.versions.node}`);

section('Зависимости server');
const serverPkgs = ['tsx', 'prisma', '@prisma/client', 'express', 'socket.io', 'zod', 'pino', 'rotating-file-stream', 'otplib', 'qrcode', 'nodemailer', 'multer', 'helmet', 'cookie', 'cookie-parser', 'cors', 'dotenv', 'express-rate-limit', 'argon2', 'sharp'];
const missingServer = serverPkgs.filter((p) => !findPkg(p, serverDir));
if (missingServer.length) bad(`Не установлено пакетов: ${missingServer.length} из ${serverPkgs.length} (${missingServer.join(', ')})`, REINSTALL);
else ok('Все пакеты на месте');

const tsx = findPkg('tsx', serverDir);
if (tsx) {
  if (fs.existsSync(path.join(tsx, 'dist', 'cli.mjs'))) ok('tsx установлен целиком');
  else bad('tsx установлен не полностью (нет dist/cli.mjs): именно эта ошибка у create-admin', REINSTALL);
}

section('Нативные модули');
const req = createRequire(path.join(serverDir, 'package.json'));
for (const m of ['argon2', 'sharp']) {
  if (!findPkg(m, serverDir)) continue;
  try {
    req(m);
    ok(`${m} загружается`);
  } catch (e) {
    bad(`${m} не загружается: ${String(e.message).split('\n')[0]}`, `npm rebuild ${m}; если не помогло, используйте Node 22 LTS`);
  }
}

const client = findPkg('@prisma/client', serverDir);
if (client) {
  const generated = path.resolve(client, '..', '..', '.prisma', 'client', 'index.js');
  if (fs.existsSync(generated)) ok('Prisma Client сгенерирован');
  else warn('Prisma Client ещё не сгенерирован: это произойдёт при npm run dev / create-admin (или npm run db:generate)');
}

section('Зависимости web');
const webPkgs = ['vite', '@vitejs/plugin-react', 'react', 'react-dom', 'react-router-dom', 'zustand', 'framer-motion', 'lucide-react', 'socket.io-client', 'tailwindcss', 'postcss', 'autoprefixer'];
const missingWeb = webPkgs.filter((p) => !findPkg(p, webDir));
if (missingWeb.length) bad(`Не установлено: ${missingWeb.join(', ')}`, REINSTALL);
else ok('Все пакеты на месте');

section('Конфигурация server/.env');
const envPath = path.join(serverDir, '.env');
let dbUrl = null;
if (!fs.existsSync(envPath)) bad('Файл server/.env не найден', 'npm run setup');
else {
  const env = {};
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  if (!env.DATABASE_URL) bad('DATABASE_URL не задан');
  else { ok('DATABASE_URL задан'); dbUrl = env.DATABASE_URL; }
  if (!env.APP_SECRET || env.APP_SECRET.length < 32) bad('APP_SECRET короче 32 символов или пуст', 'Удалите server/.env и выполните npm run setup (или впишите свой секрет)');
  else ok('APP_SECRET в порядке');
  if (!env.ENCRYPTION_KEY || Buffer.from(env.ENCRYPTION_KEY, 'base64').length !== 32) bad('ENCRYPTION_KEY пуст или не 32 байта в base64', 'npm run setup (на чистом .env) или node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"');
  else ok('ENCRYPTION_KEY в порядке');
}

section('PostgreSQL');
if (!dbUrl) warn('Пропущено: нет DATABASE_URL');
else {
  let host = 'localhost';
  let port = 5432;
  try {
    const u = new URL(dbUrl);
    host = u.hostname || host;
    port = Number(u.port) || port;
  } catch {
    bad('DATABASE_URL не похож на URL', 'Формат: postgresql://user:password@localhost:5432/vesper?schema=public');
  }
  await new Promise((resolve) => {
    const s = net.connect({ host, port, timeout: 2500 });
    s.once('connect', () => { ok(`Порт ${host}:${port} отвечает`); s.destroy(); resolve(); });
    s.once('timeout', () => { bad(`${host}:${port} не отвечает`, 'Запустите базу: docker compose up -d (Docker Desktop должен быть запущен)'); s.destroy(); resolve(); });
    s.once('error', (e) => { bad(`${host}:${port} недоступен (${e.code ?? e.message})`, 'Запустите базу: docker compose up -d (Docker Desktop должен быть запущен)'); resolve(); });
  });
}

console.log(problems ? `\nНайдено проблем: ${problems}. Исправьте их сверху вниз.\n` : '\nВсё в порядке.\n');
process.exitCode = problems ? 1 : 0;
