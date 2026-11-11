import { CheckCircle2, XCircle } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { Button, Input, Spinner } from '../components/ui';
import { api, ApiError, errMsg } from '../lib/api';
import { useAuth } from '../store/auth';
import { AuthLayout } from './AuthLayout';

type VerifyLocationState = { identifier?: string };

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const location = useLocation();
  const token = params.get('token');
  const initialIdentifier = (location.state as VerifyLocationState | null)?.identifier ?? '';
  const [identifier, setIdentifier] = useState(initialIdentifier);
  const [email, setEmail] = useState(initialIdentifier.includes('@') ? initialIdentifier : '');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const authed = useAuth((s) => s.status === 'authed');
  const [state, setState] = useState<'form' | 'loading' | 'ok' | 'error'>(token ? 'loading' : 'form');
  const [message, setMessage] = useState(token ? '' : 'Укажите email и введите код подтверждения.');
  const ran = useRef(false);

  useEffect(() => {
    if (!token || ran.current) return;
    ran.current = true;
    api.post('/auth/verify-email', { token })
      .then(() => setState('ok'))
      .catch((e) => { setMessage(errMsg(e)); setState('error'); });
  }, [token]);

  const verifyCode = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!/^\\S+@\\S+\\.\\S+$/.test(email)) {
      setError('Введите корректный email.');
      return;
    }
    if (!/^\\d{6}$/.test(code)) {
      setError('Введите шестизначный код.');
      return;
    }
    setBusy(true);
    try {
      await api.post('/auth/verify-email-code', { email, code });
      setState('ok');
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const resendCode = async () => {
    const target = identifier.trim() || email.trim();
    if (!target) {
      setError('Введите email или логин аккаунта.');
      return;
    }
    setError('');
    setNotice('');
    setResending(true);
    try {
      await api.post('/auth/resend-verification', { identifier: target });
      setNotice('Если аккаунт существует и ещё не подтверждён, новый код появится в консоли backend. Если код уже выводился недавно, используй его, пока он не истёк.');
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthLayout title={state === 'ok' ? 'Email подтверждён' : token ? state === 'loading' ? 'Подтверждаем…' : 'Не удалось подтвердить' : 'Подтверждение email'}
      subtitle={state === 'ok' ? 'Готово. Теперь можно войти в аккаунт.' : token ? undefined : 'Восстановите подтверждение для уже созданного аккаунта. Повторная регистрация не нужна.'}>
      <div className="flex flex-col items-center rounded-3xl border border-line/10 bg-surface/60 p-8 text-center">
        {token && state === 'loading' && <Spinner className="h-8 w-8" />}
        {state === 'ok' && (
          <>
            <CheckCircle2 className="h-14 w-14 text-ok" />
            <p className="mt-4 text-sm text-muted">Email подтверждён. Теперь войдите в Vesper.</p>
            <Link to={authed ? '/' : '/login'} className="mt-6"><Button>{authed ? 'На главную' : 'Войти'}</Button></Link>
          </>
        )}
        {token && state === 'error' && (
          <>
            <XCircle className="h-14 w-14 text-danger" />
            <p className="mt-4 text-sm text-muted">{message}</p>
            <Link to="/verify-email" className="mt-6"><Button>Ввести код вручную</Button></Link>
          </>
        )}
        {!token && state !== 'ok' && (
          <form onSubmit={verifyCode} className="w-full space-y-4 text-left">
            <Input label="Email аккаунта" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" autoComplete="email" />
            <Input label="Шестизначный код" value={code} onChange={(e) => setCode(e.target.value.replace(/\\D/g, '').slice(0, 6))} placeholder="000000" maxLength={6} autoComplete="one-time-code" inputMode="numeric" />
            {error && <p className="text-sm text-danger" role="alert">{error}</p>}
            {notice && <p className="text-sm text-muted" role="status">{notice}</p>}
            <Button type="submit" size="lg" className="w-full" loading={busy} disabled={busy || code.length !== 6 || !email}>Подтвердить email</Button>
            <div className="space-y-2">
              <label className="block text-xs text-muted">Если нужно запросить новый код, можно указать email или логин аккаунта</label>
              <Input aria-label="Email или логин для повторной отправки" value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="Email или логин" />
              <Button type="button" variant="soft" className="w-full" onClick={resendCode} loading={resending}>Запросить новый код</Button>
            </div>
          </form>
        )}
      </div>
      {state !== 'ok' && <p className="mt-8 text-center text-sm text-muted"><Link to="/login" className="font-semibold text-accent hover:underline">Вернуться ко входу</Link></p>}
    </AuthLayout>
  );
}
