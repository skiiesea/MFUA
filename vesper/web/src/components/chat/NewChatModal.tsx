import { Search, UserPlus, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, errMsg } from '../../lib/api';
import { useChats } from '../../store/chat';
import { useFriends } from '../../store/friends';
import { toast } from '../../store/ui';
import type { Chat } from '../../types';
import { Avatar } from '../Avatar';
import { Button, EmptyState, Input, Modal, Spinner, Tabs, Textarea } from '../ui';

export function NewChatModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const upsert = useChats((s) => s.upsertChat);
  const data = useFriends((s) => s.data);
  const [tab, setTab] = useState<'direct' | 'group'>('direct');
  const [q, setQ] = useState('');
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void useFriends.getState().load().catch(() => {});
  }, []);

  const friends = (data?.friends ?? []).filter((f) => !q || f.user.displayName.toLowerCase().includes(q.toLowerCase()) || f.user.username.includes(q.toLowerCase().replace('@', '')));

  const openDirect = async (userId: string) => {
    setBusy(true);
    try {
      const r = await api.post<{ chat: Chat }>('/chats/direct', { userId });
      upsert(r.chat);
      onClose();
      navigate(`/messages/${r.chat.id}`);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const createGroup = async () => {
    setBusy(true);
    try {
      const r = await api.post<{ chat: Chat }>('/chats/group', { title: title.trim(), description: desc.trim() || undefined, memberIds: picked });
      upsert(r.chat);
      onClose();
      navigate(`/messages/${r.chat.id}`);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Новый чат">
      <div className="space-y-4">
        <Tabs value={tab} onChange={setTab} tabs={[{ value: 'direct', label: 'Личный' }, { value: 'group', label: 'Группа' }]} />
        {tab === 'group' && (
          <>
            <Input label="Название группы" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} icon={<Users className="h-4 w-4" />} placeholder="Например, Поход в горы" />
            <Textarea label="Описание (необязательно)" value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={300} className="[&_textarea]:min-h-[64px]" />
          </>
        )}
        {!data ? <div className="flex justify-center py-8"><Spinner /></div> : data.friends.length === 0 ? (
          <EmptyState icon={<UserPlus />} title="Пока нет друзей" text="Писать можно друзьям и тем, кто разрешил сообщения от всех. Найдите человека по логину." action={<Link to="/search" onClick={onClose}><Button icon={<Search className="h-4 w-4" />}>Найти людей</Button></Link>} />
        ) : (
          <>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск среди друзей" aria-label="Поиск среди друзей" icon={<Search className="h-4 w-4" />} />
            <ul className="max-h-[40dvh] space-y-0.5 overflow-y-auto">
              {friends.map((f) => {
                const checked = picked.includes(f.user.id);
                return (
                  <li key={f.user.id}>
                    <button disabled={busy} onClick={() => (tab === 'direct' ? void openDirect(f.user.id) : setPicked((p) => (checked ? p.filter((x) => x !== f.user.id) : [...p, f.user.id])))} className="flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition hover:bg-line/10">
                      <Avatar name={f.user.displayName} src={f.user.avatarUrl} seed={f.user.id} size={40} presence={f.user.presence} />
                      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{f.user.displayName}</span><span className="block truncate text-xs text-muted">@{f.user.username}</span></span>
                      {tab === 'group' && <input type="checkbox" readOnly checked={checked} tabIndex={-1} className="h-4 w-4 accent-[rgb(var(--c-accent))]" />}
                    </button>
                  </li>
                );
              })}
              {friends.length === 0 && <li className="py-6 text-center text-sm text-muted">Никого не нашли</li>}
            </ul>
          </>
        )}
        {tab === 'group' && <Button className="w-full" size="lg" loading={busy} disabled={!title.trim() || picked.length === 0} onClick={createGroup}>Создать группу{picked.length ? ` (${picked.length + 1})` : ''}</Button>}
      </div>
    </Modal>
  );
}
