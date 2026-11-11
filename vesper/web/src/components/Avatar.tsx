import clsx from 'clsx';
import { initials } from '../lib/format';
import type { Presence } from '../types';

const PALETTE = [
  ['#8f7bff', '#ff7a9a'], ['#2dd4bf', '#4f9dff'], ['#f5a524', '#ff6b6b'], ['#4ade80', '#2dd4bf'],
  ['#ff7ad9', '#8f7bff'], ['#4f9dff', '#8f7bff'], ['#ff8a5c', '#ffcf5c'], ['#5ce1e6', '#7be0a8'],
];
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

export function Avatar({ name, src, seed, size = 40, presence, className }: { name: string; src?: string | null; seed?: string; size?: number; presence?: Presence | null; className?: string }) {
  const [a, b] = PALETTE[hash(seed ?? name) % PALETTE.length];
  const dot = presence?.online ? (presence.activity === 'DND' ? 'bg-danger' : presence.activity === 'WORK' ? 'bg-[#f5a524]' : 'bg-ok') : null;
  return (
    <span className={clsx('relative inline-flex shrink-0', className)} style={{ width: size, height: size }}>
      {src ? (
        <img src={src} alt="" loading="lazy" className="h-full w-full rounded-full object-cover" draggable={false} />
      ) : (
        <span
          className="flex h-full w-full select-none items-center justify-center rounded-full font-display font-semibold text-white"
          style={{ background: `linear-gradient(135deg, ${a}, ${b})`, fontSize: Math.max(10, size * 0.36) }}
          aria-hidden
        >
          {initials(name)}
        </span>
      )}
      {dot && (
        <span
          className={clsx('absolute bottom-0 right-0 rounded-full ring-2 ring-surface', dot)}
          style={{ width: Math.max(6, Math.min(11, size * 0.1)), height: Math.max(6, Math.min(11, size * 0.1)) }}
          aria-label="в сети"
        />
      )}
    </span>
  );
}
