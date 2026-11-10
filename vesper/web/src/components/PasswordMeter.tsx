import clsx from 'clsx';
import { Check, Circle } from 'lucide-react';

export function passwordRules(pw: string, ctx: { username?: string; email?: string } = {}) {
  const classes = [/[a-zа-яё]/, /[A-ZА-ЯЁ]/, /\d/, /[^\p{L}\d]/u].filter((r) => r.test(pw)).length;
  const low = pw.toLowerCase();
  const local = ctx.email?.split('@')[0];
  return [
    { ok: pw.length >= 10, text: 'Минимум 10 символов' },
    { ok: classes >= 3, text: '3 типа символов: a–z, A–Z, 0–9, спецсимволы' },
    { ok: !(ctx.username && ctx.username.length >= 3 && low.includes(ctx.username.toLowerCase())) && !(local && local.length >= 4 && low.includes(local.toLowerCase())), text: 'Без логина и части email' },
  ];
}

export function PasswordMeter({ password, username, email }: { password: string; username?: string; email?: string }) {
  if (!password) return null;
  const rules = passwordRules(password, { username, email });
  const score = rules.filter((r) => r.ok).length + (password.length >= 14 ? 1 : 0);
  const color = score <= 1 ? 'bg-danger' : score === 2 ? 'bg-[#f5a524]' : 'bg-ok';
  return (
    <div className="mt-2.5">
      <div className="flex gap-1.5" aria-hidden>
        {[0, 1, 2, 3].map((i) => <span key={i} className={clsx('h-1 flex-1 rounded-full transition-colors', i < score ? color : 'bg-line/15')} />)}
      </div>
      <ul className="mt-2 space-y-1">
        {rules.map((r) => (
          <li key={r.text} className={clsx('flex items-center gap-2 text-xs transition-colors', r.ok ? 'text-ok' : 'text-muted')}>
            {r.ok ? <Check className="h-3.5 w-3.5" /> : <Circle className="h-3 w-3" />}
            {r.text}
          </li>
        ))}
      </ul>
    </div>
  );
}
