import type { AdminSummary, BankState } from './types';

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers },
  });
  const payload = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || 'Ошибка локального демо-сервера');
  return payload;
}

export const getBankState = () => apiRequest<BankState>('/api/state');
export const postBankAction = (path: string, body?: unknown, method = 'POST') =>
  apiRequest<BankState>(path, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
export const getAdminSummary = () => apiRequest<AdminSummary>('/api/admin/summary');
