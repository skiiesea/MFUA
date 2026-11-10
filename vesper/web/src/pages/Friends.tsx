import { Ban, Check, MessageCircle, Search, UserMinus, UserPlus, Users, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Page, PageHeader } from '../components/Page';
import { UserRow } from '../components/UserRow';
import { Button, EmptyState, IconButton, Skeleton, Tabs } from '../components/ui';
import { api, errMsg } from '../lib/api';
import { useChats } from '../store/chat';
import { useFriends } from '../store/friends';
import { toast } from '../store/ui';
import type { Chat } from '../types';

type Tab = 'friends' | 'incoming' | 'outgoing' | 'blocked';

export function FriendsPage() {
  const data = useFriends((s) => s.data);
  const [tab, setTab] = useState<Tab>('friends');
  const [busy, setBusy] = useState<string | null>(null);
  const navigate = useNavigate();
  const upsert = useChats((s) => s.upsertChat);

  useEffect(() => {
    useFriends.getState().load().catch((e) => toast.error(errMsg(e)));
  }, []);

  const run = async (key: string, fn: () => Promise<unknown>, ok?: string) => {
    setBusy(key);
    try {
      await fn();
      await useFriends.getState().load();
      if (ok) toast.success(ok);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(null);
    }
  };

  const write = async (userId: string) => {
    try {
      const r = await api.post<{ chat: Chat }>('/chats/direct', { userId });
      upsert(r.chat);
      navigate(`/messages/${r.chat.id}`);
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const empty: Record<Tab, { title: string; text: string }> = {
    friends: { title: 'Список друзей пуст', text: 'Найдите знакомых по логину или имени и отправьте им заявку.' },
    incoming: { title: 'Нет входящих заявок', text: 'Когда кто-то захочет добавить вас в друзья, заявка появится здесь.' },
    outgoing: { title: 'Нет исходящих заявок', text: 'Отправленные вами заявки, на которые ещё не ответили, будут здесь.' },
    blocked: { title: 'Чёрный список пуст', text: 'Заблокированные пользователи не смогут вам писать и отправлять заявки.' },
  };

  const rows = data
    ? {
        friends: data.friends.map((f) => (
          <UserRow key={f.user.id} user={f.user} actions={<>
            <IconButton label="Написать" onClick={() => void write(f.user.id)}><MessageCircle className="h-5 w-5" /></IconButton>
            <IconButton label="Удалить из друзей" className="hover:!text-danger" disabled={busy === f.user.id} onClick={() => void run(f.user.id, () => api.del(`/friends/${f.user.id}`), 'Удалён из друзей')}><UserMinus className="h-5 w-5" /></IconButton>
          </>} />
        )),
        incoming: data.incoming.map((r) => (
          <UserRow key={r.id} user={r.user} actions={<>
            <Button size="sm" icon={<Check className="h-4 w-4" />} loading={busy === r.id} onClick={() => void run(r.id, () => api.post(`/friends/requests/${r.id}/accept`), 'Заявка принята')}>Принять</Button>
            <IconButton label="Отклонить" disabled={busy === r.id} onClick={() => void run(r.id, () => api.del(`/friends/requests/${r.id}`))}><X className="h-5 w-5" /></IconButton>
          </>} />
        )),
        outgoing: data.outgoing.map((r) => (
          <UserRow key={r.id} user={r.user} sub="ждёт ответа" actions={<Button size="sm" variant="soft" loading={busy === r.id} onClick={() => void run(r.id, () => api.del(`/friends/requests/${r.id}`), 'Заявка отменена')}>Отменить</Button>} />
        )),
        blocked: data.blocked.map((b) => (
          <UserRow key={b.user.id} user={b.user} actions={<Button size="sm" variant="soft" icon={<Ban className="h-4 w-4" />} loading={busy === b.user.id} onClick={() => void run(b.user.id, () => api.del(`/blocks/${b.user.id}`), 'Пользователь разблокирован')}>Разблокировать</Button>} />
        )),
      }[tab]
    : null;

  return (
    <Page>
      <PageHeader title="Друзья" subtitle="Заявки, список друзей и чёрный список" actions={<Link to="/search"><Button variant="soft" icon={<Search className="h-4 w-4" />}>Найти людей</Button></Link>} />
      <div className="mb-4 overflow-x-auto">
        <Tabs value={tab} onChange={setTab} tabs={[
          { value: 'friends', label: 'Друзья', count: 0 },
          { value: 'incoming', label: 'Входящие', count: data?.incoming.length },
          { value: 'outgoing', label: 'Исходящие' },
          { value: 'blocked', label: 'Чёрный список' },
        ]} />
      </div>
      <div className="card p-2">
        {!rows ? <div className="space-y-2 p-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16" />)}</div> : rows.length === 0 ? (
          <EmptyState icon={tab === 'friends' ? <Users /> : tab === 'blocked' ? <Ban /> : <UserPlus />} title={empty[tab].title} text={empty[tab].text}
            action={tab === 'friends' ? <Link to="/search"><Button icon={<Search className="h-4 w-4" />}>Найти людей</Button></Link> : undefined} />
        ) : rows}
      </div>
      {data && tab === 'friends' && data.friends.length > 0 && <p className="mt-3 px-1 text-xs text-muted">Всего друзей: {data.friends.length}</p>}
    </Page>
  );
}
