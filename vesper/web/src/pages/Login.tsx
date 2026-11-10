import { AlertCircle, ArrowLeft, Eye, EyeOff, KeyRound, Lock, Mail, ShieldCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button, Input } from '../components/ui';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../store/auth';
import { toast } from '../store/ui';
import type { Self } from '../types';
import { AuthLayout } from './AuthLayout';

type LoginResponse = { user?: Self; twoFactorRequired?: boolean; ticket?: string };

export function LoginPage() {
  const setUser = useAuth((s) => s.setUser);
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/';
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [ticket, setTicket] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [useBackup, setUseBackup] = useState(false);

  const done = (r: LoginResponse) => {
    if (r.user) {
      setUser(r.user);
      navigate(from, { replace: true });
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (ticket) done(await api.post<LoginResponse>('/auth/login/2fa', { ticket, code }));
      else {
        const r = await api.post<LoginResponse>('/auth/login', { identifier, password, remember });
        if (r.twoFactorRequired && r.ticket) setTicket(r.ticket);
        else done(r);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err);
        if (ticket && err.code === 'UNAUTHORIZED') {
          setTicket(null);
          setCode('');
        }
      }
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    try {
      await api.post('/auth/resend-verification', { identifier });
      toast.success('Если аккаунт существует, мы отправили новое письмо');
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message);
    }
  };

  if (ticket) {
    return (
      <AuthLayout title="Подтвердите вход" subtitle={useBackup ? 'Введите один из резервных кодов. Каждый код работает только один раз.' : 'Введите 6-значный код из приложения-аутентификатора.'}>
        <form onSubmit={submit} className="space-y-5">
          <Input
            label={useBackup ? 'Резервный код' : 'Код из приложения'}
            value={code}
            onChange={(e) => setCode(useBackup ? e.target.value.toUpperCase() : e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode={useBackup ? 'text' : 'numeric'}
            autoComplete="one-time-code"
            placeholder={useBackup ? 'XXXXX-XXXXX' : '000000'}
            autoFocus
            icon={useBackup ? <KeyRound className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
            className="[&_input]:text-center [&_input]:font-mono [&_input]:text-lg [&_input]:tracking-[0.3em]"
          />
          {error && <ErrorBox error={error} />}
          <Button type="submit" size="lg" className="w-full" loading={busy} disabled={code.length < 6}>Войти</Button>
          <div className="flex items-center justify-between text-sm">
            <button type="button" className="inline-flex items-center gap-1.5 text-muted hover:text-fg" onClick={() => { setTicket(null); setCode(''); setError(null); }}>
              <ArrowLeft className="h-4 w-4" /> Назад
            </button>
            <button type="button" className="font-semibold text-accent hover:underline" onClick={() => { setUseBackup(!useBackup); setCode(''); }}>
              {useBackup ? 'Использовать код из приложения' : 'Использовать резервный код'}
            </button>
          </div>
        </form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="С возвращением" subtitle="Войдите, чтобы продолжить переписку.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Input label="Логин или email" value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoComplete="username" autoFocus icon={<Mail className="h-4 w-4" />} placeholder="alex или alex@mail.com" />
        <Input
          label="Пароль"
          type={show ? 'text' : 'password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          icon={<Lock className="h-4 w-4" />}
          right={<button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Скрыть пароль' : 'Показать пароль'} className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:text-fg">{show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>}
        />
        <label className="flex cursor-pointer items-center gap-2.5 text-sm text-muted">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 cursor-pointer rounded accent-[rgb(var(--c-accent))]" />
          Запомнить меня на этом устройстве
        </label>
        {error && <ErrorBox error={error} onResend={error.code === 'EMAIL_NOT_VERIFIED' ? resend : undefined} />}
        <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!identifier || !password}>Войти</Button>
      </form>
      <p className="mt-8 text-center text-sm text-muted">
        Нет аккаунта? <Link to="/register" className="font-semibold text-accent hover:underline">Создать</Link>
      </p>
    </AuthLayout>
  );
}

function ErrorBox({ error, onResend }: { error: ApiError; onResend?: () => void }) {
  return (
    <div role="alert" className="flex gap-3 rounded-xl border border-danger/30 bg-danger/10 p-3.5 text-sm">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
      <div>
        <p className="text-fg">{error.message}</p>
        {onResend && <button type="button" onClick={onResend} className="mt-1.5 font-semibold text-accent hover:underline">Отправить письмо ещё раз</button>}
      </div>
    </div>
  );
}
