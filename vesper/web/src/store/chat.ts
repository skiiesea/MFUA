import { create } from 'zustand';
import { api } from '../lib/api';
import { fire } from '../lib/socket';
import type { Chat, Message, Presence } from '../types';
import { useAuth } from './auth';

const meId = () => useAuth.getState().user?.id ?? '';
const focused = () => document.visibilityState === 'visible' && document.hasFocus();
const byRecent = (a: Chat, b: Chat) => +new Date(b.lastMessageAt) - +new Date(a.lastMessageAt);

interface ChatState {
  chats: Chat[];
  loaded: boolean;
  messages: Record<string, Message[]>;
  hasMore: Record<string, boolean>;
  detached: Record<string, boolean>;
  typing: Record<string, Record<string, number>>;
  activeChatId: string | null;

  loadChats: () => Promise<void>;
  setActive: (id: string | null) => void;
  upsertChat: (c: Chat) => void;
  removeChat: (id: string) => void;
  loadMessages: (chatId: string, opts?: { before?: string; around?: string }) => Promise<void>;
  markRead: (chatId: string) => void;

  addPending: (m: Message) => void;
  resolvePending: (tempId: string, real: Message) => void;
  setPendingState: (tempId: string, state: 'sending' | 'failed') => void;
  dropPending: (tempId: string) => void;

  onNew: (m: Message) => void;
  onUpdated: (m: Message) => void;
  onDeleted: (p: { chatId: string; messageId: string }) => void;
  onReactions: (p: { chatId: string; messageId: string; reactions: Message['reactions'] }) => void;
  onPinned: (p: { chatId: string; messageId: string; pinned: boolean }) => void;
  onRead: (p: { chatId: string; userId: string; at: string }) => void;
  onDelivered: (p: { chatId: string; userIds: string[]; at: string }) => void;
  onTyping: (p: { chatId: string; userId: string; typing: boolean }) => void;
  onPresence: (p: { userId: string } & Presence) => void;
}

const mapMsgs = (s: ChatState, chatId: string, fn: (m: Message) => Message) =>
  s.messages[chatId] ? { messages: { ...s.messages, [chatId]: s.messages[chatId].map(fn) } } : {};

export const useChats = create<ChatState>()((set, get) => ({
  chats: [],
  loaded: false,
  messages: {},
  hasMore: {},
  detached: {},
  typing: {},
  activeChatId: null,

  loadChats: async () => {
    const r = await api.get<{ chats: Chat[] }>('/chats');
    set({ chats: r.chats.sort(byRecent), loaded: true });
  },
  setActive: (activeChatId) => set({ activeChatId }),
  upsertChat: (c) =>
    set((s) => {
      const prev = s.chats.find((x) => x.id === c.id);
      // не затираем локально обнулённый счётчик, пока чат открыт
      const unread = s.activeChatId === c.id && focused() ? 0 : c.unread;
      const next = { ...c, unread };
      return { chats: (prev ? s.chats.map((x) => (x.id === c.id ? next : x)) : [next, ...s.chats]).sort(byRecent) };
    }),
  removeChat: (id) =>
    set((s) => {
      const { [id]: _m, ...messages } = s.messages;
      return { chats: s.chats.filter((c) => c.id !== id), messages };
    }),

  loadMessages: async (chatId: string, opts: { before?: string; around?: string } = {}) => {
    const q = new URLSearchParams();
    if (opts.before) q.set('before', opts.before);
    if (opts.around) q.set('around', opts.around);
    const r = await api.get<{ messages: Message[]; hasMore: boolean; detached: boolean }>(`/chats/${chatId}/messages?${q}`);
    set((s) => {
      const cur = s.messages[chatId] ?? [];
      let list = r.messages;
      if (opts.before) {
        const ids = new Set(cur.map((m) => m.id));
        list = [...r.messages.filter((m) => !ids.has(m.id)), ...cur];
      }
      return {
        messages: { ...s.messages, [chatId]: list },
        hasMore: { ...s.hasMore, [chatId]: r.hasMore },
        detached: opts.before ? s.detached : { ...s.detached, [chatId]: r.detached },
      };
    });
  },

  markRead: (chatId) => {
    const c = get().chats.find((x) => x.id === chatId);
    if (!c || c.unread === 0) return;
    set((s) => ({ chats: s.chats.map((x) => (x.id === chatId ? { ...x, unread: 0 } : x)) }));
    fire('chat:read', { chatId });
  },

  addPending: (m) => set((s) => ({ messages: { ...s.messages, [m.chatId]: [...(s.messages[m.chatId] ?? []), m] } })),
  resolvePending: (tempId, real) =>
    set((s) => {
      const list = s.messages[real.chatId] ?? [];
      const has = list.some((m) => m.id === real.id);
      const next = list.filter((m) => m.id !== tempId);
      return { messages: { ...s.messages, [real.chatId]: has ? next : [...next, real] } };
    }),
  setPendingState: (tempId, state) =>
    set((s) => {
      const out: Record<string, Message[]> = {};
      for (const [k, v] of Object.entries(s.messages)) out[k] = v.map((m) => (m.id === tempId ? { ...m, pending: state } : m));
      return { messages: out };
    }),
  dropPending: (tempId) =>
    set((s) => {
      const out: Record<string, Message[]> = {};
      for (const [k, v] of Object.entries(s.messages)) out[k] = v.filter((m) => m.id !== tempId);
      return { messages: out };
    }),

  onNew: (m) => {
    const me = meId();
    let missing = false;
    set((s) => {
      let messages = s.messages;
      const list = s.messages[m.chatId];
      if (list && !s.detached[m.chatId] && !list.some((x) => x.id === m.id)) {
        let base = list;
        if (m.senderId === me) {
          const i = base.findIndex((x) => x.pending && x.text === m.text && x.attachments.length === m.attachments.length);
          if (i >= 0) base = base.filter((_, idx) => idx !== i);
        }
        messages = { ...s.messages, [m.chatId]: [...base, m] };
      }
      const chat = s.chats.find((c) => c.id === m.chatId);
      if (!chat) {
        missing = true;
        return { messages };
      }
      const seen = s.activeChatId === m.chatId && focused();
      const updated: Chat = {
        ...chat,
        lastMessage: { id: m.id, text: m.text.slice(0, 140), senderId: m.senderId, createdAt: m.createdAt, hasAttachment: m.attachments.length > 0 },
        lastMessageAt: m.createdAt,
        unread: m.senderId !== me && !seen ? chat.unread + 1 : chat.unread,
      };
      const typing = { ...s.typing, [m.chatId]: { ...(s.typing[m.chatId] ?? {}) } };
      delete typing[m.chatId][m.senderId];
      return { messages, typing, chats: s.chats.map((c) => (c.id === m.chatId ? updated : c)).sort(byRecent) };
    });
    if (missing) void get().loadChats();
  },
  onUpdated: (m) =>
    set((s) => ({
      ...mapMsgs(s, m.chatId, (x) => (x.id === m.id ? m : x)),
      chats: s.chats.map((c) => (c.id === m.chatId && c.lastMessage?.id === m.id ? { ...c, lastMessage: { ...c.lastMessage, text: m.text.slice(0, 140) } } : c)),
    })),
  onDeleted: ({ chatId, messageId }) => {
    set((s) => ({
      messages: s.messages[chatId] ? { ...s.messages, [chatId]: s.messages[chatId].filter((m) => m.id !== messageId).map((m) => (m.replyTo?.id === messageId ? { ...m, replyTo: { ...m.replyTo, deleted: true, text: null } } : m)) } : s.messages,
    }));
    if (get().chats.find((c) => c.id === chatId)?.lastMessage?.id === messageId) void get().loadChats();
  },
  onReactions: ({ chatId, messageId, reactions }) => set((s) => mapMsgs(s, chatId, (m) => (m.id === messageId ? { ...m, reactions } : m))),
  onPinned: ({ chatId, messageId, pinned }) => set((s) => mapMsgs(s, chatId, (m) => (m.id === messageId ? { ...m, pinned } : m))),
  onRead: ({ chatId, userId, at }) =>
    set((s) => ({
      chats: s.chats.map((c) =>
        c.id === chatId
          ? { ...c, unread: userId === meId() ? 0 : c.unread, members: c.members.map((m) => (m.userId === userId ? { ...m, lastReadAt: at, lastDeliveredAt: at } : m)) }
          : c,
      ),
    })),
  onDelivered: ({ chatId, userIds, at }) =>
    set((s) => ({
      chats: s.chats.map((c) => (c.id === chatId ? { ...c, members: c.members.map((m) => (userIds.includes(m.userId) ? { ...m, lastDeliveredAt: at } : m)) } : c)),
    })),
  onTyping: ({ chatId, userId, typing }) => {
    const expires = Date.now() + 4000;
    set((s) => {
      const cur = { ...(s.typing[chatId] ?? {}) };
      if (typing) cur[userId] = expires;
      else delete cur[userId];
      return { typing: { ...s.typing, [chatId]: cur } };
    });
    if (typing) {
      setTimeout(() => {
        const cur = get().typing[chatId];
        if (cur && cur[userId] === expires) get().onTyping({ chatId, userId, typing: false });
      }, 4100);
    }
  },
  onPresence: ({ userId, online, lastSeenAt, activity }) =>
    set((s) => ({
      chats: s.chats.map((c) => ({
        ...c,
        peer: c.peer && c.peer.id === userId ? { ...c.peer, presence: { online, lastSeenAt, activity } } : c.peer,
        members: c.members.map((m) => (m.userId === userId ? { ...m, user: { ...m.user, presence: { online, lastSeenAt, activity } } } : m)),
      })),
    })),
}));

export const selectUnreadTotal = (s: ChatState) => s.chats.reduce((n, c) => n + c.unread, 0);
export const chatTitle = (c: Chat) => (c.type === 'GROUP' ? c.title ?? 'Группа' : c.peer?.displayName ?? 'Диалог');
