import { useAuth } from '../store/auth';
import { useChats } from '../store/chat';
import { useFriends } from '../store/friends';
import { useNotifs } from '../store/notifications';
import { toast, useUi } from '../store/ui';
import type { Chat, Message, NotificationItem } from '../types';
import { go } from './nav';
import { closeSocket, fire, openSocket } from './socket';
import { playTone } from './sounds';

const focused = () => document.visibilityState === 'visible' && document.hasFocus();

function beep() {
  const n = useAuth.getState().user?.notifications;
  if (n?.sound) playTone(n.tone, n.volume);
}

let started = false;

export function startRealtime() {
  if (started) return;
  started = true;
  const s = openSocket();
  const chats = () => useChats.getState();

  s.on('connect', () => {
    useUi.getState().setConnected(true);
    void chats().loadChats();
    void useNotifs.getState().refreshCount();
    const active = chats().activeChatId;
    if (active) void chats().loadMessages(active).catch(() => {});
  });
  s.on('disconnect', () => useUi.getState().setConnected(false));
  s.on('connect_error', (err) => {
    useUi.getState().setConnected(false);
    if (err.message === 'unauthorized') useAuth.getState().setGuest();
  });

  s.on('message:new', (m: Message) => {
    chats().onNew(m);
    if (m.senderId !== useAuth.getState().user?.id && chats().activeChatId === m.chatId && focused()) fire('chat:read', { chatId: m.chatId });
  });
  s.on('message:updated', (m: Message) => chats().onUpdated(m));
  s.on('message:deleted', (p) => chats().onDeleted(p));
  s.on('message:reactions', (p) => chats().onReactions(p));
  s.on('message:pinned', (p) => chats().onPinned(p));
  s.on('chat:updated', (c: Chat) => chats().upsertChat(c));
  s.on('chat:removed', ({ chatId }: { chatId: string }) => {
    chats().removeChat(chatId);
    if (chats().activeChatId === chatId) go('/messages');
  });
  s.on('chats:changed', () => void chats().loadChats());
  s.on('chat:read', (p) => chats().onRead(p));
  s.on('chat:delivered', (p) => chats().onDelivered(p));
  s.on('typing', (p) => chats().onTyping(p));
  s.on('presence', (p) => chats().onPresence(p));
  s.on('friends:changed', () => {
    if (useFriends.getState().data) void useFriends.getState().load();
  });

  s.on('notification:message', (p: { chatId: string; from: string; chatTitle: string | null; preview: string; silent: boolean }) => {
    if (chats().activeChatId === p.chatId && focused()) return;
    if (p.silent) return;
    beep();
    toast.info(`${p.chatTitle ? `${p.chatTitle} · ` : ''}${p.from}: ${p.preview}`.slice(0, 140), { label: 'Открыть', run: () => go(`/messages/${p.chatId}`) });
  });
  s.on('notification:new', (n: NotificationItem & { silent?: boolean }) => {
    useNotifs.getState().add(n);
    if (n.silent) return;
    beep();
    toast.info(n.title);
  });
}

export function stopRealtime() {
  started = false;
  closeSocket();
}
