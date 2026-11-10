import clsx from 'clsx';
import type { CSSProperties, ReactNode } from 'react';
import { accentPair, BG_PRESETS } from '../lib/color';
import { activityLabel, presenceText } from '../lib/format';
import type { Presence } from '../types';
import { Avatar } from './Avatar';

interface Props {
  name: string;
  username: string;
  publicId?: number;
  avatarUrl: string | null;
  coverUrl: string | null;
  bg: string | null;
  accent: string | null;
  status?: string;
  presence?: Presence | null;
  seed: string;
  compact?: boolean;
  actions?: ReactNode;
}

export function coverStyle(coverUrl: string | null, bg: string | null, accent: string | null): CSSProperties {
  if (coverUrl) return { backgroundImage: `url(${coverUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' };
  if (bg && BG_PRESETS[bg]) return { backgroundImage: BG_PRESETS[bg].css };
  if (accent) {
    const p = accentPair(accent);
    return { backgroundImage: `linear-gradient(120deg, rgb(${p.a} / 0.9), rgb(${p.b} / 0.9))` };
  }
  return { backgroundImage: BG_PRESETS.dusk.css };
}

export function ProfileHeader({ name, username, publicId, avatarUrl, coverUrl, bg, accent, status, presence, seed, compact, actions }: Props) {
  const online = presence?.online;
  return (
    <div className="overflow-hidden rounded-3xl border border-line/10 bg-surface/80 shadow-soft">
      <div className={clsx('relative w-full', compact ? 'h-32' : 'h-44 sm:h-60')} style={coverStyle(coverUrl, bg, accent)}>
        <div className="absolute inset-0 bg-gradient-to-t from-surface/70 via-transparent to-black/10" />
      </div>
      <div className="relative px-5 pb-6 sm:px-8">
        <div className={clsx('flex flex-wrap items-end justify-between gap-4', compact ? '-mt-10' : '-mt-14 sm:-mt-16')}>
          <div className="rounded-full bg-surface p-1.5">
            <Avatar name={name} src={avatarUrl} seed={seed} size={compact ? 76 : 112} presence={online ? presence : null} />
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2 pb-1">{actions}</div>}
        </div>
        <div className="mt-4">
          <h1 className={clsx('break-words font-display font-semibold tracking-tight', compact ? 'text-xl' : 'text-2xl sm:text-3xl')}>{name || 'Без имени'}</h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-sm text-muted">
            <span>@{username || 'username'}</span>
            {publicId !== undefined && <span>ID {publicId}</span>}
            {presence && presence.online !== null && (
              <span className={clsx('inline-flex items-center gap-1.5', online ? 'text-ok' : '')}>
                <span className={clsx('h-2 w-2 rounded-full', online ? (presence.activity === 'DND' ? 'bg-danger' : presence.activity === 'WORK' ? 'bg-[#f5a524]' : 'bg-ok') : 'bg-muted/60')} />
                {online ? (presence.activity ? activityLabel(presence.activity) : 'в сети') : presenceText(presence)}
              </span>
            )}
          </p>
          {status && <p className="mt-3 max-w-xl break-words text-[15px] italic text-fg/85">«{status}»</p>}
        </div>
      </div>
    </div>
  );
}
