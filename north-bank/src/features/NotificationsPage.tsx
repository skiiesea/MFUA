import { Bell } from 'lucide-react';
import type { BankNotification } from '../types';
import { PanelHead } from '../components/ui';

export function NotificationsPage({ items, enabled, onRead }: { items: BankState['notifications']; enabled: boolean; onRead: (id: number) => void }) {
  return <section className="panel page-panel"><PanelHead title="Уведомления" subtitle={enabled ? 'Уведомления включены в настройках демо-профиля' : 'Уведомления отключены в настройках профиля'}/>{items.map(item => <div className={item.read ? 'notification-row read' : 'notification-row'} key={item.id}><div className="notification-icon"><Bell size={18}/></div><div><b>{item.title}</b><p>{item.message}</p><small>{item.date}</small></div>{!item.read && <button className="text-link" onClick={() => onRead(item.id)}>Прочитано</button>}</div>)}{items.length === 0 && <div className="empty">Уведомлений пока нет.</div>}</section>;
}