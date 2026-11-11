import { useMemo, useState } from 'react';
import { Activity, ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Bell, BriefcaseBusiness, CalendarDays, Check, ChevronDown, ChevronRight, CircleHelp, CreditCard, Eye, EyeOff, FileText, Home, LayoutGrid, LogOut, Plus, Search, Settings, ShieldCheck, SlidersHorizontal, Sparkles, UserRound, Wallet, X } from 'lucide-react';

type Tx = { id: number; title: string; detail: string; amount: number; date: string; category: string; kind: 'income' | 'expense' | 'transfer' };
type Account = { id: number; name: string; number: string; balance: number; color: string; type: string };
const money = (n: number) => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(n);
const initialAccounts: Account[] = [
  { id: 1, name: 'Основной счёт', number: '•• 4821', balance: 284650, color: 'violet', type: 'Текущий' },
  { id: 2, name: 'Накопительный', number: '•• 1904', balance: 125000, color: 'blue', type: 'Сбережения' },
];
const initialTx: Tx[] = [
  { id: 1, title: 'Зачисление', detail: 'Пополнение демо-баланса', amount: 25000, date: 'Сегодня, 12:42', category: 'Доход', kind: 'income' },
  { id: 2, title: 'Кофейня Север', detail: 'Покупка по карте •• 4821', amount: -460, date: 'Сегодня, 10:18', category: 'Кафе', kind: 'expense' },
  { id: 3, title: 'Маркетплейс', detail: 'Покупка по карте •• 4821', amount: -3290, date: 'Вчера, 19:05', category: 'Покупки', kind: 'expense' },
  { id: 4, title: 'Перевод между счетами', detail: 'На накопительный', amount: -10000, date: 'Вчера, 14:20', category: 'Переводы', kind: 'transfer' },
  { id: 5, title: 'Возврат покупки', detail: 'Маркетплейс', amount: 1890, date: '10 ноября, 09:12', category: 'Возврат', kind: 'income' },
];
const nav = [{ id: 'home', label: 'Главная', icon: Home }, { id: 'accounts', label: 'Мои счета', icon: Wallet }, { id: 'cards', label: 'Карты', icon: CreditCard }, { id: 'payments', label: 'Платежи', icon: ArrowLeftRight }, { id: 'history', label: 'История', icon: Activity }];
type Page = 'home' | 'accounts' | 'cards' | 'payments' | 'history' | 'profile';

export default function App() {
  const [page, setPage] = useState<Page>('home');
  const [accounts, setAccounts] = useState(initialAccounts);
  const [tx, setTx] = useState(initialTx);
  const [showBalance, setShowBalance] = useState(true);
  const [modal, setModal] = useState<'transfer' | 'payment' | 'topup' | null>(null);
  const [amount, setAmount] = useState('');
  const [recipient, setRecipient] = useState('');
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState('');
  const [activeAccount, setActiveAccount] = useState(1);
  const [dark, setDark] = useState(true);
  const total = accounts.reduce((s, a) => s + a.balance, 0);
  const filtered = useMemo(() => tx.filter(t => (t.title + t.detail + t.category).toLowerCase().includes(search.toLowerCase())), [tx, search]);
  const active = accounts.find(a => a.id === activeAccount) ?? accounts[0];
  const toast = (s: string) => { setNotice(s); window.setTimeout(() => setNotice(''), 2600); };
  const addTx = (entry: Omit<Tx, 'id' | 'date'>) => setTx(old => [{ ...entry, id: Date.now(), date: 'Только что' }, ...old]);
  const submitAction = () => {
    const n = Number(amount.replace(',', '.'));
    if (!Number.isFinite(n) || n <= 0 || n > 1000000) { toast('Укажи корректную сумму до 1 000 000 ₽'); return; }
    if (modal === 'transfer' || modal === 'payment') {
      if (n > active.balance) { toast('Недостаточно средств на демо-счёте'); return; }
      if (!recipient.trim()) { toast('Заполни название получателя'); return; }
      setAccounts(old => old.map(a => a.id === active.id ? { ...a, balance: a.balance - n } : a));
      addTx({ title: modal === 'transfer' ? 'Демо-перевод' : recipient, detail: modal === 'transfer' ? 'Тестовая операция · ' + recipient : 'Демо-платёж', amount: -n, category: modal === 'transfer' ? 'Переводы' : 'Платежи', kind: 'expense' });
      toast('Демо-операция выполнена. Реальные деньги не переводились.');
    } else {
      setAccounts(old => old.map(a => a.id === active.id ? { ...a, balance: a.balance + n } : a));
      addTx({ title: 'Тестовое пополнение', detail: 'Виртуальные средства', amount: n, category: 'Пополнение', kind: 'income' });
      toast('Демо-баланс пополнен виртуальными средствами.');
    }
    setModal(null); setAmount(''); setRecipient('');
  };
  const changePage = (p: Page) => { setPage(p); setSearch(''); };
  const title = ({ home: 'Главная', accounts: 'Мои счета', cards: 'Карты', payments: 'Платежи и переводы', history: 'История операций', profile: 'Профиль' } as Record<Page, string>)[page];

  return <div className={dark ? 'app' : 'app light'}>
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">N</div><span>NORTH</span><small>BANK</small></div>
      <div className="profile-mini"><div className="avatar">А</div><div><b>Александр</b><span>Демо-клиент</span></div><ChevronDown size={15}/></div>
      <div className="nav-label">МЕНЮ</div>
      <nav>{nav.map(item => <button key={item.id} className={page === item.id ? 'nav-item active' : 'nav-item'} onClick={() => changePage(item.id as Page)}><item.icon size={19}/>{item.label}{item.id === 'history' && <span className="nav-dot"/>}</button>)}</nav>
      <div className="sidebar-bottom">
        <div className="support-card"><div className="support-icon"><ShieldCheck size={19}/></div><b>Ваши данные под защитой</b><span>Это демонстрационный режим. Никакие реальные данные не используются.</span></div>
        <button className="nav-item" onClick={() => changePage('profile')}><Settings size={19}/>Настройки</button>
        <div className="sidebar-foot">NORTH BANK <span>·</span> DEMO 0.1</div>
      </div>
    </aside>
    <main className="main">
      <header className="topbar"><div className="crumb">Личный кабинет <ChevronRight size={14}/> <b>{title}</b></div><div className="top-actions"><span className="demo-pill"><i/> ДЕМО-РЕЖИМ</span><button className="icon-btn" onClick={() => toast('Новых уведомлений нет')} aria-label="Уведомления"><Bell size={19}/><i/></button><button className="top-avatar" onClick={() => changePage('profile')}>А</button></div></header>
      <div className="content">
        <div className="page-heading"><div><div className="eyebrow">ВТОРНИК, 11 НОЯБРЯ</div><h1>{page === 'home' ? 'Добрый день, Александр' : title}</h1><p>{page === 'home' ? 'Ваши финансы — под рукой. Всё спокойно и под контролем.' : 'Управляйте своими демо-финансами в одном месте.'}</p></div><button className="secondary-btn" onClick={() => setShowBalance(v => !v)}>{showBalance ? <EyeOff size={16}/> : <Eye size={16}/>} {showBalance ? 'Скрыть суммы' : 'Показать суммы'}</button></div>
        {page === 'home' && <>
          <section className="hero-grid">
            <div className="balance-card"><div className="balance-top"><span>ОБЩИЙ БАЛАНС</span><span className="balance-live"><i/> ДЕМО-СЧЕТА</span></div><div className="balance-number">{showBalance ? money(total) : '•••••• ₽'}</div><div className="balance-foot"><span><span className="trend">↗ 4,8%</span> за этот месяц</span><span>Обновлено только что</span></div><div className="balance-actions"><button onClick={() => setModal('transfer')}><ArrowUpRight size={17}/> Перевести</button><button onClick={() => setModal('topup')}><Plus size={17}/> Пополнить</button><button onClick={() => changePage('history')}><FileText size={17}/> Выписка</button></div><div className="orb orb-one"/><div className="orb orb-two"/></div>
            <div className="quick-card"><div className="section-top"><div><h3>Быстрые действия</h3><p>Частые операции в один тап</p></div><Sparkles size={19}/></div><div className="quick-grid"><button onClick={() => setModal('transfer')}><span className="quick-icon purple"><ArrowUpRight/></span><b>Перевод</b><small>По номеру или счёту</small></button><button onClick={() => setModal('payment')}><span className="quick-icon blue"><LayoutGrid/></span><b>Оплатить</b><small>Услуги и покупки</small></button><button onClick={() => setModal('topup')}><span className="quick-icon green"><Plus/></span><b>Пополнить</b><small>Демо-баланс</small></button><button onClick={() => changePage('cards')}><span className="quick-icon orange"><CreditCard/></span><b>Мои карты</b><small>Реквизиты демо-карт</small></button></div></div>
          </section>
          <section className="stats-row"><div className="stat-card"><span>Доходы за месяц</span><b className="positive">+{showBalance ? money(26890) : '•••• ₽'}</b><small><ArrowDownLeft size={14}/> 12 поступлений</small></div><div className="stat-card"><span>Расходы за месяц</span><b>{showBalance ? money(18420) : '•••• ₽'}</b><small><ArrowUpRight size={14}/> 24 операции</small></div><div className="stat-card"><span>Накоплено</span><b>{showBalance ? money(accounts[1].balance) : '•••• ₽'}</b><small><Sparkles size={14}/> На накопительном</small></div></section>
          <section className="lower-grid"><div className="panel"><div className="panel-head"><div><h3>Мои счета</h3><p>Все ваши средства в одном месте</p></div><button className="text-link" onClick={() => changePage('accounts')}>Все счета <ChevronRight size={15}/></button></div><div className="account-list">{accounts.map(a => <AccountRow key={a.id} account={a} show={showBalance} onClick={() => { setActiveAccount(a.id); changePage('accounts'); }}/>)}</div></div><div className="panel"><div className="panel-head"><div><h3>Последние операции</h3><p>Недавняя активность</p></div><button className="text-link" onClick={() => changePage('history')}>Все операции <ChevronRight size={15}/></button></div><div className="tx-list">{tx.slice(0,4).map(t => <TxRow key={t.id} tx={t} show={showBalance}/>)}</div></div></section>
          <div className="notice-strip"><ShieldCheck size={18}/><span><b>Безопасный демо-режим.</b> Балансы и операции вымышленные, данные хранятся только в этом браузере.</span><button onClick={() => changePage('profile')}>Подробнее</button></div>
        </>}
        {page === 'accounts' && <section className="panel page-panel"><div className="panel-head"><div><h3>Ваши счета</h3><p>Общий баланс: {showBalance ? money(total) : '•••• ₽'}</p></div><button className="primary-btn" onClick={() => setModal('topup')}><Plus size={16}/> Пополнить демо-счёт</button></div><div className="account-grid">{accounts.map(a => <div className={'account-big '+a.color} key={a.id}><div className="account-big-top"><span>{a.type}</span><Wallet size={21}/></div><h3>{a.name}</h3><p>{a.number}</p><strong>{showBalance ? money(a.balance) : '•••••• ₽'}</strong><button onClick={() => {setActiveAccount(a.id); setPage('history');}}>История счёта <ChevronRight size={15}/></button></div>)}</div></section>}
        {page === 'cards' && <section className="panel page-panel"><div className="panel-head"><div><h3>Ваши карты</h3><p>Только визуальные макеты — не платёжные инструменты</p></div><span className="demo-pill"><i/> ВИРТУАЛЬНЫЕ</span></div><div className="cards-grid"><div className="bank-card purple-card"><div className="bank-card-head"><b>NORTH</b><span>DEBIT · DEMO</span></div><div className="chip"/><div className="card-number">•••• &nbsp; •••• &nbsp; •••• &nbsp; 4821</div><div className="bank-card-bottom"><div><small>ВЛАДЕЛЕЦ</small><b>ALEXANDER</b></div><div><small>ДЕЙСТВУЕТ ДО</small><b>MM/YY</b></div><b className="visa">VISA*</b></div></div><div className="bank-card blue-card"><div className="bank-card-head"><b>NORTH</b><span>SAVINGS · DEMO</span></div><div className="chip"/><div className="card-number">•••• &nbsp; •••• &nbsp; •••• &nbsp; 1904</div><div className="bank-card-bottom"><div><small>ВЛАДЕЛЕЦ</small><b>ALEXANDER</b></div><div><small>ТИП</small><b>СБЕРЕГАТЕЛЬНЫЙ</b></div><b className="visa">N</b></div></div></div><div className="inline-info"><ShieldCheck size={17}/> Здесь намеренно нет CVV, полного номера карты или реальных платёжных реквизитов.</div></section>}
        {page === 'payments' && <section className="panel page-panel"><div className="panel-head"><div><h3>Платежи и переводы</h3><p>Выбери действие для тестовой операции</p></div></div><div className="payment-options"><button onClick={() => setModal('transfer')}><span className="quick-icon purple"><ArrowUpRight/></span><b>Перевод</b><small>Списать виртуальные средства с выбранного счёта</small><ChevronRight/></button><button onClick={() => setModal('payment')}><span className="quick-icon blue"><BriefcaseBusiness/></span><b>Оплата услуги</b><small>Создать тестовую запись о платеже</small><ChevronRight/></button><button onClick={() => setModal('topup')}><span className="quick-icon green"><Plus/></span><b>Пополнение</b><small>Добавить виртуальные средства</small><ChevronRight/></button></div><div className="inline-info"><ShieldCheck size={17}/> Все действия локальные. Получатели не проверяются, реальные переводы невозможны.</div></section>}
        {page === 'history' && <section className="panel page-panel"><div className="panel-head"><div><h3>Все операции</h3><p>{filtered.length} операций в демо-истории</p></div><div className="search-box"><Search size={17}/><input placeholder="Поиск по операциям" value={search} onChange={e => setSearch(e.target.value)}/><SlidersHorizontal size={16}/></div></div><div className="history-table"><div className="table-labels"><span>ОПЕРАЦИЯ</span><span>ДАТА</span><span>СУММА</span></div>{filtered.map(t => <TxRow key={t.id} tx={t} show={showBalance}/>) }{!filtered.length && <div className="empty">Ничего не найдено. Попробуй изменить запрос.</div>}</div></section>}
        {page === 'profile' && <section className="panel page-panel profile-page"><div className="profile-large"><div className="avatar large">А</div><div><h2>Александр</h2><p>Демо-клиент · ID NB-000042</p></div></div><div className="profile-settings"><div><UserRound/><span><b>Личные данные</b><small>Демонстрационный профиль без персональных сведений</small></span><ChevronRight/></div><div><Bell/><span><b>Уведомления</b><small>Настройки уведомлений прототипа</small></span><ChevronRight/></div><div><Settings/><span><b>Внешний вид</b><small>Переключить тему интерфейса</small></span><button className="toggle" onClick={() => setDark(v => !v)}>{dark ? 'Тёмная' : 'Светлая'}</button></div><div><ShieldCheck/><span><b>Безопасность</b><small>Не вводите реальные пароли и реквизиты</small></span><ChevronRight/></div><div><CircleHelp/><span><b>О приложении</b><small>North Bank Demo · версия 0.1</small></span><ChevronRight/></div></div><button className="reset-btn" onClick={() => {setAccounts(initialAccounts);setTx(initialTx);setActiveAccount(1);toast('Демо-данные восстановлены');}}><LogOut size={16}/> Сбросить демо-данные</button></section>}
      </div>
      <footer className="footer">© 2026 NORTH BANK <span>Демонстрационный интерфейс · Не является финансовой организацией</span></footer>
    </main>
    {modal && <div className="modal-backdrop" onMouseDown={e => {if(e.target===e.currentTarget)setModal(null);}}><div className="modal"><div className="modal-head"><div><span className="eyebrow">ТЕСТОВАЯ ОПЕРАЦИЯ</span><h2>{modal === 'transfer' ? 'Новый перевод' : modal === 'payment' ? 'Оплата услуги' : 'Пополнение счёта'}</h2></div><button className="icon-btn" onClick={() => setModal(null)}><X/></button></div><div className="field"><label>Счёт списания / зачисления</label><select value={activeAccount} onChange={e => setActiveAccount(Number(e.target.value))}>{accounts.map(a => <option value={a.id} key={a.id}>{a.name} · {a.number}</option>)}</select><small>Доступно: {money(active.balance)}</small></div>{modal !== 'topup' && <div className="field"><label>{modal === 'transfer' ? 'Получатель (любое тестовое имя)' : 'Название услуги'}</label><input value={recipient} onChange={e => setRecipient(e.target.value)} placeholder={modal === 'transfer' ? 'Например, Тестовый получатель' : 'Например, Интернет'}/></div>}<div className="field"><label>Сумма, ₽ (виртуальная)</label><input inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0"/></div><div className="modal-warning"><ShieldCheck size={17}/> Это только локальная симуляция. Реальные деньги не перемещаются.</div><button className="primary-btn full" onClick={submitAction}><Check size={17}/> Подтвердить демо-операцию</button></div></div>}
    {notice && <div className="toast"><Check size={17}/>{notice}</div>}
  </div>;
}

function AccountRow({ account, show, onClick }: { account: Account; show: boolean; onClick: () => void }) {
  return <button className="account-row" onClick={onClick}><div className={'account-icon '+account.color}><Wallet size={19}/></div><div className="account-name"><b>{account.name}</b><small>{account.type} · {account.number}</small></div><strong>{show ? money(account.balance) : '•••• ₽'}</strong><ChevronRight size={17}/></button>;
}
function TxRow({ tx, show }: { tx: Tx; show: boolean }) {
  const Icon = tx.kind === 'income' ? ArrowDownLeft : tx.kind === 'transfer' ? ArrowLeftRight : ArrowUpRight;
  return <div className="tx-row"><div className={'tx-icon '+(tx.kind === 'income' ? 'income' : '')}><Icon size={18}/></div><div className="tx-name"><b>{tx.title}</b><small>{tx.detail}</small></div><div className="tx-date">{tx.date}</div><strong className={tx.amount > 0 ? 'positive' : ''}>{show ? (tx.amount > 0 ? '+' : '−') + money(Math.abs(tx.amount)) : '•••• ₽'}</strong></div>;
}
