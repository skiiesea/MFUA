import clsx from 'clsx';
import { CheckCircle2, Copy, Download, Laptop, LogOut, RefreshCw, ShieldCheck, ShieldOff, Smartphone, XCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button, Input, Modal, Section, Skeleton } from '../components/ui';
import { api, ApiError, errMsg } from '../lib/api';
import { fmtDateTime } from '../lib/format';
import { useAuth } from '../store/auth';
import { toast } from '../store/ui';
import type { Self } from '../types';

interface SessionDto { id: string; device: string; ip: string | null; createdAt: string; lastUsedAt: string; remember: boolean; current: boolean }
interface LoginEventDto { id: string; success: boolean; reason: string | null; ip: string | null; device: string | null; createdAt: string }

const REASONS: Record<string, string> = {
  password: 'Вход по паролю', '2fa': 'Вход с кодом 2FA', backup: 'Вход с резервным кодом',
  bad_password: 'Неверный пароль', unknown_user: 'Неизвестный логин', locked: 'Аккаунт временно заблокирован',
  banned: 'Аккаунт заблокирован', email_not_verified: 'Email не подтверждён', '2fa_failed': 'Неверный код 2FA',
};

async function refreshUser() {
  const r = await api.get<{ user: Self }>('/auth/me');
  useAuth.getState().setUser(r.user);
}

function BackupCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const text = `Резервные коды Vesper\nКаждый код можно использовать один раз.\n\n${codes.join('\n')}\n`;
  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vesper-backup-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="space-y-5">
      <p className="text-sm leading-relaxed text-muted">Сохраните эти коды в надёжном месте. Если потеряете телефон, по ним можно войти. <b className="text-fg">Показываются только сейчас.</b></p>
      <ul className="grid grid-cols-2 gap-2 rounded-2xl bg-raised p-4 font-mono text-sm">
        {codes.map((c) => <li key={c} className="rounded-lg bg-surface/60 px-3 py-2 text-center tracking-wider">{c}</li>)}
      </ul>
      <div className="flex gap-3">
        <Button variant="soft" className="flex-1" icon={<Copy className="h-4 w-4" />} onClick={() => void navigator.clipboard.writeText(codes.join('\n')).then(() => toast.success('Скопировано'))}>Копировать</Button>
        <Button variant="soft" className="flex-1" icon={<Download className="h-4 w-4" />} onClick={download}>Скачать</Button>
      </div>
      <Button className="w-full" onClick={onDone}>Я сохранил(а) коды</Button>
    </div>
  );
}

function TwoFaSetup({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<'password' | 'scan' | 'codes'>('password');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [qr, setQr] = useState<{ qr: string; secret: string } | null>(null);
  const [codes, setCodes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<Record<string, string>>({});

  const wrap = async (fn: () => Promise<void>) => {
    setBusy(true);
    setErr({});
    try { await fn(); } catch (e) { setErr(e instanceof ApiError ? e.fields ?? { _: e.message } : { _: errMsg(e) }); } finally { setBusy(false); }
  };

  return (
    <Modal open onClose={step === 'codes' ? () => {} : onClose} title="Двухфакторная защита">
      {step === 'password' && (
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void wrap(async () => { setQr(await api.post('/account/2fa/setup', { password })); setStep('scan'); }); }}>
          <p className="text-sm leading-relaxed text-muted">Подтвердите пароль, чтобы начать настройку. Понадобится приложение-аутентификатор: Google Authenticator, Aegis, 2FAS, Authy и т. п.</p>
          <Input label="Пароль" type="password" value={password} onChange={(e) => setPassword(e.target.value)} error={err.password ?? err._} autoFocus autoComplete="current-password" />
          <Button type="submit" className="w-full" loading={busy} disabled={!password}>Продолжить</Button>
        </form>
      )}
      {step === 'scan' && qr && (
        <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); void wrap(async () => { const r = await api.post<{ backupCodes: string[] }>('/account/2fa/enable', { code }); setCodes(r.backupCodes); await refreshUser(); setStep('codes'); }); }}>
          <p className="text-sm text-muted">1. Отсканируйте QR-код в приложении. 2. Введите 6-значный код.</p>
          <div className="flex justify-center"><img src={qr.qr} alt="QR-код для приложения-аутентификатора" className="h-[220px] w-[220px] rounded-2xl bg-white p-2" /></div>
          <details className="text-sm text-muted"><summary className="cursor-pointer font-medium text-fg">Не получается отсканировать?</summary><p className="mt-2">Введите ключ вручную:</p><code className="mt-1 block break-all rounded-lg bg-raised p-3 font-mono text-xs text-fg">{qr.secret}</code></details>
          <Input label="Код из приложения" value={code} inputMode="numeric" autoComplete="one-time-code" maxLength={6} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} error={err.code ?? err._} className="[&_input]:text-center [&_input]:font-mono [&_input]:text-lg [&_input]:tracking-[0.3em]" placeholder="000000" autoFocus />
          <Button type="submit" className="w-full" loading={busy} disabled={code.length !== 6}>Включить защиту</Button>
        </form>
      )}
      {step === 'codes' && <BackupCodes codes={codes} onDone={onClose} />}
    </Modal>
  );
}

function ConfirmWithCode({ title, text, action, danger, onClose, onDone }: { title: string; text: string; action: string; danger?: boolean; onClose: () => void; onDone: (r: { backupCodes?: string[] }) => void | Promise<void>; }) {
  const endpoint = danger ? '/account/2fa/disable' : '/account/2fa/backup-codes';
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<Record<string, string>>({});
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr({});
    try { await onDone(await api.post(endpoint, { password, code })); } catch (x) { setErr(x instanceof ApiError ? x.fields ?? { _: x.message } : { _: errMsg(x) }); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={title} size="sm">
      <form className="space-y-4" onSubmit={submit}>
        <p className="text-sm leading-relaxed text-muted">{text}</p>
        <Input label="Пароль" type="password" value={password} onChange={(e) => setPassword(e.target.value)} error={err.password} autoComplete="current-password" autoFocus />
        <Input label="Код 2FA или резервный код" value={code} onChange={(e) => setCode(e.target.value)} error={err.code ?? err._} autoComplete="one-time-code" />
        <Button type="submit" variant={danger ? 'danger' : 'primary'} className="w-full" loading={busy} disabled={!password || code.length < 6}>{action}</Button>
      </form>
    </Modal>
  );
}

export function SecuritySettings() {
  const user = useAuth((s) => s.user)!;
  const [status, setStatus] = useState<{ backupCodesLeft: number } | null>(null);
  const [sessions, setSessions] = useState<SessionDto[] | null>(null);
  const [history, setHistory] = useState<LoginEventDto[] | null>(null);
  const [modal, setModal] = useState<'setup' | 'disable' | 'regen' | null>(null);
  const [newCodes, setNewCodes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [st, se, hi] = await Promise.all([
      api.get<{ backupCodesLeft: number }>('/account/2fa'),
      api.get<{ sessions: SessionDto[] }>('/account/sessions'),
      api.get<{ events: LoginEventDto[] }>('/account/login-history'),
    ]);
    setStatus(st); setSessions(se.sessions); setHistory(hi.events);
  }, []);
  useEffect(() => { load().catch((e) => toast.error(errMsg(e))); }, [load, user.twoFactorEnabled]);

  const revoke = async (s: SessionDto) => {
    setBusy(s.id);
    try {
      await api.del(`/account/sessions/${s.id}`);
      if (s.current) { useAuth.getState().setGuest(); return; }
      toast.success('Сеанс завершён');
      await load();
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(null); }
  };
  const revokeOthers = async () => {
    setBusy('others');
    try { const r = await api.post<{ closed: number }>('/account/sessions/revoke-others'); toast.success(r.closed ? `Завершено сеансов: ${r.closed}` : 'Других сеансов нет'); await load(); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(null); }
  };

  return (
    <div className="space-y-5">
      <Section title="Двухфакторная аутентификация" description="Дополнительный код из приложения при каждом входе. Даже если пароль украдут, зайти в аккаунт не получится.">
        <div className={clsx('flex items-center gap-4 rounded-2xl p-4', user.twoFactorEnabled ? 'bg-ok/10' : 'bg-raised')}>
          <span className={clsx('flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl', user.twoFactorEnabled ? 'bg-ok/20 text-ok' : 'bg-line/10 text-muted')}>{user.twoFactorEnabled ? <ShieldCheck className="h-6 w-6" /> : <ShieldOff className="h-6 w-6" />}</span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{user.twoFactorEnabled ? 'Защита включена' : 'Защита отключена'}</p>
            <p className="text-sm text-muted">{user.twoFactorEnabled ? `Резервных кодов осталось: ${status?.backupCodesLeft ?? '…'}` : 'Рекомендуем включить для всех аккаунтов.'}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {user.twoFactorEnabled ? (
            <>
              <Button variant="soft" icon={<RefreshCw className="h-4 w-4" />} onClick={() => setModal('regen')}>Новые резервные коды</Button>
              <Button variant="danger" onClick={() => setModal('disable')}>Отключить 2FA</Button>
            </>
          ) : <Button icon={<ShieldCheck className="h-4 w-4" />} onClick={() => setModal('setup')}>Включить 2FA</Button>}
        </div>
      </Section>

      <Section title="Активные устройства" description="Здесь видны все места, где выполнен вход. Завершите сеансы, которые не узнаёте.">
        {!sessions ? <div className="space-y-2"><Skeleton className="h-16" /><Skeleton className="h-16" /></div> : (
          <>
            <ul className="divide-y divide-line/5">
              {sessions.map((s) => (
                <li key={s.id} className="flex items-center gap-4 py-3.5">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-raised text-muted">{/Android|iOS/.test(s.device) ? <Smartphone className="h-5 w-5" /> : <Laptop className="h-5 w-5" />}</span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate text-sm font-semibold">{s.device}{s.current && <span className="rounded-full bg-ok/15 px-2 py-0.5 text-[11px] text-ok">Это устройство</span>}</p>
                    <p className="truncate text-xs text-muted">{s.ip ?? 'IP неизвестен'}, активность {fmtDateTime(s.lastUsedAt)}</p>
                  </div>
                  <Button size="sm" variant="soft" loading={busy === s.id} icon={<LogOut className="h-4 w-4" />} onClick={() => void revoke(s)}>{s.current ? 'Выйти' : 'Завершить'}</Button>
                </li>
              ))}
            </ul>
            {sessions.length > 1 && <Button className="mt-3" variant="danger" size="sm" loading={busy === 'others'} onClick={() => void revokeOthers()}>Завершить все остальные</Button>}
          </>
        )}
      </Section>

      <Section title="История входов" description="Последние 50 попыток входа в ваш аккаунт.">
        {!history ? <Skeleton className="h-40" /> : history.length === 0 ? <p className="text-sm text-muted">Пока пусто</p> : (
          <ul className="divide-y divide-line/5">
            {history.map((e) => (
              <li key={e.id} className="flex items-center gap-3 py-3">
                {e.success ? <CheckCircle2 className="h-5 w-5 shrink-0 text-ok" /> : <XCircle className="h-5 w-5 shrink-0 text-danger" />}
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{REASONS[e.reason ?? ''] ?? (e.success ? 'Успешный вход' : 'Неудачная попытка')}</p><p className="truncate text-xs text-muted">{e.device ?? 'Устройство неизвестно'}, {e.ip ?? 'IP неизвестен'}</p></div>
                <span className="shrink-0 text-xs text-muted">{fmtDateTime(e.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {modal === 'setup' && <TwoFaSetup onClose={() => { setModal(null); void refreshUser().catch(() => {}); }} />}
      {modal === 'disable' && <ConfirmWithCode danger title="Отключить 2FA" text="Аккаунт станет защищён только паролем. Введите пароль и текущий код (или резервный)." action="Отключить" onClose={() => setModal(null)} onDone={async () => { await refreshUser(); setModal(null); toast.success('Двухфакторная защита отключена'); }} />}
      {modal === 'regen' && <ConfirmWithCode title="Новые резервные коды" text="Старые коды перестанут работать. Для подтверждения введите пароль и код из приложения." action="Создать коды" onClose={() => setModal(null)} onDone={(r) => { setModal(null); setNewCodes(r.backupCodes ?? []); void load(); }} />}
      {newCodes && <Modal open onClose={() => {}} title="Резервные коды"><BackupCodes codes={newCodes} onDone={() => setNewCodes(null)} /></Modal>}
    </div>
  );
}
