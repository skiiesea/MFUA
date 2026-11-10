import { Check, MessageCircle, Search as SearchIcon, UserPlus, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Page, PageHeader } from '../components/Page';
import { UserRow } from '../components/UserRow';
import { EmptyState, IconButton, Input, Skeleton } from '../components/ui';
import { api, errMsg } from '../lib/api';
import { useChats } from '../store/chat';
import { useFriends } from '../store/friends';
import { toast } from '../store/ui';
import type { Card, Chat } from '../types';

export function SearchPage() {
  const [q, setQ] = useState('');
  const [users, setUsers] = useState<Card[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState<Set<string>>(new Set());
  const navigate = useNavigate();
  const upsert = useChats((s) => s.upsertChat);
  const term = q.trim();

  useEffect(() => {
    if (term.replace('@', '').length < 2) {
      setUsers(null);
      return;
    }
    setLoading(true);
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const r = await api.get<{ users: Card[] }>(`/users/search?q=${encodeURIComponent(term)}`);
        if (!cancelled) setUsers(r.users);
      } catch (e) {
        if (!cancelled) toast.error(errMsg(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [term]);

  const add = async (u: Card) => {
    try {
      await api.post('/friends/requests', { userId: u.id });
      setSent((s) => new Set(s).add(u.id));
      toast.success(`Заявка отправлена: ${u.displayName}`);
      void useFriends.getState().load();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };
  const write = async (u: Card) => {
    try {
      const r = await api.post<{ chat: Chat }>('/chats/direct', { userId: u.id });
      upsert(r.chat);
      navigate(`/messages/${r.chat.id}`);
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <Page>
      <PageHeader title="Поиск" subtitle="Ищите людей по логину или имени" />
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Например, @alex или Алекс" aria-label="Поиск людей" icon={<SearchIcon className="h-4 w-4" />} autoFocus className="[&_input]:h-12" />
      <div className="card mt-5 p-2">
        {loading && !users ? <div className="space-y-2 p-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16" />)}</div>
          : users === null ? <EmptyState icon={<Users />} title="Найдите знакомых" text="Введите минимум два символа. Можно искать и по логину, и по отображаемому имени." />
          : users.length === 0 ? <EmptyState icon={<SearchIcon />} title="Никого не нашли" text="Проверьте написание. Заблокированные и скрытые аккаунты в поиске не показываются." />
          : users.map((u) => (
            <UserRow key={u.id} user={u} actions={<>
              <IconButton label="Написать" onClick={() => void write(u)}><MessageCircle className="h-5 w-5" /></IconButton>
              {u.isFriend ? <span className="px-2 text-xs font-semibold text-ok">Друг</span> : sent.has(u.id) ? <span className="inline-flex items-center gap-1 px-2 text-xs font-semibold text-muted"><Check className="h-4 w-4" />Отправлено</span> : <IconButton label="Добавить в друзья" onClick={() => void add(u)} className="!text-accent"><UserPlus className="h-5 w-5" /></IconButton>}
            </>} />
          ))}
      </div>
    </Page>
  );
}
