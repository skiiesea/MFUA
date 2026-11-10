import { useEffect } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { LogoMark } from './components/Logo';
import { Toasts } from './components/Toasts';
import { AppShell } from './layout/AppShell';
import { setUnauthorizedHandler } from './lib/api';
import { setNavigate } from './lib/nav';
import { stopRealtime } from './lib/realtime';
import { useChats } from './store/chat';
import { useFriends } from './store/friends';
import { useNotifs } from './store/notifications';
import { AdminPage } from './pages/Admin';
import { FriendsPage } from './pages/Friends';
import { HomePage } from './pages/Home';
import { LoginPage } from './pages/Login';
import { MessagesPage } from './pages/Messages';
import { NotificationsPage } from './pages/Notifications';
import { ProfileRoute } from './pages/Profile';
import { RegisterPage } from './pages/Register';
import { SearchPage } from './pages/Search';
import { SettingsPage } from './pages/Settings';
import { VerifyEmailPage } from './pages/VerifyEmail';
import { useAuth } from './store/auth';

function Splash() {
  return (
    <div className="flex h-[100dvh] items-center justify-center">
      <div className="animate-pulse"><LogoMark size={64} /></div>
    </div>
  );
}

function RequireAuth() {
  const status = useAuth((s) => s.status);
  const loc = useLocation();
  if (status === 'guest') return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  return <Outlet />;
}

function GuestOnly() {
  const status = useAuth((s) => s.status);
  if (status === 'authed') return <Navigate to="/" replace />;
  return <Outlet />;
}

function NotFound() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <p className="grad-text font-display text-6xl font-semibold">404</p>
      <p className="text-muted">Такой страницы нет. Возможно, ссылка устарела.</p>
    </div>
  );
}

export default function App() {
  const navigate = useNavigate();
  const status = useAuth((s) => s.status);

  useEffect(() => {
    setNavigate(navigate);
    setUnauthorizedHandler(() => useAuth.getState().setGuest());
    void useAuth.getState().init();
  }, [navigate]);

  useEffect(() => {
    if (status === 'guest') {
      stopRealtime();
      // не оставляем чужие данные в памяти после выхода (следующий вход в этой же вкладке)
      useChats.setState({ chats: [], loaded: false, messages: {}, hasMore: {}, detached: {}, typing: {}, activeChatId: null });
      useNotifs.setState({ items: [], unread: 0, hasMore: false, loaded: false });
      useFriends.setState({ data: null });
    }
  }, [status]);

  if (status === 'loading') return <Splash />;

  return (
    <>
      <Toasts />
      <Routes>
        <Route element={<GuestOnly />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route element={<RequireAuth />}>
          <Route element={<AppShell />}>
            <Route index element={<HomePage />} />
            <Route path="messages" element={<MessagesPage />} />
            <Route path="messages/:chatId" element={<MessagesPage />} />
            <Route path="friends" element={<FriendsPage />} />
            <Route path="search" element={<SearchPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="me" element={<ProfileRoute self />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="settings/:section" element={<SettingsPage />} />
            <Route path="admin" element={<AdminPage />} />
            <Route path="admin/:tab" element={<AdminPage />} />
            <Route path=":handle" element={<ProfileRoute />} />
          </Route>
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}
