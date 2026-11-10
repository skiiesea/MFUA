import argon2 from 'argon2';

// Параметры Argon2id по рекомендациям OWASP (19 MiB, 2 прохода)
const opts = { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

export const hashPassword = (password: string) => argon2.hash(password, opts);
export const verifyPassword = (hash: string, password: string) => argon2.verify(hash, password).catch(() => false);
export const needsRehash = (hash: string) => argon2.needsRehash(hash, opts);

let dummyHash: string | null = null;
/** Выравнивает время ответа, когда пользователь не найден (защита от перебора логинов по таймингу). */
export async function dummyVerify(password: string) {
  dummyHash ??= await hashPassword('timing-equalizer-password');
  await argon2.verify(dummyHash, password).catch(() => false);
}

const COMMON = ['password', 'qwerty', 'qwertyuiop', '12345678', '123456789', '1234567890', 'iloveyou', 'admin', 'letmein', 'welcome', 'йцукен', 'пароль'];

export function passwordProblems(pw: string, ctx: { username?: string; email?: string } = {}): string[] {
  const problems: string[] = [];
  if (pw.length < 10) problems.push('Минимум 10 символов');
  if (pw.length > 128) problems.push('Не более 128 символов');
  const classes = [/[a-zа-яё]/, /[A-ZА-ЯЁ]/, /\d/, /[^\p{L}\d]/u].filter((r) => r.test(pw)).length;
  if (classes < 3) problems.push('Используйте минимум 3 типа символов: строчные, заглавные, цифры, спецсимволы');
  const low = pw.toLowerCase();
  if (COMMON.some((c) => low.includes(c))) problems.push('Слишком распространённый пароль');
  if (ctx.username && ctx.username.length >= 3 && low.includes(ctx.username.toLowerCase())) problems.push('Пароль не должен содержать логин');
  const local = ctx.email?.split('@')[0];
  if (local && local.length >= 4 && low.includes(local.toLowerCase())) problems.push('Пароль не должен содержать часть email');
  return problems;
}
