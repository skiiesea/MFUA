import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { presenceText } from '../lib/format';
import type { Card } from '../types';
import { Avatar } from './Avatar';

export function UserRow({ user, actions, sub }: { user: Card; actions?: ReactNode; sub?: string }) {
  const p = presenceText(user.presence);
  return (
    <div className="flex items-center gap-3 rounded-2xl p-3 transition hover:bg-line/[0.06]">
      <Link to={`/@${user.username}`} className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar name={user.displayName} src={user.avatarUrl} seed={user.id} size={48} presence={user.presence} />
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-semibold">{user.displayName}</span>
          <span className="block truncate text-sm text-muted">@{user.username}{sub ? `, ${sub}` : p ? `, ${p}` : ''}</span>
        </span>
      </Link>
      {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
    </div>
  );
}
