import { ArrowDown, ArrowLeft, Copy, Flag, Info, MessageCircle, Pencil, Pin, PinOff, Reply, Search, Trash2, User, X } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, errMsg } from '../../lib/api';
import { dayLabel, plural, presenceText } from '../../lib/format';
import { request } from '../../lib/socket';
import { useAuth } from '../../store/auth';
import { chatTitle, useChats } from '../../store/chat';
import { toast } from '../../store/ui';
import type { AttachmentDto, Chat, Message } from '../../types';
import { Avatar } from '../Avatar';
import { AppleEmoji, AppleEmojiText } from '../AppleEmoji';
import { ReportModal } from '../ReportModal';
import { Button, EmptyState, FloatingMenu, IconButton, MenuItem, Modal, Skeleton } from '../ui';
import { Composer } from './Composer';
import { GroupInfo } from './GroupInfo';
import { DaySeparator, MessageBubble } from './MessageBubble';

const QUICK = ['👍', '❤️', '😂', '😮', '😢', '🔥'];
const EMPTY: Message[] = [];

function deliveryStatus(chat: Chat, m: Message, me: string): 'sent' | 'delivered' | 'read' {
  const others = chat.members.filter((x) => x.userId !== me);
  const t = +new Date(m.createdAt);
  if (others.some((o) => +new Date(o.lastReadAt) >= t)) return 'read';
  if (chat.type === 'DIRECT' && others.some((o) => +new Date(o.lastDeliveredAt) >= t)) return 'delivered';
  return 'sent';
}

export function ChatView({ chatId }: { chatId: string }) {
  const me = useAuth((s) => s.user)!;
  const navigate = useNavigate();
  const chat = useChats((s) => s.chats.find((c) => c.id === chatId));
  const loaded = useChats((s) => s.loaded);
  const messages = useChats((s) => s.messages[chatId] ?? EMPTY);
  const hasMore = useChats((s) => s.hasMore[chatId] ?? false);
  const detached = useChats((s) => s.detached[chatId] ?? false);
  const typing = useChats((s) => s.typing[chatId]);
  const st = useChats.getState;

  const [loading, setLoading] = useState(messages.length === 0);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editing, setEditing] = useState<Message | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; m: Message } | null>(null);
  const [confirmDel, setConfirmDel] = useState<Message | null>(null);
  const [report, setReport] = useState<Message | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [info, setInfo] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Message[] | null>(null);
  const [pinned, setPinned] = useState<Message[]>([]);
  const [pinIdx, setPinIdx] = useState(0);
  const [flash, setFlash] = useState<string | null>(null);
  const [atBottom, setAtBottom] = useState(true);

  const listRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const firstScroll = useRef(true);
  const jumpTarget = useRef<string | null>(null);

  // ── Загрузка и «прочитано» ────────────────────────────────
  useEffect(() => {
    st().setActive(chatId);
    st().loadMessages(chatId).catch((e) => toast.error(errMsg(e))).finally(() => setLoading(false));
    return () => st().setActive(null);
  }, [chatId, st]);

  useEffect(() => {
    const read = () => document.visibilityState === 'visible' && st().markRead(chatId);
    read();
    window.addEventListener('focus', read);
    document.addEventListener('visibilitychange', read);
    return () => {
      window.removeEventListener('focus', read);
      document.removeEventListener('visibilitychange', read);
    };
  }, [chatId, st, messages.length]);

  // ── Закреплённые ──────────────────────────────────────────
  const pinKey = messages.filter((m) => m.pinned).map((m) => m.id).join(',');
  useEffect(() => {
    api.get<{ messages: Message[] }>(`/chats/${chatId}/pinned`).then((r) => { setPinned(r.messages); setPinIdx(0); }).catch(() => {});
  }, [chatId, pinKey]);

  // ── Скролл ────────────────────────────────────────────────
  const scrollBottom = useCallback((smooth = false) => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  useLayoutEffect(() => {
    if (messages.length === 0) return;
    if (firstScroll.current) {
      firstScroll.current = false;
      scrollBottom();
      return;
    }
    const last = messages[messages.length - 1];
    if (jumpTarget.current) return;
    if (stick.current || last.senderId === me.id) scrollBottom(true);
  }, [messages.length, scrollBottom, me.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const onScroll = () => {
    const el = listRef.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    stick.current = dist < 140;
    setAtBottom(dist < 300);
    if (el.scrollTop < 120 && hasMore && !loadingOlder && messages.length) void loadOlder();
  };

  const loadOlder = async () => {
    const el = listRef.current;
    const first = messages.find((m) => !m.pending);
    if (!el || !first) return;
    setLoadingOlder(true);
    const prev = el.scrollHeight;
    try {
      await st().loadMessages(chatId, { before: first.id });
      requestAnimationFrame(() => { el.scrollTop += el.scrollHeight - prev; });
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setLoadingOlder(false);
    }
  };

  const jumpTo = useCallback(async (id: string) => {
    const go = () => {
      const el = document.getElementById(`msg-${id}`);
      if (!el) return false;
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      setFlash(id);
      setTimeout(() => setFlash((f) => (f === id ? null : f)), 1700);
      return true;
    };
    if (go()) return;
    try {
      jumpTarget.current = id;
      await st().loadMessages(chatId, { around: id });
      requestAnimationFrame(() => { go(); setTimeout(() => (jumpTarget.current = null), 800); });
    } catch (e) {
      jumpTarget.current = null;
      toast.error(errMsg(e));
    }
  }, [chatId, st]);

  const backToLatest = async () => {
    await st().loadMessages(chatId);
    stick.current = true;
    requestAnimationFrame(() => scrollBottom());
  };

  // ── Поиск ─────────────────────────────────────────────────
  useEffect(() => {
    if (query.trim().length < 2) return setResults(null);
    const t = setTimeout(() => {
      api.get<{ messages: Message[] }>(`/chats/${chatId}/search?q=${encodeURIComponent(query.trim())}`).then((r) => setResults(r.messages)).catch(() => setResults([]));
    }, 350);
    return () => clearTimeout(t);
  }, [query, chatId]);

  // ── Действия ──────────────────────────────────────────────
  const send = useCallback(async (text: string, attachments: AttachmentDto[], reply: Message | null) => {
    if (st().detached[chatId]) await st().loadMessages(chatId);
    const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    st().addPending({
      id: tempId, chatId, senderId: me.id,
      sender: { id: me.id, username: me.username, displayName: me.displayName, avatarUrl: me.avatarUrl },
      text, createdAt: new Date().toISOString(), editedAt: null, pinned: false,
      replyTo: reply ? { id: reply.id, senderId: reply.senderId, senderName: reply.sender.displayName, text: reply.text.slice(0, 140), deleted: false, hasAttachment: reply.attachments.length > 0 } : null,
      attachments, reactions: [], pending: 'sending',
    });
    stick.current = true;
    try {
      const r = await request<{ message: Message }>('message:send', { chatId, text, replyToId: reply?.id, attachmentIds: attachments.map((a) => a.id) });
      st().resolvePending(tempId, r.message);
    } catch (e) {
      st().setPendingState(tempId, 'failed');
      toast.error(errMsg(e));
    }
  }, [chatId, me, st]);

  const retry = (m: Message) => {
    st().dropPending(m.id);
    void send(m.text, m.attachments, null);
  };

  const act = async (event: string, data: Record<string, unknown>) => {
    try {
      return await request<{ message?: Message }>(event, data);
    } catch (e) {
      toast.error(errMsg(e));
      return null;
    }
  };

  const react = (m: Message, emoji: string) => void act('message:react', { id: m.id, emoji });

  const onMenu = useCallback((e: React.MouseEvent, m: Message) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const fromButton = (e.currentTarget as HTMLElement).tagName === 'BUTTON';
    setMenu({ x: fromButton ? r.left : e.clientX, y: fromButton ? r.bottom + 4 : e.clientY, m });
  }, []);

  const items = useMemo(() => {
    const out: ({ kind: 'day'; label: string; key: string } | { kind: 'msg'; m: Message; first: boolean; last: boolean })[] = [];
    messages.forEach((m, i) => {
      const prev = messages[i - 1];
      const next = messages[i + 1];
      const newDay = !prev || new Date(prev.createdAt).toDateString() !== new Date(m.createdAt).toDateString();
      if (newDay) out.push({ kind: 'day', label: dayLabel(m.createdAt), key: `d-${m.id}` });
      const gap = (a: Message, b: Message) => a.senderId !== b.senderId || +new Date(b.createdAt) - +new Date(a.createdAt) > 5 * 60_000;
      const nextNewDay = next && new Date(next.createdAt).toDateString() !== new Date(m.createdAt).toDateString();
      out.push({ kind: 'msg', m, first: newDay || gap(prev, m), last: !next || nextNewDay || gap(m, next) });
    });
    return out;
  }, [messages]);

  // ── Состояния без чата ────────────────────────────────────
  if (!chat) {
    return loaded ? (
      <div className="flex h-full items-center justify-center"><EmptyState icon={<MessageCircle />} title="Чат не найден" text="Возможно, вы вышли из группы или чат был удалён." action={<Link to="/messages"><Button>К списку чатов</Button></Link>} /></div>
    ) : (
      <div className="space-y-3 p-6"><Skeleton className="h-14" /><Skeleton className="h-10 w-2/3" /><Skeleton className="ml-auto h-10 w-1/2" /></div>
    );
  }

  const typers = Object.keys(typing ?? {}).filter((id) => id !== me.id);
  const typerName = chat.type === 'GROUP' ? chat.members.find((m) => m.userId === typers[0])?.user.displayName : null;
  const subtitle = typers.length
    ? <span className="text-accent">{chat.type === 'GROUP' ? `${typerName ?? 'Кто-то'} печатает…` : 'печатает…'}</span>
    : chat.type === 'GROUP'
      ? `${chat.members.length} ${plural(chat.members.length, 'участник', 'участника', 'участников')}`
      : chat.peer ? presenceText(chat.peer.presence) : '';
  const title = chatTitle(chat);
  const mm = menu?.m;
  const mine = mm?.senderId === me.id;
  const staff = chat.type === 'GROUP' && chat.myRole !== 'MEMBER';
  const canPin = chat.type === 'DIRECT' || staff;
  const curPin = pinned[pinIdx % Math.max(1, pinned.length)];

  return (
    <div className="flex h-full flex-col">
      <header className="glass safe-t flex shrink-0 items-center gap-2 border-x-0 border-t-0 px-2 py-2.5 sm:px-4">
        <IconButton label="Назад к чатам" className="md:hidden" onClick={() => navigate('/messages')}><ArrowLeft className="h-5 w-5" /></IconButton>
        <button onClick={() => (chat.type === 'GROUP' ? setInfo(true) : chat.peer && navigate(`/@${chat.peer.username}`))} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-1.5 py-1 text-left transition hover:bg-line/10">
          <Avatar name={title} src={chat.type === 'GROUP' ? chat.avatarUrl : chat.peer?.avatarUrl} seed={chat.peer?.id ?? chat.id} size={42} presence={chat.peer?.presence} />
          <span className="min-w-0">
            <span className="block truncate font-display text-[15px] font-semibold">{title}</span>
            <span className="block truncate text-xs text-muted">{subtitle}</span>
          </span>
        </button>
        <IconButton label="Поиск по переписке" active={searchOpen} onClick={() => { setSearchOpen((v) => !v); setQuery(''); }}><Search className="h-5 w-5" /></IconButton>
        {chat.type === 'GROUP' ? (
          <IconButton label="О группе" onClick={() => setInfo(true)}><Info className="h-5 w-5" /></IconButton>
        ) : chat.peer && (
          <IconButton label="Профиль" onClick={() => navigate(`/@${chat.peer!.username}`)}><User className="h-5 w-5" /></IconButton>
        )}
      </header>

      {searchOpen && (
        <div className="shrink-0 border-b border-line/10 bg-surface/70 px-3 py-2.5 sm:px-5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Найти в этом чате" aria-label="Поиск по переписке" className="h-10 w-full rounded-xl border border-line/10 bg-raised pl-10 pr-10 text-sm focus:border-accent/60 focus:outline-none focus:ring-4 focus:ring-accent/15" />
            {query && <button onClick={() => setQuery('')} aria-label="Очистить" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-fg"><X className="h-4 w-4" /></button>}
          </div>
          {results && (
            <div className="mt-2 max-h-60 overflow-y-auto rounded-xl bg-raised/60">
              {results.length === 0 ? <p className="p-4 text-center text-sm text-muted">Ничего не найдено</p> : results.map((r) => (
                <button key={r.id} onClick={() => { setSearchOpen(false); setQuery(''); void jumpTo(r.id); }} className="flex w-full items-start gap-3 px-3 py-2.5 text-left transition hover:bg-line/10">
                  <Avatar name={r.sender.displayName} src={r.sender.avatarUrl} seed={r.senderId} size={30} />
                  <span className="min-w-0 flex-1 text-sm"><span className="flex justify-between gap-2"><b className="truncate">{r.sender.displayName}</b><span className="shrink-0 text-xs text-muted">{dayLabel(r.createdAt)}</span></span><span className="line-clamp-2 break-words text-muted"><AppleEmojiText text={r.text} /></span></span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {curPin && (
        <button onClick={() => { void jumpTo(curPin.id); setPinIdx((i) => i + 1); }} className="flex shrink-0 items-center gap-3 border-b border-line/10 bg-surface/60 px-4 py-2 text-left transition hover:bg-line/5">
          <Pin className="h-4 w-4 shrink-0 text-accent" />
          <span className="min-w-0 flex-1 text-sm"><span className="block text-xs font-bold text-accent">Закреплённое{pinned.length > 1 ? ` ${(pinIdx % pinned.length) + 1} из ${pinned.length}` : ''}</span><span className="block truncate text-muted">{curPin.text ? <AppleEmojiText text={curPin.text} /> : 'Вложение'}</span></span>
        </button>
      )}

      <div className="relative min-h-0 flex-1">
        <div ref={listRef} onScroll={onScroll} className="h-full overflow-y-auto px-2 pb-3 pt-1 sm:px-4" role="log" aria-live="polite" aria-label="Сообщения">
          {loadingOlder && <div className="py-3"><Skeleton className="mx-auto h-8 w-40" /></div>}
          {loading && messages.length === 0 && (
            <div className="space-y-3 pt-6"><Skeleton className="h-12 w-2/5" /><Skeleton className="ml-auto h-12 w-1/2" /><Skeleton className="h-16 w-3/5" /><Skeleton className="ml-auto h-10 w-1/3" /></div>
          )}
          {!loading && messages.length === 0 && (
            <EmptyState
              icon={<MessageCircle />}
              title={chat.type === 'GROUP' ? 'В группе пока тихо' : `Начните разговор с ${chat.peer?.displayName ?? 'собеседником'}`}
              text={chat.canSend ? 'Напишите первое сообщение — оно появится здесь. Можно отправить фото, файл или эмодзи.' : 'Писать в этот чат сейчас нельзя.'}
            />
          )}
          {items.map((it) =>
            it.kind === 'day' ? (
              <DaySeparator key={it.key}>{it.label}</DaySeparator>
            ) : (
              <MessageBubble key={it.m.id} m={it.m} chat={chat} mine={it.m.senderId === me.id} meId={me.id} first={it.first} last={it.last}
                status={deliveryStatus(chat, it.m, me.id)} highlight={flash === it.m.id}
                onMenu={onMenu} onReact={react} onJump={(id) => void jumpTo(id)} onImage={setLightbox} onRetry={retry} />
            ),
          )}
          {typers.length > 0 && (
            <div className="mt-2 flex px-2"><span className="inline-flex items-center gap-1 rounded-2xl rounded-bl-md bg-raised px-4 py-3" aria-label="печатает">
              {[0, 1, 2].map((i) => <span key={i} className="h-1.5 w-1.5 animate-dot rounded-full bg-muted" style={{ animationDelay: `${i * 0.18}s` }} />)}
            </span></div>
          )}
        </div>
        {(!atBottom || detached) && (
          <button onClick={() => (detached ? void backToLatest() : scrollBottom(true))} className="glass absolute bottom-4 right-4 inline-flex h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold shadow-soft transition active:scale-95">
            <ArrowDown className="h-4 w-4" />{detached ? 'К последним' : ''}
          </button>
        )}
      </div>

      <Composer
        chat={chat} replyTo={replyTo} editing={editing}
        onCancel={() => { setReplyTo(null); setEditing(null); }}
        onSend={(t, a) => { const r = replyTo; setReplyTo(null); void send(t, a, r); }}
        onEdit={async (t) => { const e = editing!; if (t === e.text) { setEditing(null); return true; } const r = await act('message:edit', { id: e.id, text: t }); if (!r?.message) return false; st().onUpdated(r.message); setEditing(null); return true; }}
      />

      <FloatingMenu anchor={menu} onClose={() => setMenu(null)} width={236}>
        {mm && (
          <>
            <div className="flex justify-between px-1.5 pb-1.5 pt-1">
              {QUICK.map((e) => <button key={e} onClick={() => { react(mm, e); setMenu(null); }} className="flex h-9 w-9 items-center justify-center rounded-full transition hover:scale-125 hover:bg-line/10"><AppleEmoji value={e} size={24} /></button>)}
            </div>
            <div className="mb-1 border-t border-line/10" />
            <MenuItem icon={<Reply />} onClick={() => { setReplyTo(mm); setEditing(null); setMenu(null); }}>Ответить</MenuItem>
            {mm.text && <MenuItem icon={<Copy />} onClick={() => { void navigator.clipboard?.writeText(mm.text).then(() => toast.success('Текст скопирован')).catch(() => toast.error('Не удалось скопировать')); setMenu(null); }}>Копировать текст</MenuItem>}
            {mine && mm.text && <MenuItem icon={<Pencil />} onClick={() => { setEditing(mm); setReplyTo(null); setMenu(null); }}>Редактировать</MenuItem>}
            {canPin && <MenuItem icon={mm.pinned ? <PinOff /> : <Pin />} onClick={() => { void act('message:pin', { id: mm.id, pinned: !mm.pinned }); setMenu(null); }}>{mm.pinned ? 'Открепить' : 'Закрепить'}</MenuItem>}
            {!mine && <MenuItem icon={<Flag />} onClick={() => { setReport(mm); setMenu(null); }}>Пожаловаться</MenuItem>}
            {(mine || staff) && <MenuItem icon={<Trash2 />} danger onClick={() => { setConfirmDel(mm); setMenu(null); }}>Удалить</MenuItem>}
          </>
        )}
      </FloatingMenu>

      <Modal open={!!confirmDel} onClose={() => setConfirmDel(null)} title="Удалить сообщение?" size="sm">
        <p className="mb-5 text-sm text-muted">Сообщение исчезнет у всех участников. Это действие нельзя отменить.</p>
        <div className="flex gap-3">
          <Button variant="soft" className="flex-1" onClick={() => setConfirmDel(null)}>Отмена</Button>
          <Button variant="danger" className="flex-1" onClick={() => { const m = confirmDel!; setConfirmDel(null); void act('message:delete', { id: m.id }); }}>Удалить</Button>
        </div>
      </Modal>

      <Modal open={!!lightbox} onClose={() => setLightbox(null)} size="xl">
        {lightbox && <img src={lightbox} alt="" className="mx-auto max-h-[75dvh] rounded-xl object-contain" />}
      </Modal>

      {report && <ReportModal userId={report.senderId} userName={report.sender.displayName} messageId={report.id} onClose={() => setReport(null)} />}
      {info && chat.type === 'GROUP' && <GroupInfo chat={chat} onClose={() => setInfo(false)} />}
    </div>
  );
}
