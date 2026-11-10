import clsx from 'clsx';
import { motion } from 'framer-motion';
import { Bell, Home, LogOut, MessageCircle, Search, Settings, Shield, User, Users, WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Avatar } from '../components/Avatar';
import { LogoMark } from '../components/Logo';
import { Badge, FloatingMenu, MenuItem } from '../components/ui';
import { api, errMsg } from '../lib/api';
import { startRealtime } from '../lib/realtime';
import { useAuth } from '../store/auth';
import { selectUnreadTotal, useChats } from '../store/chat';
import { useFriends } from '../store/friends';
import { useNotifs } from '../store/notifications';
import { toast, useUi } from '../store/ui';
import type { Activity, Self } from '../types';

const ACTIVITIES: { value: Activity; label: string; dot: string }[] = [
  { value: 'AUTO', label: 'В сети', dot: 'bg-ok' },
  { value: 'FREE', label: 'Свободен', dot: 'bg-ok' },
  { value: 'WORK', label: 'На работе', dot: 'bg-[#f5a524]' },
  { value: 'DND', label: 'Не беспокоить', dot: 'bg-danger' },
  { value: 'OFFLINE', label: 'Не в сети', dot: 'bg-muted' },
];

export function AppShell() {
  const user = useAuth((s) => s.user)!;
  const setUser = useAuth((s) => s.setUser);
  const logout = useAuth((s) => s.logout);
  const navigate = useNavigate();
  const loc = useLocation();
  const unread = useChats(selectUnreadTotal);
  const notifUnread = useNotifs((s) => s.unread);
  const incoming = useFriends((s) => s.data?.incoming.length ?? 0);
  const connected = useUi((s) => s.connected);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    startRealtime();
    useFriends.getState().load().catch(() => {});
  }, []);

  useEffect(() => {
    const total = unread + notifUnread;
    document.title = total > 0 ? `(${total}) Vesper` : 'Vesper';
  }, [unread, notifUnread]);

  const setActivity = async (activity: Activity) => {
    setMenu(null);
    try {
      const r = await api.patch<{ user: Self }>('/users/me', { activity });
      setUser(r.user);
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const items = [
    { to: '/', label: 'Главная', icon: Home, badge: 0, end: true },
    { to: '/messages', label: 'Сообщения', icon: MessageCircle, badge: unread },
    { to: '/friends', label: 'Друзья', icon: Users, badge: incoming },
    { to: '/search', label: 'Поиск', icon: Search, badge: 0 },
    { to: '/notifications', label: 'Уведомления', icon: Bell, badge: notifUnread },
  ];
  const inChat = /^\/messages\/.+/.test(loc.pathname);
  const current = ACTIVITIES.find((a) => a.value === user.activity) ?? ACTIVITIES[0];
  const openMenu = (e: React.MouseEvent, up: boolean) => {
    const r = e.currentTarget.getBoundingClientRect();
    setMenu({ x: up ? r.left : r.right + 8, y: up ? r.top - 380 : r.top - 300 });
  };

  return (
    <div className="flex h-[100dvh] flex-col md:flex-row">
      <aside className="glass hidden w-[88px] shrink-0 flex-col items-center border-y-0 border-l-0 py-5 md:flex">
        <NavLink to="/" aria-label="Vesper"><LogoMark size={44} /></NavLink>
        <nav className="mt-8 flex flex-1 flex-col items-center gap-2">
          {items.map((it) => (
            <NavLink key={it.to} to={it.to} end={it.end} aria-label={it.label} title={it.label} className="group relative">
              {({ isActive }) => (
                <span className={clsx('relative flex h-12 w-12 items-center justify-center rounded-2xl transition duration-150 active:scale-90', isActive ? 'text-white' : 'text-muted hover:bg-line/10 hover:text-fg')}>
                  {isActive && <motion.span layoutId="rail-pill" className="grad absolute inset-0 rounded-2xl shadow-glow" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
                  <it.icon className="relative h-[22px] w-[22px]" />
                  {it.badge > 0 && <Badge n={it.badge} className="absolute -right-1.5 -top-1.5 ring-2 ring-surface" />}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="flex flex-col items-center gap-2">
          {user.role === 'ADMIN' && (
            <NavLink to="/admin" aria-label="Админ-панель" title="Админ-панель" className={({ isActive }) => clsx('flex h-11 w-11 items-center justify-center rounded-2xl transition', isActive ? 'bg-accent/20 text-accent' : 'text-muted hover:bg-line/10 hover:text-fg')}>
              <Shield className="h-5 w-5" />
            </NavLink>
          )}
          <NavLink to="/settings" aria-label="Настройки" title="Настройки" className={({ isActive }) => clsx('flex h-11 w-11 items-center justify-center rounded-2xl transition', isActive ? 'bg-accent/20 text-accent' : 'text-muted hover:bg-line/10 hover:text-fg')}>
            <Settings className="h-5 w-5" />
          </NavLink>
          <button onClick={(e) => openMenu(e, false)} aria-label="Профиль и статус" className="mt-1 rounded-full transition active:scale-90">
            <Avatar name={user.displayName} src={user.avatarUrl} seed={user.id} size={44} presence={{ online: true, lastSeenAt: null, activity: user.activity === 'DND' || user.activity === 'WORK' ? user.activity : null }} />
          </button>
        </div>
      </aside>

      <main className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
        {!connected && (
          <div className="absolute inset-x-0 top-0 z-40 flex items-center justify-center gap-2 bg-[#f5a524] py-1.5 text-xs font-semibold text-black" role="status">
            <WifiOff className="h-3.5 w-3.5" /> Соединение потеряно. Восстанавливаем…
          </div>
        )}
        <Outlet />
      </main>

      <nav className={clsx('glass safe-b flex shrink-0 items-stretch justify-around border-x-0 border-b-0 px-1 md:hidden', inChat && 'hidden')} aria-label="Основная навигация">
        {items.map((it) => (
          <NavLink key={it.to} to={it.to} end={it.end} className="relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-semibold">
            {({ isActive }) => (
              <>
                <span className={clsx('relative flex h-7 w-12 items-center justify-center rounded-full transition', isActive ? 'grad text-white shadow-glow' : 'text-muted')}>
                  <it.icon className="h-[19px] w-[19px]" />
                  {it.badge > 0 && <Badge n={it.badge} className="absolute -right-0.5 -top-1 !min-w-[16px] !px-1 !text-[10px] !leading-4 ring-2 ring-surface" />}
                </span>
                <span className={isActive ? 'text-fg' : 'text-muted'}>{it.label}</span>
              </>
            )}
          </NavLink>
        ))}
        <button onClick={(e) => openMenu(e, true)} className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-semibold text-muted" aria-label="Профиль и статус">
          <span className="flex h-7 items-center"><Avatar name={user.displayName} src={user.avatarUrl} seed={user.id} size={26} /></span>
          Я
        </button>
      </nav>

      <FloatingMenu anchor={menu} onClose={() => setMenu(null)} width={248}>
        <div className="flex items-center gap-3 px-3 py-2.5">
          <Avatar name={user.displayName} src={user.avatarUrl} seed={user.id} size={40} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{user.displayName}</p>
            <p className="truncate text-xs text-muted">@{user.username}</p>
          </div>
        </div>
        <div className="my-1 border-t border-line/10" />
        <p className="px-3 pb-1 pt-1.5 text-xs font-medium text-muted">Статус: {current.label}</p>
        {ACTIVITIES.map((a) => (
          <button key={a.value} onClick={() => void setActivity(a.value)} className={clsx('flex h-9 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium transition hover:bg-line/10', user.activity === a.value && 'bg-line/10')}>
            <span className={clsx('h-2.5 w-2.5 rounded-full', a.dot)} />
            {a.label}
          </button>
        ))}
        <div className="my-1 border-t border-line/10" />
        <MenuItem icon={<User />} onClick={() => { setMenu(null); navigate(`/@${user.username}`); }}>Мой профиль</MenuItem>
        <MenuItem icon={<Settings />} onClick={() => { setMenu(null); navigate('/settings'); }}>Настройки</MenuItem>
        <MenuItem icon={<LogOut />} danger onClick={() => void logout()}>Выйти</MenuItem>
      </FloatingMenu>
    </div>
  );
}
