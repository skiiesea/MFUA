import { AtSign, CheckCircle2, Eye, EyeOff, Lock, Mail, MailCheck, User, XCircle } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PasswordMeter, passwordRules } from '../components/PasswordMeter';
import { Button, Input } from '../components/ui';
import { api, ApiError } from '../lib/api';
import { toast } from '../store/ui';
import { AuthLayout } from './AuthLayout';

function useAvailability(kind: 'username' | 'email', value: string, valid: boolean) {
  const [state, setState] = useState<'idle' | 'checking' | 'free' | 'taken'>('idle');
  useEffect(() => {
    if (!valid) return setState('idle');
    setState('checking');
    const t = setTimeout(async () => {
      try {
        const r = await api.get<{ username?: boolean; email?: boolean }>(`/auth/availability?${kind}=${encodeURIComponent(value)}`);
        setState(r[kind] ? 'free' : 'taken');
      } catch {
        setState('idle');
      }
    }, 450);
    return () => clearTimeout(t);
  }, [kind, value, valid]);
  return state;
}

export function RegisterPage() {
  const navigate = useNavigate();
  const [f, setF] = useState({ username: '', displayName: '', email: '', password: '', passwordConfirm: '' });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sent, setSent] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setF({ ...f, [k]: k === 'username' ? e.target.value.toLowerCase().replace(/\s/g, '') : e.target.value });
    setErrors((x) => ({ ...x, [k]: '' }));
  };

  const uValid = /^[a-z0-9_]{3,24}$/.test(f.username);
  const eValid = /^\S+@\S+\.\S+$/.test(f.email);
  const uState = useAvailability('username', f.username, uValid);
  const eState = useAvailability('email', f.email.toLowerCase(), eValid);
  const rulesOk = passwordRules(f.password, f).every((r) => r.ok);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const local: Record<string, string> = {};
    if (!uValid) local.username = 'Логин: 3–24 символа — латиница, цифры и _';
    if (!f.displayName.trim()) local.displayName = 'Введите имя';
    if (!eValid) local.email = 'Введите корректный email';
    if (!rulesOk) local.password = 'Пароль не соответствует требованиям';
    if (f.password !== f.passwordConfirm) local.passwordConfirm = 'Пароли не совпадают';
    setErrors(local);
    if (Object.keys(local).length) return;
    setBusy(true);
    try {
      const r = await api.post<{ needsVerification: boolean }>('/auth/register', f);
      if (r.needsVerification) setSent(true);
      else {
        toast.success('Аккаунт создан. Теперь войдите.');
        navigate('/login');
      }
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fields ?? { _: err.message });
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <AuthLayout title="Проверьте почту" subtitle={`Мы отправили ссылку для подтверждения на ${f.email}. Она действует 24 часа.`}>
        <div className="flex flex-col items-center rounded-3xl border border-line/10 bg-surface/60 p-8 text-center">
          <div className="grad mb-5 flex h-16 w-16 items-center justify-center rounded-2xl text-white shadow-glow"><MailCheck className="h-8 w-8" /></div>
          <p className="text-sm leading-relaxed text-muted">Не пришло письмо? Загляните в «Спам» или запросите новое.</p>
          <Button variant="soft" className="mt-5" onClick={async () => { await api.post('/auth/resend-verification', { identifier: f.email }).catch(() => {}); toast.success('Письмо отправлено повторно'); }}>Отправить ещё раз</Button>
        </div>
        <p className="mt-8 text-center text-sm text-muted"><Link to="/login" className="font-semibold text-accent hover:underline">Перейти ко входу</Link></p>
      </AuthLayout>
    );
  }

  const hint = (s: typeof uState, ok: string, bad: string) => (s === 'checking' ? 'Проверяем…' : s === 'free' ? ok : s === 'taken' ? bad : undefined);
  const status = (s: typeof uState) => (s === 'free' ? <CheckCircle2 className="mx-3 h-4 w-4 text-ok" /> : s === 'taken' ? <XCircle className="mx-3 h-4 w-4 text-danger" /> : undefined);

  return (
    <AuthLayout title="Создать аккаунт" subtitle="Это займёт минуту. Email нужен, чтобы подтвердить аккаунт.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Input label="Логин" value={f.username} onChange={set('username')} icon={<AtSign className="h-4 w-4" />} autoComplete="username" placeholder="alex_north" maxLength={24}
          error={errors.username || (uState === 'taken' ? 'Этот логин уже занят' : '')} hint={hint(uState, 'Логин свободен', '')} right={status(uState)} />
        <Input label="Имя" value={f.displayName} onChange={set('displayName')} icon={<User className="h-4 w-4" />} autoComplete="name" placeholder="Алекс" maxLength={40} error={errors.displayName} />
        <Input label="Email" type="email" value={f.email} onChange={set('email')} icon={<Mail className="h-4 w-4" />} autoComplete="email" placeholder="alex@mail.com"
          error={errors.email || (eState === 'taken' ? 'Этот email уже зарегистрирован' : '')} right={status(eState)} />
        <div>
          <Input label="Пароль" type={show ? 'text' : 'password'} value={f.password} onChange={set('password')} icon={<Lock className="h-4 w-4" />} autoComplete="new-password" error={errors.password}
            right={<button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Скрыть пароль' : 'Показать пароль'} className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:text-fg">{show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>} />
          <PasswordMeter password={f.password} username={f.username} email={f.email} />
        </div>
        <Input label="Повторите пароль" type={show ? 'text' : 'password'} value={f.passwordConfirm} onChange={set('passwordConfirm')} icon={<Lock className="h-4 w-4" />} autoComplete="new-password" error={errors.passwordConfirm} />
        {errors._ && <p className="text-sm text-danger" role="alert">{errors._}</p>}
        <Button type="submit" size="lg" className="w-full" loading={busy}>Создать аккаунт</Button>
      </form>
      <p className="mt-8 text-center text-sm text-muted">Уже есть аккаунт? <Link to="/login" className="font-semibold text-accent hover:underline">Войти</Link></p>
    </AuthLayout>
  );
}
