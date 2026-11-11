import clsx from 'clsx';
import { MessageCirclePlus, Search, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { listTime } from '../../lib/format';
import { useAuth } from '../../store/auth';
import { chatTitle, useChats } from '../../store/chat';
import { Avatar } from '../Avatar';
import { AppleEmojiText } from '../AppleEmoji';
import { Badge, EmptyState, IconButton, Skeleton } from '../ui';
import { NewChatModal } from './NewChatModal';

export function ChatList({ activeId }: { activeId?: string }) {
  const me = useAuth((s) => s.user)!;
  const chats = useChats((s) => s.chats);
  const loaded = useChats((s) => s.loaded);
  const typing = useChats((s) => s.typing);
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);

  const list = useMemo(() => (q ? chats.filter((c) => chatTitle(c).toLowerCase().includes(q.toLowerCase())) : chats), [chats, q]);

  return (
    <div className="flex h-full flex-col">
      <header className="safe-t px-4 pb-3 pt-5 sm:px-5">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-xl font-semibold tracking-tight">Сообщения</h1>
          <IconButton label="Новый чат" onClick={() => setCreating(true)} className="grad !text-white shadow-glow hover:!bg-transparent hover:brightness-110"><MessageCirclePlus className="h-5 w-5" /></IconButton>
        </div>
        <div className="relative mt-4">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по чатам" aria-label="Поиск по чатам" className="h-11 w-full rounded-xl border border-line/10 bg-raised/70 pl-10 pr-3 text-sm placeholder:text-muted/70 focus:border-accent/60 focus:outline-none focus:ring-4 focus:ring-accent/15" />
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {!loaded ? (
          <div className="space-y-2 px-2">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-[68px]" />)}</div>
        ) : list.length === 0 ? (
          q ? <p className="px-6 py-10 text-center text-sm text-muted">Ничего не найдено</p> : (
            <EmptyState icon={<MessageCirclePlus />} title="Пока нет переписок" text="Выберите друга и напишите первое сообщение или создайте группу." action={<button onClick={() => setCreating(true)} className="grad rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-glow">Новый чат</button>} />
          )
        ) : (
          <ul className="space-y-0.5">
            {list.map((c) => {
              const t = Object.keys(typing[c.id] ?? {}).some((id) => id !== me.id);
              const last = c.lastMessage;
              const preview = last ? `${last.senderId === me.id ? 'Вы: ' : ''}${last.text || (last.hasAttachment ? 'Вложение' : '')}` : c.type === 'GROUP' ? 'Группа создана' : 'Нет сообщений';
              const active = c.id === activeId;
              return (
                <li key={c.id}>
                  <Link to={`/messages/${c.id}`} aria-current={active ? 'page' : undefined} className={clsx('flex items-center gap-3 rounded-2xl px-3 py-3 transition active:scale-[0.99]', active ? 'bg-raised shadow-soft' : 'hover:bg-line/[0.07]')}>
                    <Avatar name={chatTitle(c)} src={c.type === 'GROUP' ? c.avatarUrl : c.peer?.avatarUrl} seed={c.peer?.id ?? c.id} size={50} presence={c.peer?.presence} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-1.5 text-[15px] font-semibold">{c.type === 'GROUP' && <Users className="h-3.5 w-3.5 shrink-0 text-muted" />}<span className="truncate">{chatTitle(c)}</span></span>
                        {last && <span className={clsx('shrink-0 text-xs', c.unread ? 'font-semibold text-accent' : 'text-muted')}>{listTime(last.createdAt)}</span>}
                      </div>
                      <div className="mt-0.5 flex items-center justify-between gap-2">
                        <span className={clsx('truncate text-sm', t ? 'text-accent' : c.unread ? 'text-fg' : 'text-muted')}>{t ? 'печатает…' : last?.text ? <><span>{last.senderId === me.id ? 'Вы: ' : ''}</span><AppleEmojiText text={last.text} /></> : preview}</span>
                        <Badge n={c.unread} />
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {creating && <NewChatModal onClose={() => setCreating(false)} />}
    </div>
  );
}
