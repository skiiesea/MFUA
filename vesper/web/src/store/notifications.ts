import { create } from 'zustand';
import { api } from '../lib/api';
import type { NotificationItem } from '../types';

interface NotifState {
  items: NotificationItem[];
  unread: number;
  hasMore: boolean;
  loaded: boolean;
  loading: boolean;
  load: (more?: boolean) => Promise<void>;
  refreshCount: () => Promise<void>;
  add: (n: NotificationItem) => void;
  markAll: () => Promise<void>;
  markOne: (id: string) => Promise<void>;
  clear: () => Promise<void>;
}

export const useNotifs = create<NotifState>()((set, get) => ({
  items: [],
  unread: 0,
  hasMore: false,
  loaded: false,
  loading: false,
  load: async (more = false) => {
    if (get().loading) return;
    set({ loading: true });
    try {
      const last = more ? get().items[get().items.length - 1]?.id : undefined;
      const r = await api.get<{ items: NotificationItem[]; hasMore: boolean; unread: number }>(`/notifications${last ? `?before=${last}` : ''}`);
      set((s) => ({ items: more ? [...s.items, ...r.items] : r.items, hasMore: r.hasMore, unread: r.unread, loaded: true }));
    } finally {
      set({ loading: false });
    }
  },
  refreshCount: async () => {
    const r = await api.get<{ unread: number }>('/notifications/unread-count').catch(() => null);
    if (r) set({ unread: r.unread });
  },
  add: (n) => set((s) => ({ items: [n, ...s.items.filter((x) => x.id !== n.id)], unread: s.unread + 1 })),
  markAll: async () => {
    await api.post('/notifications/read-all');
    set((s) => ({ items: s.items.map((i) => ({ ...i, read: true })), unread: 0 }));
  },
  markOne: async (id) => {
    const item = get().items.find((i) => i.id === id);
    if (!item || item.read) return;
    set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, read: true } : i)), unread: Math.max(0, s.unread - 1) }));
    await api.post(`/notifications/${id}/read`).catch(() => {});
  },
  clear: async () => {
    await api.del('/notifications');
    set({ items: [], unread: 0, hasMore: false });
  },
}));
