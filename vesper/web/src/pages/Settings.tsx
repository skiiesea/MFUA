import clsx from 'clsx';
import { Bell, CheckCircle2, Eye, EyeOff, LogOut, Mail, Palette, Play, Shield, User, XCircle, Lock } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { Page } from '../components/Page';
import { PasswordMeter, passwordRules } from '../components/PasswordMeter';
import { Button, Input, Modal, Row, Section, Segmented, Select, Switch } from '../components/ui';
import { api, ApiError, errMsg } from '../lib/api';
import { ACCENTS } from '../lib/color';
import { playTone } from '../lib/sounds';
import { useAuth } from '../store/auth';
import { toast, useUi } from '../store/ui';
import type { NotifSettings, Self, UiSettings, Visibility } from '../types';
import { SecuritySettings } from './SecuritySettings';

const SECTIONS = [
  { id: 'account', label: 'Аккаунт', icon: User },
  { id: 'security', label: 'Безопасность', icon: Shield },
  { id: 'privacy', label: 'Приватность', icon: Lock },
  { id: 'interface', label: 'Интерфейс', icon: Palette },
  { id: 'notifications', label: 'Уведомления', icon: Bell },
] as const;
type SectionId = (typeof SECTIONS)[number]['id'];

export function SettingsPage() {
  const { section } = useParams();
  const logout = useAuth((s) => s.logout);
  const navigate = useNavigate();
  if (!section) return <Navigate to="/settings/account" replace />;
  if (!SECTIONS.some((s) => s.id === section)) return <Navigate to="/settings/account" replace />;
  const id = section as SectionId;

  return (
    <Page wide>
      <h1 className="mb-6 font-display text-2xl font-semibold tracking-tight sm:text-3xl">Настройки</h1>
      <div className="grid gap-6 md:grid-cols-[220px_minmax(0,1fr)]">
        <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 md:mx-0 md:flex-col md:px-0" aria-label="Разделы настроек">
          {SECTIONS.map((s) => (
            <Link key={s.id} to={`/settings/${s.id}`} aria-current={id === s.id ? 'page' : undefined} className={clsx('flex h-11 shrink-0 items-center gap-3 rounded-xl px-4 text-sm font-semibold transition', id === s.id ? 'bg-raised text-fg shadow-soft' : 'text-muted hover:bg-line/10 hover:text-fg')}>
              <s.icon className={clsx('h-[18px] w-[18px]', id === s.id && 'text-accent')} />{s.label}
            </Link>
          ))}
          <button onClick={async () => { await logout(); navigate('/login'); }} className="hidden h-11 items-center gap-3 rounded-xl px-4 text-sm font-semibold text-danger transition hover:bg-danger/10 md:mt-4 md:flex"><LogOut className="h-[18px] w-[18px]" />Выйти</button>
        </nav>
        <div className="min-w-0 space-y-5">
          {id === 'account' && <AccountSettings />}
          {id === 'security' && <SecuritySettings />}
          {id === 'privacy' && <PrivacySettings />}
          {id === 'interface' && <InterfaceSettings />}
          {id === 'notifications' && <NotificationSettings />}
          <Button variant="danger" className="w-full md:hidden" icon={<LogOut className="h-4 w-4" />} onClick={async () => { await logout(); navigate('/login'); }}>Выйти из аккаунта</Button>
        </div>
      </div>
    </Page>
  );
}

// ── Аккаунт ─────────────────────────────────────────────────
function AccountSettings() {
  const user = useAuth((s) => s.user)!;
  const setUser = useAuth((s) => s.setUser);
  const [name, setName] = useState(user.displayName);
  const [username, setUsername] = useState(user.username);
  const [uState, setUState] = useState<'idle' | 'checking' | 'free' | 'taken'>('idle');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);

  useEffect(() => {
    const ok = /^[a-z0-9_]{3,24}$/.test(username);
    if (username === user.username || !ok) return setUState('idle');
    setUState('checking');
    const t = setTimeout(() => api.get<{ available: boolean }>(`/users/availability?username=${username}`).then((r) => setUState(r.available ? 'free' : 'taken')).catch(() => setUState('idle')), 400);
    return () => clearTimeout(t);
  }, [username, user.username]);

  const dirty = name.trim() !== user.displayName || username !== user.username;
  const save = async () => {
    setBusy(true);
    setErrors({});
    try {
      const r = await api.patch<{ user: Self }>('/users/me', { displayName: name, username });
      setUser(r.user);
      toast.success('Данные сохранены');
    } catch (e) {
      setErrors(e instanceof ApiError && e.fields ? e.fields : { _: errMsg(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Section title="Профиль" description="Имя и username видят другие пользователи. Внешний вид профиля редактируется на его странице.">
        <div className="space-y-4">
          <Input label="Отображаемое имя" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} error={errors.displayName} />
          <Input label="Username" value={username} maxLength={24} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))} error={errors.username || (uState === 'taken' ? 'Этот логин уже занят' : '')} hint={uState === 'free' ? 'Свободен' : uState === 'checking' ? 'Проверяем…' : 'Ссылка на ваш профиль изменится вместе с ним'}
            right={uState === 'free' ? <CheckCircle2 className="mx-3 h-4 w-4 text-ok" /> : uState === 'taken' ? <XCircle className="mx-3 h-4 w-4 text-danger" /> : undefined} />
          {errors._ && <p className="text-sm text-danger">{errors._}</p>}
          <Button loading={busy} disabled={!dirty || !name.trim() || uState === 'taken'} onClick={save}>Сохранить</Button>
        </div>
      </Section>
      <Section title="Email">
        <Row title={user.email} text={user.emailVerified ? 'Подтверждён' : 'Не подтверждён'}><Button variant="soft" icon={<Mail className="h-4 w-4" />} onClick={() => setEmailOpen(true)}>Изменить</Button></Row>
      </Section>
      <PasswordSection />
      {emailOpen && <EmailModal onClose={() => setEmailOpen(false)} />}
    </>
  );
}

function EmailModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<Record<string, string>>({});
  const [sent, setSent] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr({});
    try { await api.post('/account/email', { newEmail: email, password }); setSent(true); } catch (x) { setErr(x instanceof ApiError ? x.fields ?? { _: x.message } : { _: errMsg(x) }); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title="Смена email" size="sm">
      {sent ? (
        <div className="space-y-4 text-center"><p className="text-sm leading-relaxed text-muted">Мы отправили письмо на <b className="text-fg">{email}</b>. Адрес изменится, когда вы откроете ссылку из письма.</p><Button className="w-full" onClick={onClose}>Понятно</Button></div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Input label="Новый email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} error={err.newEmail} autoFocus />
          <Input label="Текущий пароль" type="password" value={password} onChange={(e) => setPassword(e.target.value)} error={err.password ?? err._} autoComplete="current-password" />
          <Button type="submit" className="w-full" loading={busy} disabled={!email || !password}>Отправить письмо</Button>
        </form>
      )}
    </Modal>
  );
}

function PasswordSection() {
  const user = useAuth((s) => s.user)!;
  const [f, setF] = useState({ currentPassword: '', newPassword: '', newPasswordConfirm: '' });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<Record<string, string>>({});
  const ok = passwordRules(f.newPassword, user).every((r) => r.ok) && f.newPassword === f.newPasswordConfirm && !!f.currentPassword;
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => { setF({ ...f, [k]: e.target.value }); setErr({}); };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api.post<{ sessionsClosed: number }>('/account/password', f);
      toast.success(r.sessionsClosed ? `Пароль изменён. Завершено других сеансов: ${r.sessionsClosed}` : 'Пароль изменён');
      setF({ currentPassword: '', newPassword: '', newPasswordConfirm: '' });
    } catch (x) { setErr(x instanceof ApiError ? x.fields ?? { _: x.message } : { _: errMsg(x) }); } finally { setBusy(false); }
  };
  const eye = <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Скрыть пароль' : 'Показать пароль'} className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:text-fg">{show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>;
  return (
    <Section title="Пароль" description="После смены пароля все остальные устройства будут отключены.">
      <form onSubmit={submit} className="space-y-4">
        <Input label="Текущий пароль" type={show ? 'text' : 'password'} value={f.currentPassword} onChange={set('currentPassword')} error={err.currentPassword ?? err.password} autoComplete="current-password" right={eye} />
        <div><Input label="Новый пароль" type={show ? 'text' : 'password'} value={f.newPassword} onChange={set('newPassword')} error={err.newPassword} autoComplete="new-password" /><PasswordMeter password={f.newPassword} username={user.username} email={user.email} /></div>
        <Input label="Повторите новый пароль" type={show ? 'text' : 'password'} value={f.newPasswordConfirm} onChange={set('newPasswordConfirm')} error={err.newPasswordConfirm} autoComplete="new-password" />
        {err._ && <p className="text-sm text-danger">{err._}</p>}
        <Button type="submit" loading={busy} disabled={!ok}>Изменить пароль</Button>
      </form>
    </Section>
  );
}

// ── Приватность ─────────────────────────────────────────────
function PrivacySettings() {
  const user = useAuth((s) => s.user)!;
  const setUser = useAuth((s) => s.setUser);
  const patch = async (body: Record<string, string>) => {
    try {
      const r = await api.patch<{ user: Self }>('/settings/privacy', body);
      setUser(r.user);
      toast.success('Сохранено');
    } catch (e) { toast.error(errMsg(e)); }
  };
  const vis = (key: 'messages' | 'online' | 'lastSeen' | 'profile') => (
    <Select value={user.privacy[key]} onChange={(e) => void patch({ [key]: e.target.value as Visibility })} className="w-full sm:w-52" aria-label="Кто">
      <option value="EVERYONE">Все</option>
      <option value="FRIENDS">Только друзья</option>
      <option value="NOBODY">Никто</option>
    </Select>
  );
  return (
    <Section title="Приватность" description="Настройки применяются сразу и проверяются на сервере: обойти их из браузера нельзя.">
      <div className="divide-y divide-line/5">
        <Row title="Кто может писать мне" text="Остальные не смогут начать с вами диалог">{vis('messages')}</Row>
        <Row title="Кто может отправлять заявки в друзья">
          <Select value={user.privacy.requests} onChange={(e) => void patch({ requests: e.target.value })} className="w-full sm:w-52" aria-label="Кто"><option value="EVERYONE">Все</option><option value="NOBODY">Никто</option></Select>
        </Row>
        <Row title="Кто видит, что я в сети" text="Включая статус «не беспокоить» и «на работе»">{vis('online')}</Row>
        <Row title="Кто видит время последней активности">{vis('lastSeen')}</Row>
        <Row title="Кто может просматривать мой профиль" text="Остальные увидят только имя и аватар">{vis('profile')}</Row>
      </div>
    </Section>
  );
}

// ── Интерфейс ───────────────────────────────────────────────
function InterfaceSettings() {
  const ui = useUi((s) => s.ui);
  const setUi = useUi((s) => s.setUi);
  const setUser = useAuth((s) => s.setUser);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const save = (patch: Partial<UiSettings>) => {
    setUi(patch);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      api.patch<{ user: Self }>('/settings/ui', patch).then((r) => setUser(r.user)).catch((e) => toast.error(errMsg(e)));
    }, 500);
  };
  return (
    <>
      <Section title="Тема">
        <Segmented<UiSettings['theme']> value={ui.theme} onChange={(theme) => save({ theme })} options={[{ value: 'dark', label: 'Тёмная' }, { value: 'light', label: 'Светлая' }, { value: 'system', label: 'Как в системе' }]} />
      </Section>
      <Section title="Акцентный цвет" description="Цвет кнопок, подсветок и собственных сообщений.">
        <div className="flex flex-wrap items-center gap-3">
          {ACCENTS.map((a) => <button key={a.hex} aria-label={a.name} title={a.name} aria-pressed={ui.accent === a.hex} onClick={() => save({ accent: a.hex })} className={clsx('h-11 w-11 rounded-full ring-offset-2 ring-offset-surface transition active:scale-90', ui.accent === a.hex && 'ring-2 ring-fg')} style={{ background: a.hex }} />)}
          <label className="relative h-11 w-11 cursor-pointer overflow-hidden rounded-full border border-line/20" title="Свой цвет"><input type="color" value={ui.accent} onChange={(e) => save({ accent: e.target.value })} className="absolute -inset-2 h-16 w-16 cursor-pointer" aria-label="Свой цвет" /></label>
        </div>
        <div className="mt-5 flex gap-2.5">
          <div className="grad rounded-2xl rounded-br-md px-4 py-2.5 text-sm text-white">Так выглядят ваши сообщения</div>
          <div className="rounded-2xl rounded-bl-md bg-raised px-4 py-2.5 text-sm">А так чужие</div>
        </div>
      </Section>
      <Section title="Размер интерфейса" description={`Масштаб: ${ui.scale}%`}>
        <input type="range" min={85} max={125} step={5} value={ui.scale} onChange={(e) => save({ scale: +e.target.value })} aria-label="Размер интерфейса" className="h-1.5 w-full cursor-pointer accent-[rgb(var(--c-accent))]" />
        <div className="mt-2 flex justify-between text-xs text-muted"><span>Компактнее</span><span>Крупнее</span></div>
      </Section>
    </>
  );
}

// ── Уведомления ─────────────────────────────────────────────
function NotificationSettings() {
  const user = useAuth((s) => s.user)!;
  const setUser = useAuth((s) => s.setUser);
  const n = user.notifications;
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const [local, setLocal] = useState(n);
  useEffect(() => setLocal(n), [n]);

  const save = (patch: Partial<Omit<NotifSettings, 'categories'>> & { categories?: Partial<NotifSettings['categories']> }, immediate = true) => {
    const next = { ...local, ...patch, categories: { ...local.categories, ...patch.categories } } as NotifSettings;
    setLocal(next);
    const send = () => api.patch<{ user: Self }>('/settings/notifications', patch).then((r) => setUser(r.user)).catch((e) => toast.error(errMsg(e)));
    clearTimeout(timer.current);
    if (immediate) void send();
    else timer.current = setTimeout(send, 500);
  };
  const cats: { key: keyof NotifSettings['categories']; title: string; text: string }[] = [
    { key: 'message', title: 'Новые сообщения', text: 'Всплывающие уведомления и звук' },
    { key: 'friendRequest', title: 'Заявки в друзья', text: 'Кто-то хочет добавить вас в друзья' },
    { key: 'friendAccepted', title: 'Принятые заявки', text: 'Ваша заявка принята' },
    { key: 'mention', title: 'Упоминания в группах', text: 'Когда пишут @ваш_логин' },
  ];
  return (
    <>
      <Section title="Звук">
        <div className="divide-y divide-line/5">
          <Row title="Звуки уведомлений"><Switch checked={local.sound} onChange={(sound) => save({ sound })} label="Звуки уведомлений" /></Row>
          <Row title="Громкость"><input type="range" min={0} max={100} value={local.volume} disabled={!local.sound} onChange={(e) => save({ volume: +e.target.value }, false)} aria-label="Громкость" className="h-1.5 w-full cursor-pointer accent-[rgb(var(--c-accent))] disabled:opacity-40 sm:w-52" /></Row>
          <Row title="Мелодия">
            <div className="flex items-center gap-2">
              <Select value={local.tone} disabled={!local.sound} onChange={(e) => { const tone = e.target.value as NotifSettings['tone']; save({ tone }); playTone(tone, local.volume); }} aria-label="Мелодия" className="w-40"><option value="soft">Мягкая</option><option value="bell">Колокольчик</option><option value="pop">Щелчок</option></Select>
              <Button variant="soft" size="sm" icon={<Play className="h-4 w-4" />} disabled={!local.sound} onClick={() => playTone(local.tone, local.volume)} aria-label="Проверить звук" />
            </div>
          </Row>
        </div>
      </Section>
      <Section title="Что присылать" description="Статус «Не беспокоить» отключает звуки и всплывающие окна, но уведомления остаются в списке.">
        <div className="divide-y divide-line/5">
          {cats.map((c) => <Row key={c.key} title={c.title} text={c.text}><Switch checked={local.categories[c.key]} onChange={(v) => save({ categories: { [c.key]: v } })} label={c.title} /></Row>)}
          <Row title="Безопасность" text="Смена пароля, 2FA, блокировки входа. Эти уведомления отключить нельзя"><Switch checked disabled onChange={() => {}} label="Безопасность" /></Row>
        </div>
      </Section>
    </>
  );
}
