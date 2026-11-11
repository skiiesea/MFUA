import type { ReactNode } from 'react';
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, ChevronRight, Wallet } from 'lucide-react';
import type { Account, Transaction } from '../types';

function QuickAction({ icon, label, detail, color, onClick }: { icon: ReactNode; label: string; detail: string; color: string; onClick: () => void }) {
  return <button onClick={onClick}><span className={'quick-icon ' + color}>{icon}</span><b>{label}</b><small>{detail}</small></button>;
}
function Stat({ label, value, icon, tone }: { label: string; value: string; icon: ReactNode; tone?: string }) {
  return <div className="stat-card"><span>{label}</span><b className={tone || ''}>{value}</b><small>{icon} Демо-статистика</small></div>;
}
function PanelHead({ title, subtitle, action, onAction }: { title: string; subtitle: string; action?: string; onAction?: () => void }) {
  return <div className="panel-head"><div><h3>{title}</h3><p>{subtitle}</p></div>{action && <button className="text-link" onClick={onAction}>{action} <ChevronRight size={15}/></button>}</div>;
}
function AccountRow({ account, show }: { account: Account; show: boolean }) {
  return <div className="account-row"><div className={'account-icon ' + account.color}><Wallet size={19}/></div><div className="account-name"><b>{account.name}</b><small>{account.type} · {account.number}</small></div><strong>{show ? money(account.balance) : '•••• ₽'}</strong></div>;
}
function TxRow({ tx, show }: { tx: Transaction; show: boolean }) {
  const Icon = tx.amount > 0 ? ArrowDownLeft : tx.kind === 'transfer' ? ArrowLeftRight : ArrowUpRight;
  return <div className="tx-row"><div className={'tx-icon ' + (tx.amount > 0 ? 'income' : '')}><Icon size={18}/></div><div className="tx-name"><b>{tx.title}</b><small>{tx.detail}</small></div><div className="tx-date">{tx.date}</div><strong className={tx.amount > 0 ? 'positive' : ''}>{show ? (tx.amount > 0 ? '+' : '−') + money(Math.abs(tx.amount)) : '•••• ₽'}</strong></div>;
}
