import { create } from 'zustand';
import { accentPair } from '../lib/color';
import type { UiSettings } from '../types';

const KEY = 'vesper.ui';
const DEFAULTS: UiSettings = { theme: 'dark', accent: '#8f7bff', scale: 100 };

function loadLocal(): UiSettings {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return DEFAULTS;
  }
}

export function applyUi(s: UiSettings) {
  const root = document.documentElement;
  const dark = s.theme === 'dark' || (s.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  root.dataset.theme = dark ? 'dark' : 'light';
  const { a, b } = accentPair(s.accent);
  root.style.setProperty('--c-accent', a);
  root.style.setProperty('--c-accent2', b);
  root.style.fontSize = `${(s.scale / 100) * 16}px`;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0a0b11' : '#f3f4fa');
}

export interface Toast {
  id: number;
  kind: 'success' | 'error' | 'info';
  text: string;
  action?: { label: string; run: () => void };
}

interface UiState {
  ui: UiSettings;
  connected: boolean;
  toasts: Toast[];
  setUi: (patch: Partial<UiSettings>) => void;
  setConnected: (v: boolean) => void;
  push: (t: Omit<Toast, 'id'>) => void;
  dismiss: (id: number) => void;
}

let seq = 1;

export const useUi = create<UiState>()((set, get) => ({
  ui: loadLocal(),
  connected: true,
  toasts: [],
  setUi: (patch) => {
    const ui = { ...get().ui, ...patch };
    localStorage.setItem(KEY, JSON.stringify(ui));
    applyUi(ui);
    set({ ui });
  },
  setConnected: (connected) => set({ connected }),
  push: (t) => {
    const id = seq++;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { ...t, id }] }));
    setTimeout(() => get().dismiss(id), t.kind === 'error' ? 6000 : 4000);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));

export const toast = {
  success: (text: string) => useUi.getState().push({ kind: 'success', text }),
  error: (text: string) => useUi.getState().push({ kind: 'error', text }),
  info: (text: string, action?: Toast['action']) => useUi.getState().push({ kind: 'info', text, action }),
};
