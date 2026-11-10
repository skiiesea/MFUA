import { create } from 'zustand';
import { api, ApiError } from '../lib/api';
import type { Self } from '../types';
import { useUi } from './ui';

interface AuthState {
  user: Self | null;
  status: 'loading' | 'authed' | 'guest';
  init: () => Promise<void>;
  setUser: (u: Self) => void;
  setGuest: () => void;
  logout: () => Promise<void>;
}

export const useAuth = create<AuthState>()((set) => ({
  user: null,
  status: 'loading',
  init: async () => {
    try {
      const { user } = await api.get<{ user: Self }>('/auth/me');
      useUi.getState().setUi(user.ui);
      set({ user, status: 'authed' });
    } catch (e) {
      // сеть недоступна — не выкидываем пользователя на экран входа молча
      set({ user: null, status: e instanceof ApiError && e.status === 0 ? 'loading' : 'guest' });
      if (e instanceof ApiError && e.status === 0) setTimeout(() => void useAuth.getState().init(), 3000);
    }
  },
  setUser: (user) => {
    useUi.getState().setUi(user.ui);
    set({ user, status: 'authed' });
  },
  setGuest: () => set({ user: null, status: 'guest' }),
  logout: async () => {
    await api.post('/auth/logout').catch(() => {});
    set({ user: null, status: 'guest' });
  },
}));
