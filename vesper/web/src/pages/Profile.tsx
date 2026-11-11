import { Ban, CalendarDays, Check, Flag, Hash, Link2, Lock, MessageCircle, MoreHorizontal, Pencil, UserCheck, UserMinus, UserPlus, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { EditProfileModal } from '../components/EditProfileModal';
import { Page } from '../components/Page';
import { ProfileHeader } from '../components/ProfileHeader';
import { ReportModal } from '../components/ReportModal';
import { Button, EmptyState, FloatingMenu, IconButton, MenuItem, Modal, Skeleton } from '../components/ui';
import { api, ApiError, errMsg } from '../lib/api';
import { accentVars } from '../lib/color';
import { openSocket } from '../lib/socket';
import { fmtDate } from '../lib/format';
import { useAuth } from '../store/auth';
import { useChats } from '../store/chat';
import { useFriends } from '../store/friends';
import { toast } from '../store/ui';
import type { Chat, Profile } from '../types';

export function ProfileRoute({ self }: { self?: boolean }) {
  const me = useAuth((s) => s.user)!;
  const { handle } = useParams();
  if (self) return <Navigate to={`/@${me.username}`} replace />;
  if (!handle?.startsWith('@') || handle.length < 4) {
    return <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center"><p className="grad-text font-display text-6xl font-semibold">404</p><p className="text-muted">Такой страницы нет.</p></div>;
  }
  return <ProfileView key={handle} username={handle.slice(1)} />;
}

function ProfileView({ username }: { username: string }) {
  const me = useAuth((s) => s.user)!;
  const navigate = useNavigate();
  const upsert = useChats((s) => s.upsertChat);
  const [p, setP] = useState<Profile | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [report, setReport] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);

  const load = useCallback(async () => {
    try {
      setP((await api.get<{ profile: Profile }>(`/users/by-username/${username}`)).profile);
      setError(null);
    } catch (e) {
      if (e instanceof ApiError) setError(e);
    }
  }, [username]);

  useEffect(() => {
    void load();
  }, [load]);

  // Профиль не входит в store чатов, поэтому отдельно применяем live presence-события.
  useEffect(() => {
    const socket = openSocket();
    const onPresence = (event: { userId: string; online: boolean | null; lastSeenAt: string | null; activity: 'DND' | 'WORK' | 'FREE' | null }) => {
      setP((current) => current && current.id === event.userId
        ? { ...current, presence: { online: event.online, lastSeenAt: event.lastSeenAt, activity: event.activity } }
        : current);
    };
    socket.on('presence', onPresence);
    return () => { socket.off('presence', onPresence); };
  }, []);

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    try {
      await fn();
      if (ok) toast.success(ok);
      await Promise.all([load(), useFriends.getState().load()]);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const write = async () => {
    if (!p) return;
    setBusy(true);
    try {
      const r = await api.post<{ chat: Chat }>('/chats/direct', { userId: p.id });
      upsert(r.chat);
      navigate(`/messages/${r.chat.id}`);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  if (error) {
    return <div className="flex h-full items-center justify-center"><EmptyState icon={<UserMinus />} title={error.status === 404 ? 'Пользователь не найден' : 'Не удалось загрузить профиль'} text={error.status === 404 ? `Аккаунта @${username} не существует или он недоступен.` : error.message} action={<Button variant="soft" onClick={() => navigate(-1)}>Назад</Button>} /></div>;
  }
  if (!p) return <Page><Skeleton className="h-[26rem]" /></Page>;

  const rel = p.relation;
  const isMe = p.isSelf;
  const data = isMe ? { ...p, accentColor: me.accentColor, profileBg: me.profileBg } : p;

  const copyLink = () =>
    void navigator.clipboard.writeText(`${window.location.origin}/@${p.username}`).then(() => toast.success('Ссылка на профиль скопирована')).catch(() => toast.error('Не удалось скопировать'));

  const actions = isMe ? (
    <>
      <IconButton label="Скопировать ссылку на профиль" onClick={copyLink}><Link2 className="h-5 w-5" /></IconButton>
      <Button variant="soft" icon={<Pencil className="h-4 w-4" />} onClick={() => setEditing(true)}>Редактировать</Button>
    </>
  ) : rel.blockedByMe ? (
    <Button variant="soft" icon={<Ban className="h-4 w-4" />} loading={busy} onClick={() => void run(() => api.del(`/blocks/${p.id}`), 'Пользователь разблокирован')}>Разблокировать</Button>
  ) : (
    <>
      {p.canMessage && <Button icon={<MessageCircle className="h-4 w-4" />} loading={busy} onClick={write}>Написать</Button>}
      {rel.friendship === 'NONE' && p.canRequest && <Button variant="soft" icon={<UserPlus className="h-4 w-4" />} disabled={busy} onClick={() => void run(() => api.post('/friends/requests', { userId: p.id }), 'Заявка отправлена')}>Добавить в друзья</Button>}
      {rel.friendship === 'OUTGOING' && <Button variant="soft" disabled={busy} onClick={() => void run(() => api.del(`/friends/requests/${rel.friendshipId}`), 'Заявка отменена')}>Отменить заявку</Button>}
      {rel.friendship === 'INCOMING' && (
        <>
          <Button variant="soft" icon={<Check className="h-4 w-4" />} disabled={busy} onClick={() => void run(() => api.post(`/friends/requests/${rel.friendshipId}/accept`), 'Заявка принята')}>Принять</Button>
          <IconButton label="Отклонить заявку" onClick={() => void run(() => api.del(`/friends/requests/${rel.friendshipId}`))}><X className="h-5 w-5" /></IconButton>
        </>
      )}
      {rel.friendship === 'FRIEND' && <span className="inline-flex h-11 items-center gap-2 rounded-xl bg-ok/15 px-4 text-sm font-semibold text-ok"><UserCheck className="h-4 w-4" />В друзьях</span>}
      <IconButton label="Ещё" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setMenu({ x: r.right - 220, y: r.bottom + 6 }); }}><MoreHorizontal className="h-5 w-5" /></IconButton>
    </>
  );

  return (
    <div className="h-full" style={accentVars(data.accentColor)}>
      <Page>
        <ProfileHeader name={p.displayName} username={p.username} publicId={p.publicId} avatarUrl={p.avatarUrl} coverUrl={data.coverUrl} bg={data.profileBg} accent={data.accentColor} status={p.statusText} presence={p.restricted ? null : p.presence} seed={p.id} actions={actions} />
        {p.restricted ? (
          <div className="card mt-5"><EmptyState icon={<Lock />} title="Профиль скрыт" text={rel.blockedMe ? 'Этот пользователь недоступен.' : 'Пользователь ограничил круг тех, кто может просматривать его профиль.'} /></div>
        ) : (
          <div className="mt-5 grid gap-5 sm:grid-cols-[1.6fr_1fr]">
            <section className="card p-5 sm:p-6">
              <h2 className="font-display text-sm font-semibold">О себе</h2>
              {p.about ? <p className="mt-3 whitespace-pre-wrap break-words text-[15px] leading-relaxed">{p.about}</p> : <p className="mt-3 text-sm text-muted">{isMe ? 'Расскажите о себе: нажмите «Редактировать».' : 'Пользователь пока ничего не рассказал о себе.'}</p>}
            </section>
            <section className="card p-5 sm:p-6">
              <h2 className="font-display text-sm font-semibold">Информация</h2>
              <dl className="mt-3 space-y-3 text-sm">
                <div className="flex items-center gap-3"><Hash className="h-4 w-4 text-muted" /><dt className="text-muted">ID</dt><dd className="ml-auto font-semibold">{p.publicId}</dd></div>
                {p.createdAt && <div className="flex items-center gap-3"><CalendarDays className="h-4 w-4 text-muted" /><dt className="text-muted">Регистрация</dt><dd className="ml-auto text-right font-semibold">{fmtDate(p.createdAt)}</dd></div>}
              </dl>
            </section>
          </div>
        )}
      </Page>

      <FloatingMenu anchor={menu} onClose={() => setMenu(null)}>
        <MenuItem icon={<Link2 />} onClick={() => { setMenu(null); copyLink(); }}>Скопировать ссылку</MenuItem>
        {rel.friendship === 'FRIEND' && <MenuItem icon={<UserMinus />} onClick={() => { setMenu(null); void run(() => api.del(`/friends/${p.id}`), 'Удалён из друзей'); }}>Удалить из друзей</MenuItem>}
        <MenuItem icon={<Flag />} onClick={() => { setMenu(null); setReport(true); }}>Пожаловаться</MenuItem>
        <MenuItem icon={<Ban />} danger onClick={() => { setMenu(null); setConfirmBlock(true); }}>Заблокировать</MenuItem>
      </FloatingMenu>

      <Modal open={confirmBlock} onClose={() => setConfirmBlock(false)} title={`Заблокировать ${p.displayName}?`} size="sm">
        <p className="mb-5 text-sm leading-relaxed text-muted">Пользователь не сможет писать вам и отправлять заявки, а дружба (если была) будет удалена. Разблокировать можно в любой момент.</p>
        <div className="flex gap-3"><Button variant="soft" className="flex-1" onClick={() => setConfirmBlock(false)}>Отмена</Button><Button variant="danger" className="flex-1" onClick={() => { setConfirmBlock(false); void run(() => api.post('/blocks', { userId: p.id }), 'Пользователь заблокирован'); }}>Заблокировать</Button></div>
      </Modal>
      {report && <ReportModal userId={p.id} userName={p.displayName} onClose={() => setReport(false)} />}
      {editing && <EditProfileModal user={me} onClose={() => setEditing(false)} onSaved={() => { const u = useAuth.getState().user!; if (u.username !== username) navigate(`/@${u.username}`, { replace: true }); else void load(); }} />}
    </div>
  );
}
