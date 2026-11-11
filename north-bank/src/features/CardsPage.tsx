import { BadgeCheck, LockKeyhole, Snowflake } from 'lucide-react';
import type { Account, BankCard } from '../types';
import { PanelHead } from '../components/ui';

export function CardsPage({ cards, accounts, busy, onToggle }: { cards: BankCard[]; accounts: Account[]; busy: boolean; onToggle: (id: number) => void }) {
  return <section className="panel page-panel"><PanelHead title="Демо-карты" subtitle="Макеты карт связаны с виртуальными счетами"/><div className="cards-grid">{cards.map(card => {
    const account = accounts.find(item => item.id === card.accountId);
    return <div className={'bank-card ' + (card.id % 2 ? 'purple-card' : 'blue-card')} key={card.id}><div className="bank-card-head"><b>NORTH</b><span>{card.type}</span></div><div className="chip"/><div className="card-number">•••• &nbsp; •••• &nbsp; •••• &nbsp; {card.last4}</div><div className="bank-card-bottom"><div><small>НАЗВАНИЕ</small><b>{card.name}</b></div><div><small>СЧЁТ</small><b>{account?.name || 'Не найден'}</b></div><b className="visa">N</b></div><div className="card-state"><span className={card.status === 'active' ? 'state-active' : 'state-frozen'}>{card.status === 'active' ? 'АКТИВНА В ДЕМО' : 'ЗАМОРОЖЕНА В ДЕМО'}</span><button disabled={busy} onClick={() => onToggle(card.id)}>{card.status === 'active' ? <Snowflake size={15}/> : <BadgeCheck size={15}/>} {card.status === 'active' ? 'Заморозить' : 'Разморозить'}</button></div></div>;
  })}</div><div className="inline-info"><LockKeyhole size={17}/> Здесь нет номера платёжной карты, срока действия или CVV. Переключатель меняет только демонстрационный статус.</div></section>;
}