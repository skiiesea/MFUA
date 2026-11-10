import { Bell, CalendarDays, MessageCirclePlus, Pencil, Search, ShieldCheck, ShieldAlert, UserRound, Users } from 'lucide-react';
import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Avatar } from '../components/Avatar';
import { Page } from '../components/Page';
import { Badge, EmptyState, Skeleton } from '../components/ui';
import { fmtDate, listTime } from '../lib/format';
import { useAuth } from '../store/auth';
import { chatTitle, selectUnreadTotal, useChats } from '../store/chat';
import { useFriends } from '../store/friends';
import { useNotifs } from '../store/notifications';

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? 'Доброй ночи' : h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер';
}

export function HomePage() {
  const user = useAuth((s) => s.user)!;
  const chats = useChats((s) => s.chats);
  const loaded = useChats((s) => s.loaded);
  const unread = useChats(selectUnreadTotal);
  const notifs = useNotifs((s) => s.items);
  const notifLoaded = useNotifs((s) => s.loaded);
  const friends = useFriends((s) => s.data);
  const navigate = useNavigate();

  useEffect(() => {
    useNotifs.getState().load().catch(() => {});
  }, []);

  const actions = [
    { to: '/messages', icon: MessageCirclePlus, label: 'Написать', hint: unread ? `${unread} непрочитанных` : 'Открыть чаты' },
    { to: '/search', icon: Search, label: 'Найти людей', hint: 'По логину или имени' },
    { to: '/friends', icon: Users, label: 'Друзья', hint: friends ? `${friends.friends.length} в списке${friends.incoming.length ? `, ${friends.incoming.length} заявок` : ''}` : '' },
    { to: `/@${user.username}`, icon: Pencil, label: 'Мой профиль', hint: 'Обложка, статус, о себе' },
  ];

  return (
    <Page wide>
      <header className="relative mb-8 overflow-hidden rounded-3xl border border-line/10 p-6 sm:p-9">
        <div className="grad absolute inset-0 opacity-[0.14]" />
        <div className="absolute -right-10 -top-16 h-56 w-56 rounded-full bg-accent2/30 blur-[70px]" />
        <div className="relative flex items-center gap-5">
          <Avatar name={user.displayName} src={user.avatarUrl} seed={user.id} size={72} className="hidden sm:inline-flex" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-muted">{greeting()}</p>
            <h1 className="mt-1 truncate font-display text-2xl font-semibold tracking-tight sm:text-4xl">{user.displayName}</h1>
            <p className="mt-2 text-sm text-muted">{unread ? `У вас ${unread} непрочитанных сообщений` : 'Новых сообщений нет'}</p>
          </div>
        </div>
      </header>

      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {actions.map((a) => (
          <Link key={a.to} to={a.to} className="card group p-4 transition duration-150 hover:-translate-y-0.5 hover:border-accent/40 active:scale-[0.98] sm:p-5">
            <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/15 text-accent transition group-hover:bg-accent group-hover:text-white"><a.icon className="h-5 w-5" /></span>
            <p className="font-semibold">{a.label}</p>
            <p className="mt-0.5 truncate text-xs text-muted">{a.hint}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        <section className="card p-2">
          <div className="flex items-center justify-between px-4 pb-1 pt-3"><h2 className="font-display text-sm font-semibold">Недавние переписки</h2><Link to="/messages" className="text-sm font-semibold text-accent hover:underline">Все</Link></div>
          {!loaded ? <div className="space-y-2 p-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16" />)}</div> : chats.length === 0 ? (
            <EmptyState icon={<MessageCirclePlus />} title="Переписок пока нет" text="Добавьте друга и начните разговор." />
          ) : chats.slice(0, 5).map((c) => (
            <button key={c.id} onClick={() => navigate(`/messages/${c.id}`)} className="flex w-full items-center gap-3 rounded-2xl p-3 text-left transition hover:bg-line/[0.06]">
              <Avatar name={chatTitle(c)} src={c.type === 'GROUP' ? c.avatarUrl : c.peer?.avatarUrl} seed={c.peer?.id ?? c.id} size={46} presence={c.peer?.presence} />
              <span className="min-w-0 flex-1"><span className="flex justify-between gap-2"><b className="truncate text-[15px]">{chatTitle(c)}</b>{c.lastMessage && <span className="shrink-0 text-xs text-muted">{listTime(c.lastMessage.createdAt)}</span>}</span>
                <span className="mt-0.5 flex items-center justify-between gap-2"><span className="truncate text-sm text-muted">{c.lastMessage ? c.lastMessage.text || 'Вложение' : 'Нет сообщений'}</span><Badge n={c.unread} /></span></span>
            </button>
          ))}
        </section>

        <div className="space-y-6">
          <section className="card p-2">
            <div className="flex items-center justify-between px-4 pb-1 pt-3"><h2 className="font-display text-sm font-semibold">Уведомления</h2><Link to="/notifications" className="text-sm font-semibold text-accent hover:underline">Все</Link></div>
            {!notifLoaded ? <div className="p-2"><Skeleton className="h-16" /></div> : notifs.length === 0 ? <p className="flex items-center gap-3 px-4 py-6 text-sm text-muted"><Bell className="h-5 w-5" />Пока ничего нового</p> : notifs.slice(0, 3).map((n) => (
              <Link key={n.id} to="/notifications" className="flex items-start gap-3 rounded-2xl p-3 transition hover:bg-line/[0.06]">
                {!n.read ? <span className="grad mt-2 h-2 w-2 shrink-0 rounded-full" /> : <span className="mt-2 h-2 w-2 shrink-0" />}
                <span className="min-w-0 text-sm"><span className={n.read ? '' : 'font-semibold'}>{n.title}</span><span className="block text-xs text-muted">{listTime(n.createdAt)}</span></span>
              </Link>
            ))}
          </section>

          <section className="card p-5">
            <h2 className="mb-4 font-display text-sm font-semibold">Аккаунт</h2>
            <dl className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3"><dt className="flex items-center gap-2 text-muted"><UserRound className="h-4 w-4" />Логин и ID</dt><dd className="font-semibold">@{user.username} <span className="font-normal text-muted">#{user.publicId}</span></dd></div>
              <div className="flex items-center justify-between gap-3"><dt className="flex items-center gap-2 text-muted"><CalendarDays className="h-4 w-4" />В Vesper с</dt><dd className="font-semibold">{fmtDate(user.createdAt)}</dd></div>
              <div className="flex items-center justify-between gap-3"><dt className="flex items-center gap-2 text-muted">{user.twoFactorEnabled ? <ShieldCheck className="h-4 w-4 text-ok" /> : <ShieldAlert className="h-4 w-4 text-[#f5a524]" />}Двухфакторная защита</dt>
                <dd>{user.twoFactorEnabled ? <span className="font-semibold text-ok">Включена</span> : <Link to="/settings/security" className="font-semibold text-accent hover:underline">Включить</Link>}</dd></div>
            </dl>
          </section>
        </div>
      </div>
    </Page>
  );
}
