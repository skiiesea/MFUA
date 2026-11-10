import clsx from 'clsx';
import { AtSign, Bell, CheckCheck, ShieldAlert, Trash2, UserCheck, UserPlus } from 'lucide-react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Page, PageHeader } from '../components/Page';
import { Button, EmptyState, Skeleton, Spinner } from '../components/ui';
import { errMsg } from '../lib/api';
import { listTime } from '../lib/format';
import { useNotifs } from '../store/notifications';
import { toast } from '../store/ui';
import type { NotificationItem } from '../types';

const META: Record<NotificationItem['type'], { icon: typeof Bell; tone: string }> = {
  FRIEND_REQUEST: { icon: UserPlus, tone: 'bg-accent/15 text-accent' },
  FRIEND_ACCEPTED: { icon: UserCheck, tone: 'bg-ok/15 text-ok' },
  MENTION: { icon: AtSign, tone: 'bg-accent2/15 text-accent2' },
  SECURITY: { icon: ShieldAlert, tone: 'bg-danger/15 text-danger' },
};

export function NotificationsPage() {
  const { items, unread, hasMore, loaded, loading } = useNotifs();
  const navigate = useNavigate();

  useEffect(() => {
    useNotifs.getState().load().catch((e) => toast.error(errMsg(e)));
  }, []);

  const open = (n: NotificationItem) => {
    void useNotifs.getState().markOne(n.id);
    if (n.type === 'FRIEND_REQUEST') navigate('/friends');
    else if (n.type === 'FRIEND_ACCEPTED' && n.data.username) navigate(`/@${n.data.username}`);
    else if (n.type === 'MENTION' && n.data.chatId) navigate(`/messages/${n.data.chatId}`);
    else if (n.type === 'SECURITY') navigate('/settings/security');
  };

  return (
    <Page>
      <PageHeader title="Уведомления" subtitle={unread ? `Непрочитанных: ${unread}` : 'Всё прочитано'} actions={items.length > 0 && (
        <div className="flex gap-2">
          <Button variant="soft" size="sm" icon={<CheckCheck className="h-4 w-4" />} disabled={!unread} onClick={() => void useNotifs.getState().markAll()}>Прочитать все</Button>
          <Button variant="ghost" size="sm" icon={<Trash2 className="h-4 w-4" />} onClick={() => void useNotifs.getState().clear()}>Очистить</Button>
        </div>
      )} />
      <div className="card overflow-hidden">
        {!loaded ? <div className="space-y-2 p-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}</div> : items.length === 0 ? (
          <EmptyState icon={<Bell />} title="Пока тихо" text="Здесь появятся заявки в друзья, упоминания в группах и важные события безопасности. Новые сообщения видны в разделе «Сообщения»." />
        ) : (
          <ul className="divide-y divide-line/5">
            {items.map((n) => {
              const M = META[n.type];
              return (
                <li key={n.id}>
                  <button onClick={() => open(n)} className={clsx('flex w-full items-start gap-4 px-4 py-4 text-left transition hover:bg-line/[0.06]', !n.read && 'bg-accent/[0.06]')}>
                    <span className={clsx('flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl', M.tone)}><M.icon className="h-5 w-5" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-3"><span className={clsx('text-[15px]', n.read ? 'font-medium' : 'font-bold')}>{n.title}</span><span className="shrink-0 text-xs text-muted">{listTime(n.createdAt)}</span></span>
                      {n.body && <span className="mt-1 line-clamp-2 block text-sm text-muted">{n.body}</span>}
                    </span>
                    {!n.read && <span className="grad mt-2 h-2.5 w-2.5 shrink-0 rounded-full" aria-label="не прочитано" />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {hasMore && <div className="mt-4 flex justify-center">{loading ? <Spinner /> : <Button variant="soft" onClick={() => void useNotifs.getState().load(true)}>Показать ещё</Button>}</div>}
    </Page>
  );
}
