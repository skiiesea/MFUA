import { CheckCircle2, XCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button, Spinner } from '../components/ui';
import { api, errMsg } from '../lib/api';
import { useAuth } from '../store/auth';
import { AuthLayout } from './AuthLayout';

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const authed = useAuth((s) => s.status === 'authed');
  const [state, setState] = useState<'loading' | 'ok' | 'error'>(token ? 'loading' : 'error');
  const [message, setMessage] = useState(token ? '' : 'В ссылке нет токена подтверждения.');
  const ran = useRef(false);

  useEffect(() => {
    if (!token || ran.current) return;
    ran.current = true;
    api.post('/auth/verify-email', { token }).then(() => setState('ok')).catch((e) => { setMessage(errMsg(e)); setState('error'); });
  }, [token]);

  return (
    <AuthLayout title={state === 'ok' ? 'Email подтверждён' : state === 'loading' ? 'Подтверждаем…' : 'Не удалось подтвердить'}>
      <div className="flex flex-col items-center rounded-3xl border border-line/10 bg-surface/60 p-8 text-center">
        {state === 'loading' && <Spinner className="h-8 w-8" />}
        {state === 'ok' && (
          <>
            <CheckCircle2 className="h-14 w-14 text-ok" />
            <p className="mt-4 text-sm text-muted">Готово. Теперь можно {authed ? 'продолжить пользоваться Vesper' : 'войти в аккаунт'}.</p>
          </>
        )}
        {state === 'error' && (
          <>
            <XCircle className="h-14 w-14 text-danger" />
            <p className="mt-4 text-sm text-muted">{message}</p>
          </>
        )}
        {state !== 'loading' && <Link to={authed ? '/' : '/login'} className="mt-6"><Button>{authed ? 'На главную' : 'Войти'}</Button></Link>}
      </div>
    </AuthLayout>
  );
}
