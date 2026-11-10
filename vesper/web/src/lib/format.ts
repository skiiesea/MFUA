import type { Presence } from '../types';

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
const dayDiff = (d: Date) => Math.round((new Date().setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86_400_000);

export const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

export function dayLabel(iso: string) {
  const d = new Date(iso);
  const diff = dayDiff(d);
  if (diff === 0) return 'Сегодня';
  if (diff === 1) return 'Вчера';
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', ...(d.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}) };
  return d.toLocaleDateString('ru-RU', opts);
}

export function listTime(iso: string) {
  const d = new Date(iso);
  const diff = dayDiff(d);
  if (diff === 0) return fmtTime(iso);
  if (diff === 1) return 'Вчера';
  if (diff < 7) return d.toLocaleDateString('ru-RU', { weekday: 'short' });
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
export const fmtDateTime = (iso: string) => `${new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}, ${fmtTime(iso)}`;

export function lastSeenText(iso: string) {
  const d = new Date(iso);
  const mins = Math.floor((Date.now() - d.getTime()) / 60_000);
  if (mins < 1) return 'только что';
  if (mins < 60) return `${mins} мин. назад`;
  if (sameDay(d, new Date())) return `сегодня в ${fmtTime(iso)}`;
  if (dayDiff(d) === 1) return `вчера в ${fmtTime(iso)}`;
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

const ACTIVITY: Record<string, string> = { DND: 'не беспокоить', WORK: 'на работе', FREE: 'свободен' };
export const activityLabel = (a: string | null) => (a ? ACTIVITY[a] ?? '' : '');

export function presenceText(p: Presence) {
  if (p.online === null) return '';
  if (p.online) return p.activity ? activityLabel(p.activity) : 'в сети';
  return p.lastSeenAt ? `был(а) ${lastSeenText(p.lastSeenAt)}` : 'не в сети';
}

export function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

export const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?';

export function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10, m100 = n % 100;
  return m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? few : many;
}
