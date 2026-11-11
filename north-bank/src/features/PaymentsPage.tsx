import type { ReactNode } from 'react';
import { ArrowLeftRight, ArrowUpRight, BriefcaseBusiness, ChevronRight, Plus, Send } from 'lucide-react';
import type { Account, Operation } from '../types';
import { PanelHead } from '../components/ui';

function PaymentsPage({ accounts, onOperation }: { accounts: Account[]; onOperation: (kind: Operation) => void }) {
  const actions: { kind: Operation; title: string; desc: string; icon: ReactNode; color: string }[] = [
    { kind: 'transfer', title: 'Демо-перевод', desc: 'Симуляция отправки виртуальных средств условному получателю', icon: <Send/>, color: 'purple' },
    { kind: 'internal', title: 'Между своими счетами', desc: 'Перемещение виртуального баланса между счетами', icon: <ArrowLeftRight/>, color: 'blue' },
    { kind: 'payment', title: 'Оплата услуги', desc: 'Создать тестовую запись о списании', icon: <BriefcaseBusiness/>, color: 'orange' },
    { kind: 'topup', title: 'Пополнение', desc: 'Добавить виртуальные средства на демо-счёт', icon: <Plus/>, color: 'green' },
  ];
  return <section className="panel page-panel"><PanelHead title="Операции" subtitle="Все операции выполняются только в локальной демонстрационной базе"/><div className="payment-options">{actions.map(item => <button key={item.kind} onClick={() => onOperation(item.kind)} disabled={item.kind === 'internal' && accounts.length < 2}><span className={'quick-icon ' + item.color}>{item.icon}</span><b>{item.title}</b><small>{item.desc}</small><ChevronRight/></button>)}</div></section>;
}