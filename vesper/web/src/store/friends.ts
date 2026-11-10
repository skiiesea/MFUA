import { create } from 'zustand';
import { api } from '../lib/api';
import type { Card } from '../types';

export interface FriendsData {
  friends: { friendshipId: string; since: string; user: Card }[];
  incoming: { id: string; createdAt: string; user: Card }[];
  outgoing: { id: string; createdAt: string; user: Card }[];
  blocked: { createdAt: string; user: Card }[];
}

interface FriendsState {
  data: FriendsData | null;
  loading: boolean;
  load: () => Promise<void>;
}

export const useFriends = create<FriendsState>()((set, get) => ({
  data: null,
  loading: false,
  load: async () => {
    if (get().loading) return;
    set({ loading: true });
    try {
      set({ data: await api.get<FriendsData>('/friends') });
    } finally {
      set({ loading: false });
    }
  },
}));
