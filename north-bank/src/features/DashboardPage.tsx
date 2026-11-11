import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Bell, BriefcaseBusiness, ChevronRight, CreditCard, FileText, Plus, ShieldCheck, Sparkles, Target, Wallet } from 'lucide-react';
import type { BankState, Operation, Page } from '../types';
import { AccountRow, PanelHead, QuickAction, Stat, TxRow } from '../components/ui';

function Dashboard({ data, total, income, expenses, show, onPage, onOperation }: { data: BankState; total: number; income: number; expenses: number; show: boolean; onPage: (page: Page) => void; onOperation: (kind: Operation) => void }) {
  return <>
    <section className="hero-grid">
      <div className="balance-card"><div className="balance-top"><span>ОБЩИЙ БАЛАНС</span><span className="balance-live"><i/> ДЕМО-СЧЕТА</span></div><div className="balance-number">{show ? money(total) : '•••••• ₽'}</div><div className="balance-foot"><span>Сумма на {data.accounts.length} счетах</span><span>Локальное хранение</span></div><div className="balance-actions"><button onClick={() => onOperation('transfer')}><ArrowUpRight size={17}/> Перевести</button><button onClick={() => onOperation('topup')}><Plus size={17}/> Пополнить</button><button onClick={() => onPage('history')}><FileText size={17}/> Выписка</button></div><div className="orb orb-one"/><div className="orb orb-two"/></div>
      <div className="quick-card"><div className="section-top"><div><h3>Быстрые действия</h3><p>Основные функции приложения</p></div><Sparkles size={19}/></div><div className="quick-grid"><QuickAction icon={<ArrowLeftRight/>} label="Между счетами" detail="Свои счета" color="purple" onClick={() => onOperation('internal')}/><QuickAction icon={<BriefcaseBusiness/>} label="Оплатить" detail="Демо-услуга" color="blue" onClick={() => onOperation('payment')}/><QuickAction icon={<Target/>} label="Накопить" detail="Цели и планы" color="green" onClick={() => onPage('savings')}/><QuickAction icon={<CreditCard/>} label="Мои карты" detail="Статус макетов" color="orange" onClick={() => onPage('cards')}/></div></div>
    </section>
    <section className="stats-row"><Stat label="Поступления в истории" value={show ? money(income) : '•••• ₽'} icon={<ArrowDownLeft/>} tone="positive"/><Stat label="Списания в истории" value={show ? money(expenses) : '•••• ₽'} icon={<ArrowUpRight/>}/><Stat label="Цели накоплений" value={String(data.goals.length)} icon={<Target/>}/><Stat label="Непрочитанные" value={String(data.notifications.filter(item => !item.read).length)} icon={<Bell/>}/></section>
    <section className="lower-grid">
      <div className="panel"><PanelHead title="Мои счета" subtitle="Сводка по демо-счетам" action="Все счета" onAction={() => onPage('accounts')}/><div className="account-list">{data.accounts.slice(0, 4).map(item => <AccountRow key={item.id} account={item} show={show}/>)}</div></div>
      <div className="panel"><PanelHead title="Последние операции" subtitle="Недавняя активность" action="Вся история" onAction={() => onPage('history')}/><div className="tx-list">{data.transactions.slice(0, 5).map(item => <TxRow key={item.id} tx={item} show={show}/>)}</div></div>
    </section>
    <div className="notice-strip"><ShieldCheck size={18}/><span><b>North Bank Demo.</b> Балансы, карты, клиенты и операции вымышлены. Реальные платежи отключены.</span><button onClick={() => onPage('profile')}>Настройки</button></div>
  </>;
}