import clsx from 'clsx';
import { Activity, BarChart3, Ban, CheckCircle2, FileText, Flag, MessageSquare, RefreshCw, Search, ShieldAlert, ShieldCheck, Users, Wifi } from 'lucide-react';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { Avatar } from '../components/Avatar';
import { Page, PageHeader } from '../components/Page';
import { Button, EmptyState, Input, Modal, Segmented, Select, Skeleton, Tabs, Textarea } from '../components/ui';
import { api, errMsg } from '../lib/api';
import { fmtDateTime, plural } from '../lib/format';
import { useAuth } from '../store/auth';
import { toast } from '../store/ui';

type Tab = 'overview' | 'users' | 'reports' | 'logs' | 'root';
const TABS: { value: Tab; label: string }[] = [
  { value: 'overview', label: 'Обзор' }, { value: 'users', label: 'Пользователи' }, { value: 'reports', label: 'Жалобы' }, { value: 'logs', label: 'Логи' }, { value: 'root', label: 'Root control' },
];

export function AdminPage() {
  const user = useAuth((s) => s.user)!;
  const { tab } = useParams();
  if (user.role !== 'ADMIN' && user.role !== 'ROOT_ADMIN') {
    return <div className="flex h-full items-center justify-center"><EmptyState icon={<ShieldAlert />} title="Нет доступа" text="Раздел доступен только администраторам." action={<Link to="/"><Button variant="soft">На главную</Button></Link>} /></div>;
  }
  const visibleTabs = user.role === 'ROOT_ADMIN' ? TABS : TABS.filter((t) => t.value !== 'root');
  if (!tab || !visibleTabs.some((t) => t.value === tab)) return <Navigate to="/admin/overview" replace />;
  return <AdminInner tab={tab as Tab} />;
}

function AdminInner({ tab }: { tab: Tab }) {
  const navigate = useNavigate();
  const isRoot = useAuth((s) => s.user?.role === 'ROOT_ADMIN');
  const visibleTabs = isRoot ? TABS : TABS.filter((t) => t.value !== 'root');
  return (
    <Page wide>
      <PageHeader title="Администрирование" subtitle="Статистика, пользователи, жалобы и технические логи" />
      <div className="mb-5 overflow-x-auto"><Tabs value={tab} onChange={(v) => navigate(`/admin/${v}`)} tabs={visibleTabs} /></div>
      {tab === 'overview' && <Overview />}
      {tab === 'users' && <UsersTab />}
      {tab === 'reports' && <ReportsTab />}
      {tab === 'logs' && <LogsTab />}
      {tab === 'root' && isRoot && <RootControlTab />}
    </Page>
  );
}

function Stat({ icon, label, value, hint }: { icon: ReactNode; label: string; value: number | string; hint?: string }) {
  return (
    <div className="card p-5">
      <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent">{icon}</span>
      <p className="font-display text-3xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-sm text-muted">{label}</p>
      {hint && <p className="mt-0.5 text-xs text-muted/80">{hint}</p>}
    </div>
  );
}

function Overview() {
  const [s, setS] = useState<Record<string, number> | null>(null);
  useEffect(() => { api.get<Record<string, number>>('/admin/stats').then(setS).catch((e) => toast.error(errMsg(e))); }, []);
  if (!s) return <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-36" />)}</div>;
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <Stat icon={<Users className="h-5 w-5" />} label="Пользователей" value={s.users} hint={`подтвердили email: ${s.verified}`} />
      <Stat icon={<Wifi className="h-5 w-5" />} label="Сейчас онлайн" value={s.online} />
      <Stat icon={<Activity className="h-5 w-5" />} label="Активны за 24 часа" value={s.active24h} />
      <Stat icon={<Ban className="h-5 w-5" />} label="Заблокировано" value={s.banned} />
      <Stat icon={<MessageSquare className="h-5 w-5" />} label="Сообщений всего" value={s.messages} hint={`за сутки: ${s.messages24h}`} />
      <Stat icon={<BarChart3 className="h-5 w-5" />} label="Чатов" value={s.chats} />
      <Stat icon={<Flag className="h-5 w-5" />} label="Открытых жалоб" value={s.openReports} />
    </div>
  );
}

interface AdminUser { id: string; publicId: number; username: string; displayName: string; email: string; role: 'USER' | 'ADMIN' | 'ROOT_ADMIN'; avatarUrl: string | null; emailVerified: boolean; twoFactor: boolean; banned: boolean; banReason: string | null; createdAt: string; lastSeenAt: string }

function BanModal({ user, onClose, onDone }: { user: { id: string; displayName: string }; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try { await api.post(`/admin/users/${user.id}/ban`, { reason }); toast.success('Пользователь заблокирован'); onDone(); onClose(); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={`Заблокировать ${user.displayName}`} size="sm">
      <div className="space-y-4">
        <p className="text-sm text-muted">Все сеансы пользователя будут завершены, войти он не сможет. Причина показывается ему при попытке входа.</p>
        <Textarea label="Причина" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} autoFocus />
        <div className="flex gap-3"><Button variant="soft" className="flex-1" onClick={onClose}>Отмена</Button><Button variant="danger" className="flex-1" loading={busy} disabled={reason.trim().length < 3} onClick={submit}>Заблокировать</Button></div>
      </div>
    </Modal>
  );
}

function UsersTab() {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'banned' | 'admins'>('all');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ total: number; pageSize: number; users: AdminUser[] } | null>(null);
  const [ban, setBan] = useState<AdminUser | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    api.get<typeof data>(`/admin/users?q=${encodeURIComponent(q)}&page=${page}&filter=${filter}`).then(setData).catch((e) => toast.error(errMsg(e)));
  }, [q, page, filter]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  const unban = async (u: AdminUser) => {
    setBusy(u.id);
    try { await api.post(`/admin/users/${u.id}/unban`); toast.success('Пользователь разблокирован'); load(); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(null); }
  };
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Логин, имя или email" aria-label="Поиск аккаунтов" icon={<Search className="h-4 w-4" />} className="flex-1" />
        <Segmented value={filter} onChange={(v) => { setFilter(v); setPage(1); }} options={[{ value: 'all', label: 'Все' }, { value: 'banned', label: 'Блок' }, { value: 'admins', label: 'Админы' }]} />
      </div>
      <div className="card divide-y divide-line/5 overflow-hidden">
        {!data ? <div className="space-y-2 p-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}</div> : data.users.length === 0 ? <EmptyState icon={<Users />} title="Никого не найдено" /> : data.users.map((u) => (
          <div key={u.id} className="flex flex-wrap items-center gap-3 p-4">
            <Avatar name={u.displayName} src={u.avatarUrl} seed={u.id} size={44} />
            <div className="min-w-0 flex-1 basis-48">
              <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">{u.displayName}<span className="font-normal text-muted">@{u.username} #{u.publicId}</span>
                {u.role !== 'USER' && <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] text-accent">админ</span>}
                {u.banned && <span className="rounded-full bg-danger/15 px-2 py-0.5 text-[11px] text-danger">заблокирован</span>}
                {u.twoFactor && <ShieldCheck className="h-4 w-4 text-ok" aria-label="2FA включена" />}
                {!u.emailVerified && <span className="rounded-full bg-[#f5a524]/15 px-2 py-0.5 text-[11px] text-[#f5a524]">email не подтверждён</span>}</p>
              <p className="truncate text-xs text-muted">{u.email}, регистрация {fmtDateTime(u.createdAt)}, был(а) {fmtDateTime(u.lastSeenAt)}</p>
              {u.banned && u.banReason && <p className="mt-1 text-xs text-danger">Причина: {u.banReason}</p>}
            </div>
            {u.role === 'USER' && (u.banned ? <Button size="sm" variant="soft" icon={<CheckCircle2 className="h-4 w-4" />} loading={busy === u.id} onClick={() => void unban(u)}>Разблокировать</Button> : <Button size="sm" variant="danger" icon={<Ban className="h-4 w-4" />} onClick={() => setBan(u)}>Заблокировать</Button>)}
          </div>
        ))}
      </div>
      {data && pages > 1 && <div className="mt-4 flex items-center justify-center gap-3"><Button size="sm" variant="soft" disabled={page <= 1} onClick={() => setPage(page - 1)}>Назад</Button><span className="text-sm text-muted">{page} из {pages}</span><Button size="sm" variant="soft" disabled={page >= pages} onClick={() => setPage(page + 1)}>Вперёд</Button></div>}
      {ban && <BanModal user={ban} onClose={() => setBan(null)} onDone={load} />}
    </div>
  );
}


type RootProfile = {
  id: string; publicId: number; username: string; displayName: string; email: string; emailVerified: boolean;
  role: 'USER' | 'ADMIN' | 'ROOT_ADMIN'; statusText: string; about: string; accentColor: string | null; profileBg: string | null;
  activity: 'AUTO' | 'DND' | 'OFFLINE' | 'WORK' | 'FREE';
  privacyMessages: 'EVERYONE' | 'FRIENDS' | 'NOBODY'; privacyRequests: 'EVERYONE' | 'NOBODY';
  privacyOnline: 'EVERYONE' | 'FRIENDS' | 'NOBODY'; privacyLastSeen: 'EVERYONE' | 'FRIENDS' | 'NOBODY';
  privacyProfile: 'EVERYONE' | 'FRIENDS' | 'NOBODY'; banned: boolean; banReason: string | null;
  createdAt: string; lastSeenAt: string;
};
type RootChat = { id: string; type: string; title: string | null; lastMessageAt: string; members: { id: string; username: string; displayName: string; publicId: number }[] };
type RootMessage = { id: string; text: string; createdAt: string; deletedAt: string | null; sender: { id: string; username: string; displayName: string }; attachments: { originalName: string }[] };

function RootControlTab() {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [selected, setSelected] = useState<RootProfile | null>(null);
  const [reason, setReason] = useState('');
  const [messageReason, setMessageReason] = useState('');
  const [chats, setChats] = useState<RootChat[]>([]);
  const [activeChat, setActiveChat] = useState<RootChat | null>(null);
  const [messages, setMessages] = useState<RootMessage[]>([]);
  const [busy, setBusy] = useState(false);

  const search = useCallback(async () => {
    try {
      const r = await api.get<{ users: AdminUser[] }>('/admin/users?q=' + encodeURIComponent(query) + '&page=1&filter=all');
      setUsers(r.users);
    } catch (e) { toast.error(errMsg(e)); }
  }, [query]);
  useEffect(() => { const t = setTimeout(() => void search(), 250); return () => clearTimeout(t); }, [search]);

  const selectUser = async (u: AdminUser) => {
    setBusy(true);
    try {
      const r = await api.get<{ user: RootProfile }>('/admin/root/users/' + u.id);
      setSelected(r.user); setReason(''); setChats([]); setMessages([]); setActiveChat(null);
    } catch (e) { toast.error(errMsg(e)); }
    finally { setBusy(false); }
  };

  const updateField = <K extends keyof RootProfile>(key: K, value: RootProfile[K]) => {
    setSelected((old) => old ? { ...old, [key]: value } : old);
  };

  const save = async () => {
    if (!selected || reason.trim().length < 8) return;
    setBusy(true);
    try {
      const { id, createdAt: _created, lastSeenAt: _seen, role, ...fields } = selected;
      const payload = role === 'ROOT_ADMIN' ? fields : { ...fields, role };
      const r = await api.patch<{ user: RootProfile }>('/admin/root/users/' + id, { ...payload, reason });
      setSelected((old) => old ? { ...old, ...r.user } : old);
      toast.success('Аккаунт обновлён'); setReason(''); void search();
    } catch (e) { toast.error(errMsg(e)); }
    finally { setBusy(false); }
  };

  const loadChats = async () => {
    if (!selected || messageReason.trim().length < 8) return;
    setBusy(true);
    try {
      const r = await api.get<{ chats: RootChat[] }>('/admin/root/users/' + selected.id + '/chats?reason=' + encodeURIComponent(messageReason));
      setChats(r.chats); setActiveChat(null); setMessages([]);
    } catch (e) { toast.error(errMsg(e)); }
    finally { setBusy(false); }
  };

  const loadMessages = async (chat: RootChat) => {
    if (messageReason.trim().length < 8) return;
    setBusy(true);
    try {
      const r = await api.get<{ messages: RootMessage[] }>('/admin/root/chats/' + chat.id + '/messages?targetId=' + encodeURIComponent(selected?.id ?? '') + '&reason=' + encodeURIComponent(messageReason));
      setActiveChat(chat); setMessages(r.messages);
    } catch (e) { toast.error(errMsg(e)); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-danger/30 bg-danger/5 p-4 text-sm"><b className="text-danger">Режим владельца системы.</b> Изменения профилей и просмотр переписок доступны только root_admin. Все действия записываются в аудит; участники чата получают уведомление при просмотре сообщений.</div>
      <div className="card p-4">
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Найти пользователя: логин, имя или email" icon={<Search className="h-4 w-4" />} />
        <div className="mt-3 max-h-56 divide-y divide-line/10 overflow-auto">
          {users.map((u) => <button key={u.id} onClick={() => void selectUser(u)} className="flex w-full items-center gap-3 p-3 text-left hover:bg-raised">
            <Avatar name={u.displayName} src={u.avatarUrl} seed={u.id} size={36} />
            <span className="min-w-0 flex-1"><b className="block truncate text-sm">{u.displayName}</b><span className="text-xs text-muted">@{u.username} · ID {u.publicId} · {u.email}</span></span>
            {u.role === 'ROOT_ADMIN' ? <span className="text-xs text-danger">root</span> : u.role === 'ADMIN' ? <span className="text-xs text-accent">admin</span> : null}
          </button>)}
          {users.length === 0 && <p className="p-4 text-sm text-muted">Пользователи не найдены</p>}
        </div>
      </div>
      {selected && <div className="space-y-4">
        <div className="card p-5">
          <div className="mb-4 flex items-center justify-between gap-2"><div><h3 className="font-semibold">{selected.displayName} <span className="text-muted">@{selected.username}</span></h3><p className="text-xs text-muted">Внутренний ID: {selected.id} · Регистрация: {fmtDateTime(selected.createdAt)}</p></div><Button variant="ghost" size="sm" onClick={() => setSelected(null)}>Закрыть</Button></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-muted">Публичный ID<Input value={String(selected.publicId)} onChange={(e) => updateField('publicId', Number(e.target.value))} /></label>
            <label className="text-xs text-muted">Логин<Input value={selected.username} onChange={(e) => updateField('username', e.target.value)} /></label>
            <label className="text-xs text-muted">Имя<Input value={selected.displayName} onChange={(e) => updateField('displayName', e.target.value)} /></label>
            <label className="text-xs text-muted">Email<Input value={selected.email} onChange={(e) => updateField('email', e.target.value)} /></label>
            <label className="text-xs text-muted">Статус<Input value={selected.statusText} onChange={(e) => updateField('statusText', e.target.value)} /></label>
            <label className="text-xs text-muted">Цвет акцента<Input value={selected.accentColor ?? ''} onChange={(e) => updateField('accentColor', e.target.value || null)} placeholder="#7c5cff" /></label>
            <label className="text-xs text-muted">Фон профиля<Input value={selected.profileBg ?? ''} onChange={(e) => updateField('profileBg', e.target.value || null)} /></label>
            {selected.role === 'ROOT_ADMIN' ? <label className="text-xs text-muted">Роль<Input value="ROOT_ADMIN" disabled /></label> : <label className="text-xs text-muted">Роль<Select value={selected.role} onChange={(e) => updateField('role', e.target.value as RootProfile['role'])}><option value="USER">USER</option><option value="ADMIN">ADMIN</option></Select></label>}
            <label className="text-xs text-muted">Активность<Select value={selected.activity} onChange={(e) => updateField('activity', e.target.value as RootProfile['activity'])}>{['AUTO','DND','OFFLINE','WORK','FREE'].map((v) => <option key={v} value={v}>{v}</option>)}</Select></label>
            <label className="text-xs text-muted">Кто может писать<Select value={selected.privacyMessages} onChange={(e) => updateField('privacyMessages', e.target.value as RootProfile['privacyMessages'])}>{['EVERYONE','FRIENDS','NOBODY'].map((v) => <option key={v} value={v}>{v}</option>)}</Select></label>
            <label className="text-xs text-muted">Заявки в друзья<Select value={selected.privacyRequests} onChange={(e) => updateField('privacyRequests', e.target.value as RootProfile['privacyRequests'])}><option value="EVERYONE">EVERYONE</option><option value="NOBODY">NOBODY</option></Select></label>
            <label className="text-xs text-muted">Профиль виден<Select value={selected.privacyProfile} onChange={(e) => updateField('privacyProfile', e.target.value as RootProfile['privacyProfile'])}>{['EVERYONE','FRIENDS','NOBODY'].map((v) => <option key={v} value={v}>{v}</option>)}</Select></label>
            <label className="text-xs text-muted">Онлайн виден<Select value={selected.privacyOnline} onChange={(e) => updateField('privacyOnline', e.target.value as RootProfile['privacyOnline'])}>{['EVERYONE','FRIENDS','NOBODY'].map((v) => <option key={v} value={v}>{v}</option>)}</Select></label>
            <label className="text-xs text-muted">Последний визит<Select value={selected.privacyLastSeen} onChange={(e) => updateField('privacyLastSeen', e.target.value as RootProfile['privacyLastSeen'])}>{['EVERYONE','FRIENDS','NOBODY'].map((v) => <option key={v} value={v}>{v}</option>)}</Select></label>
          </div>
          <div className="mt-3"><Textarea label="О себе" value={selected.about} onChange={(e) => updateField('about', e.target.value)} rows={3} /></div>
          <div className="mt-3 flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={selected.emailVerified} onChange={(e) => updateField('emailVerified', e.target.checked)} /> Email подтверждён</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={selected.banned} onChange={(e) => updateField('banned', e.target.checked)} /> Заблокирован</label>
          </div>
          <div className="mt-3"><Input value={selected.banReason ?? ''} onChange={(e) => updateField('banReason', e.target.value || null)} placeholder="Причина блокировки" /></div>
          <div className="mt-3"><Textarea label="Причина изменения (обязательно, минимум 8 символов)" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} /></div>
          <div className="mt-3 flex justify-end"><Button loading={busy} disabled={reason.trim().length < 8 || !selected.username || !selected.email || !selected.publicId} onClick={() => void save()}>Сохранить изменения</Button></div>
        </div>
        <div className="card p-5">
          <h3 className="font-semibold">Переписки пользователя</h3>
          <p className="mt-1 text-xs text-muted">Укажи причину доступа. Действие будет записано в аудит, участники получат уведомление.</p>
          <div className="mt-3"><Textarea label="Причина просмотра" value={messageReason} onChange={(e) => setMessageReason(e.target.value)} rows={2} /></div>
          <div className="mt-3"><Button variant="soft" loading={busy} disabled={messageReason.trim().length < 8} onClick={() => void loadChats()}>Загрузить чаты</Button></div>
          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(220px,1fr)_2fr]">
            <div className="max-h-[50dvh] space-y-2 overflow-auto">
              {chats.map((chat) => <button key={chat.id} onClick={() => void loadMessages(chat)} className={clsx('w-full rounded-xl border p-3 text-left', activeChat?.id === chat.id ? 'border-accent bg-accent/10' : 'border-line/20 hover:bg-raised')}>
                <b className="block text-sm">{chat.title || chat.members.map((m) => m.displayName).join(', ')}</b><span className="text-xs text-muted">{chat.type} · {chat.members.map((m) => '@' + m.username).join(', ')}</span>
              </button>)}
            </div>
            <div className="max-h-[60dvh] space-y-3 overflow-auto rounded-xl bg-raised p-3">
              {!activeChat ? <p className="text-sm text-muted">Выбери чат слева для просмотра сообщений.</p> : messages.map((m) => <div key={m.id} className="rounded-xl border border-line/20 bg-panel p-3">
                <div className="flex justify-between gap-2 text-xs"><b>{m.sender.displayName} <span className="font-normal text-muted">@{m.sender.username}</span></b><span className="text-muted">{fmtDateTime(m.createdAt)}</span></div>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm">{m.deletedAt ? '[Сообщение удалено]' : m.text}</p>
                {m.attachments.length > 0 && <p className="mt-2 text-xs text-muted">Вложения: {m.attachments.map((a) => a.originalName).join(', ')}</p>}
              </div>)}
            </div>
          </div>
        </div>
      </div>}
    </div>
  );
}

interface ReportDto { id: string; reason: string; details: string | null; snapshot: string | null; status: 'OPEN' | 'RESOLVED' | 'DISMISSED'; createdAt: string; resolvedNote: string | null; reporter: { id: string; username: string; displayName: string }; target: { id: string; username: string; displayName: string; banned: boolean } }
const REASON: Record<string, string> = { SPAM: 'Спам', ABUSE: 'Оскорбления', FAKE: 'Фейковый аккаунт', ILLEGAL: 'Незаконный контент', OTHER: 'Другое' };

function ReportsTab() {
  const [status, setStatus] = useState<'OPEN' | 'ALL'>('OPEN');
  const [items, setItems] = useState<ReportDto[] | null>(null);
  const [ban, setBan] = useState<ReportDto['target'] | null>(null);
  const load = useCallback(() => { api.get<{ reports: ReportDto[] }>(`/admin/reports?status=${status}`).then((r) => setItems(r.reports)).catch((e) => toast.error(errMsg(e))); }, [status]);
  useEffect(load, [load]);
  const resolve = async (r: ReportDto, s: 'RESOLVED' | 'DISMISSED') => {
    try { await api.post(`/admin/reports/${r.id}/resolve`, { status: s }); toast.success(s === 'RESOLVED' ? 'Жалоба обработана' : 'Жалоба отклонена'); load(); } catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <div>
      <div className="mb-4"><Segmented value={status} onChange={setStatus} options={[{ value: 'OPEN', label: 'Открытые' }, { value: 'ALL', label: 'Все' }]} /></div>
      {!items ? <Skeleton className="h-40" /> : items.length === 0 ? <div className="card"><EmptyState icon={<Flag />} title="Жалоб нет" text="Когда пользователи пожалуются на аккаунт или сообщение, они появятся здесь." /></div> : (
        <div className="space-y-3">
          {items.map((r) => (
            <div key={r.id} className="card p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm"><b>{REASON[r.reason] ?? r.reason}</b> на <b>{r.target.displayName}</b> <span className="text-muted">@{r.target.username}</span></p>
                <span className={clsx('rounded-full px-2.5 py-0.5 text-xs font-semibold', r.status === 'OPEN' ? 'bg-[#f5a524]/15 text-[#f5a524]' : 'bg-line/10 text-muted')}>{r.status === 'OPEN' ? 'Открыта' : r.status === 'RESOLVED' ? 'Обработана' : 'Отклонена'}</span>
              </div>
              <p className="mt-1 text-xs text-muted">От @{r.reporter.username}, {fmtDateTime(r.createdAt)}</p>
              {r.details && <p className="mt-3 rounded-xl bg-raised p-3 text-sm">{r.details}</p>}
              {r.snapshot && <p className="mt-2 rounded-xl border-l-[3px] border-accent bg-accent/10 p-3 text-sm"><span className="mb-1 block text-xs font-bold text-accent">Сообщение, приложенное к жалобе</span>{r.snapshot}</p>}
              {r.status === 'OPEN' && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" variant="soft" onClick={() => void resolve(r, 'RESOLVED')}>Отметить обработанной</Button>
                  <Button size="sm" variant="ghost" onClick={() => void resolve(r, 'DISMISSED')}>Отклонить</Button>
                  {!r.target.banned && <Button size="sm" variant="danger" icon={<Ban className="h-4 w-4" />} onClick={() => setBan(r.target)}>Заблокировать</Button>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {ban && <BanModal user={ban} onClose={() => setBan(null)} onDone={load} />}
    </div>
  );
}

const LEVEL_STYLE: Record<string, string> = { DEBUG: 'text-muted', INFO: 'text-accent', WARN: 'text-[#f5a524]', ERROR: 'text-danger' };

function LogsTab() {
  const [file, setFile] = useState('application');
  const [level, setLevel] = useState('ALL');
  const [q, setQ] = useState('');
  const [entries, setEntries] = useState<Record<string, unknown>[] | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.get<{ entries: Record<string, unknown>[] }>(`/admin/logs?file=${file}&level=${level}&q=${encodeURIComponent(q)}&limit=200`)
      .then((r) => setEntries(r.entries)).catch((e) => toast.error(errMsg(e))).finally(() => setLoading(false));
  }, [file, level, q]);
  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [load]);

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="overflow-x-auto"><Segmented value={file} onChange={setFile} options={['application', 'auth', 'security', 'errors', 'access'].map((f) => ({ value: f, label: f }))} /></div>
        <Select value={level} onChange={(e) => setLevel(e.target.value)} aria-label="Уровень" className="lg:w-40"><option value="ALL">Все уровни</option><option value="DEBUG">DEBUG</option><option value="INFO">INFO</option><option value="WARN">WARN</option><option value="ERROR">ERROR</option></Select>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск: событие, userId, ip…" aria-label="Поиск по логам" icon={<Search className="h-4 w-4" />} className="flex-1" />
        <Button variant="soft" icon={<RefreshCw className={clsx('h-4 w-4', loading && 'animate-spin')} />} onClick={load}>Обновить</Button>
      </div>
      <div className="card overflow-hidden">
        {!entries ? <Skeleton className="h-64" /> : entries.length === 0 ? <EmptyState icon={<FileText />} title="Записей нет" text="В этом файле пока нет записей, подходящих под фильтр." /> : (
          <ul className="max-h-[65dvh] divide-y divide-line/5 overflow-auto font-mono text-xs">
            {entries.map((e, i) => {
              const { time, level: lv, category: _c, msg, event, pid: _p, hostname: _h, ...rest } = e as Record<string, unknown>;
              return (
                <li key={i} className="px-4 py-2.5">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="text-muted">{String(time ?? '').replace('T', ' ').slice(0, 19)}</span>
                    <span className={clsx('font-bold', LEVEL_STYLE[String(lv)] ?? '')}>{String(lv)}</span>
                    {event ? <span className="font-semibold text-fg">{String(event)}</span> : null}
                    <span className="break-all text-muted">{String(msg ?? '')}</span>
                  </div>
                  {Object.keys(rest).length > 0 && <p className="mt-1 break-all text-muted/80">{Object.entries(rest).map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : String(v)}`).join('  ')}</p>}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <p className="mt-3 text-xs text-muted">Показаны последние {entries?.length ?? 0} {plural(entries?.length ?? 0, 'запись', 'записи', 'записей')}. Пароли, токены, секреты 2FA и текст сообщений в логи не попадают.</p>
    </div>
  );
}
