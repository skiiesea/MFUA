/**
 * Безопасное создание первого администратора.
 * Запуск: npm run create-admin
 * Пароль вводится скрыто в терминале и нигде не сохраняется, кроме БД (Argon2id).
 */
import readline from 'node:readline';
import { Writable } from 'node:stream';
import { logs } from '../lib/logger';
import { prisma } from '../lib/prisma';
import { displayNameSchema, emailSchema, usernameSchema } from '../lib/validation';
import { hashPassword, passwordProblems } from '../modules/auth/password';

let muted = false;
const out = new Writable({
  write(chunk, enc, cb) {
    if (!muted) process.stdout.write(chunk, enc);
    cb();
  },
});
const rl = readline.createInterface({ input: process.stdin, output: out, terminal: true });

const ask = (q: string, hidden = false) =>
  new Promise<string>((resolve) => {
    process.stdout.write(q);
    muted = hidden;
    rl.question('', (a) => {
      muted = false;
      if (hidden) process.stdout.write('\n');
      resolve(a.trim());
    });
  });

async function main() {
  console.log('\n  Vesper — создание администратора\n');
  const username = usernameSchema.parse(await ask('  Логин: '));
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    const yes = (await ask(`  Пользователь @${username} уже есть. Назначить администратором? (y/N): `)).toLowerCase();
    if (yes !== 'y') return console.log('  Отменено.');
    const role = username === 'root_admin' ? 'ROOT_ADMIN' : 'ADMIN';
    await prisma.user.update({ where: { id: existing.id }, data: { role } });
    logs.security.warn({ event: 'admin_promoted', userId: existing.id, via: 'cli' }, 'User promoted to admin via CLI');
    return console.log(`  Готово: @${username} теперь ${role === 'ROOT_ADMIN' ? 'root_admin' : 'администратор'}.`);
  }
  const displayName = displayNameSchema.parse(await ask('  Отображаемое имя: '));
  const email = emailSchema.parse(await ask('  Email: '));
  const password = await ask('  Пароль: ', true);
  const confirm = await ask('  Повторите пароль: ', true);
  if (password !== confirm) throw new Error('Пароли не совпадают');
  const problems = passwordProblems(password, { username, email });
  if (problems.length) throw new Error(problems.join('; '));
  const role = username === 'root_admin' ? 'ROOT_ADMIN' : 'ADMIN';
  const user = await prisma.user.create({
    data: { username, displayName, email, passwordHash: await hashPassword(password), role, emailVerifiedAt: new Date() },
  });
  logs.security.warn({ event: 'admin_created', userId: user.id, via: 'cli' }, 'Administrator account created via CLI');
  console.log(`\n  Готово: ${role === 'ROOT_ADMIN' ? 'владелец системы' : 'администратор'} @${username} создан. Войдите на сайте и откройте раздел «Админ».\n`);
}

main()
  .catch((e) => {
    console.error('\n  Ошибка:', e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(async () => {
    rl.close();
    await prisma.$disconnect();
    setTimeout(() => process.exit(), 400);
  });
