import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import {
  Activity, ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Bell, BriefcaseBusiness, Check,
  ChevronDown, ChevronRight, CircleHelp, CreditCard, Eye, EyeOff, FileText, Home,
  LayoutDashboard, LogOut, Plus, Search, Settings, ShieldCheck, SlidersHorizontal,
  Sparkles, Target, UserRound, Wallet, X, Snowflake, PieChart, Headphones, Landmark,
  RefreshCw, LockKeyhole, TrendingUp, CircleDollarSign, Send, BadgeCheck,
} from 'lucide-react';
import { apiRequest, getAdminSummary, getBankState, postBankAction } from './api';
import type { Account, AdminSummary, BankCard, BankState, SavingsGoal, Transaction } from './types';

type Page = 'home' | 'accounts' | 'cards' | 'payments' | 'history' | 'analytics' | 'savings' | 'notifications' | 'profile' | 'support' | 'admin';
type Operation = 'transfer' | 'payment' | 'topup' | 'internal';
const money = (n: number) => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(n);
const pageNames: Record<Page, string> = {
  home: 'Главная', accounts: 'Мои счета', cards: 'Карты', payments: 'Платежи и переводы',
  history: 'История операций', analytics: 'Аналитика', savings: 'Накопления',
  notifications: 'Уведомления', profile: 'Профиль', support: 'Поддержка', admin: 'Панель управления',
};
const nav: { id: Page; label: string; icon: typeof Home }[] = [
  { id: 'home', label: 'Главная', icon: Home },
  { id: 'accounts', label: 'Мои счета', icon: Wallet },
  { id: 'cards', label: 'Карты', icon: CreditCard },
  { id: 'payments', label: 'Платежи', icon: ArrowLeftRight },
  { id: 'history', label: 'История', icon: Activity },
  { id: 'analytics', label: 'Аналитика', icon: PieChart },
  { id: 'savings', label: 'Цели накоплений', icon: Target },
];
const emptyState: BankState = {
  accounts: [], transactions: [], cards: [], goals: [], notifications: [], audit: [], supportTickets: [],
  profile: { name: 'Демо-клиент', customerId: 'NB-DEMO', theme: 'dark', notificationsEnabled: true },
};

export default function App() {
  const [data, setData] = useState<BankState>(emptyState);
  const [page, setPage] = useState<Page>('home');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showBalance, setShowBalance] = useState(true);
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [operation, setOperation] = useState<Operation | null>(null);
  const [amount, setAmount] = useState('');
  const [recipient, setRecipient] = useState('');
  const [accountId, setAccountId] = useState(1);
  const [targetAccountId, setTargetAccountId] = useState(2);
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountType, setNewAccountType] = useState<'current' | 'savings'>('current');
  const [newGoalTitle, setNewGoalTitle] = useState('');
  const [newGoalTarget, setNewGoalTarget] = useState('');
  const [newGoalDate, setNewGoalDate] = useState('');
  const [goalContribution, setGoalContribution] = useState<Record<number, string>>({});
  const [supportSubject, setSupportSubject] = useState('');
  const [supportMessage, setSupportMessage] = useState('');
  const [admin, setAdmin] = useState<AdminSummary | null>(null);

  const toast = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 3000);
  };
  const applyState = (next: BankState) => {
    setData(next);
    setAccountId(current => next.accounts.some(a => a.id === current) ? current : (next.accounts[0]?.id ?? 1));
    setTargetAccountId(current => next.accounts.some(a => a.id === current && a.id !== accountId) ? current : (next.accounts.find(a => a.id !== accountId)?.id ?? 1));
  };
  useEffect(() => {
    let live = true;
    getBankState().then(state => { if (live) { applyState(state); setLoading(false); } })
      .catch(error => { if (live) { toast(error instanceof Error ? error.message : 'Не удалось подключиться к демо-серверу'); setLoading(false); } });
    return () => { live = false; };
  }, []);
  useEffect(() => { document.documentElement.dataset.theme = data.profile.theme; }, [data.profile.theme]);
  useEffect(() => {
    if (page !== 'admin') return;
    let live = true;
    getAdminSummary().then(result => { if (live) setAdmin(result); })
      .catch(error => toast(error instanceof Error ? error.message : 'Не удалось загрузить панель'));
    return () => { live = false; };
  }, [page, data.audit.length, data.supportTickets.length]);
  const total = data.accounts.reduce((sum, item) => sum + item.balance, 0);
  const activeAccount = data.accounts.find(item => item.id === accountId) ?? data.accounts[0];
  const unread = data.notifications.filter(item => !item.read).length;
  const filtered = useMemo(() => data.transactions.filter(item => {
    const matchesSearch = (item.title + ' ' + item.detail + ' ' + item.category).toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'all' || (filter === 'income' ? item.amount > 0 : item.amount < 0);
    return matchesSearch && matchesFilter;
  }), [data.transactions, search, filter]);
  const income = data.transactions.filter(item => item.amount > 0).reduce((sum, item) => sum + item.amount, 0);
  const expenses = Math.abs(data.transactions.filter(item => item.amount < 0).reduce((sum, item) => sum + item.amount, 0));
  const categories = useMemo(() => {
    const sums = new Map<string, number>();
    data.transactions.filter(item => item.amount < 0).forEach(item => sums.set(item.category, (sums.get(item.category) || 0) + Math.abs(item.amount)));
    return [...sums.entries()].sort((a, b) => b[1] - a[1]);
  }, [data.transactions]);

  const runAction = async (path: string, body?: unknown, method = 'POST', success?: string) => {
    setBusy(true);
    try {
      const next = await postBankAction(path, body, method);
      applyState(next);
      if (success) toast(success);
      return true;
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Не удалось выполнить действие');
      return false;
    } finally { setBusy(false); }
  };
  const changePage = (next: Page) => { setPage(next); setSearch(''); };
  const submitOperation = async (event: FormEvent) => {
    event.preventDefault();
    const numeric = Number(amount.replace(',', '.'));
    if (!Number.isFinite(numeric) || numeric <= 0) { toast('Укажи корректную сумму'); return; }
    const ok = await runAction('/api/transactions', {
      accountId, targetAccountId, type: operation, amount: numeric, recipient: recipient.trim(),
    }, 'POST', 'Демо-операция выполнена. Реальные деньги не перемещались.');
    if (ok) { setOperation(null); setAmount(''); setRecipient(''); }
  };
  const submitNewAccount = async (event: FormEvent) => {
    event.preventDefault();
    const ok = await runAction('/api/accounts', { name: newAccountName, type: newAccountType }, 'POST', 'Демо-счёт создан');
    if (ok) setNewAccountName('');
  };
  const submitNewGoal = async (event: FormEvent) => {
    event.preventDefault();
    const ok = await runAction('/api/goals', { title: newGoalTitle, target: Number(newGoalTarget), deadline: newGoalDate }, 'POST', 'Цель накопления создана');
    if (ok) { setNewGoalTitle(''); setNewGoalTarget(''); setNewGoalDate(''); }
  };
  const contribute = async (goal: SavingsGoal) => {
    const value = Number((goalContribution[goal.id] || '').replace(',', '.'));
    if (!Number.isFinite(value) || value <= 0) { toast('Укажи сумму взноса'); return; }
    const ok = await runAction('/api/goals/' + goal.id + '/contribute', { accountId, amount: value }, 'POST', 'Взнос добавлен к демо-цели');
    if (ok) setGoalContribution(old => ({ ...old, [goal.id]: '' }));
  };
  const toggleTheme = async () => {
    const next = data.profile.theme === 'dark' ? 'light' : 'dark';
    await runAction('/api/profile', { theme: next }, 'PATCH', 'Тема интерфейса изменена');
  };
  const resetDemo = async () => {
    if (!window.confirm('Сбросить все локальные демо-данные?')) return;
    setBusy(true);
    try { applyState(await apiRequest<BankState>('/api/reset', { method: 'POST' })); setAdmin(null); toast('Демо-данные восстановлены'); }
    catch (error) { toast(error instanceof Error ? error.message : 'Не удалось сбросить данные'); }
    finally { setBusy(false); }
  };

  const openOperation = (kind: Operation) => {
    setOperation(kind);
    setAmount('');
    setRecipient('');
    if (kind === 'internal' && data.accounts.length > 1) {
      const source = data.accounts.find(item => item.id === accountId) ?? data.accounts[0];
      setTargetAccountId(data.accounts.find(item => item.id !== source.id)?.id ?? source.id);
    }
  };
  const title = page === 'home' ? 'Добрый день, ' + data.profile.name : pageNames[page];

  return <div className={data.profile.theme === 'light' ? 'app light' : 'app'}>
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">N</div><span>NORTH</span><small>BANK</small></div>
      <div className="profile-mini"><div className="avatar">{data.profile.name.slice(0, 1) || 'N'}</div><div><b>{data.profile.name}</b><span>Демо-клиент · {data.profile.customerId}</span></div><ChevronDown size={15}/></div>
      <div className="nav-label">РАЗДЕЛЫ</div>
      <nav>
        {nav.map(item => <NavButton key={item.id} item={item} active={page === item.id} onClick={() => changePage(item.id)}/>)}
        <NavButton item={{ id: 'notifications', label: 'Уведомления', icon: Bell }} active={page === 'notifications'} onClick={() => changePage('notifications')} badge={unread}/>
        <NavButton item={{ id: 'support', label: 'Поддержка', icon: Headphones }} active={page === 'support'} onClick={() => changePage('support')}/>
        <NavButton item={{ id: 'profile', label: 'Профиль', icon: Settings }} active={page === 'profile'} onClick={() => changePage('profile')}/>
        <NavButton item={{ id: 'admin', label: 'Демо-панель', icon: LayoutDashboard }} active={page === 'admin'} onClick={() => changePage('admin')}/>
      </nav>
      <div className="sidebar-bottom">
        <div className="support-card"><div className="support-icon"><ShieldCheck size={19}/></div><b>Локальный демо-режим</b><span>Все счета, карты и операции вымышленные. Сервер доступен только на этом компьютере.</span></div>
        <div className="sidebar-foot">NORTH BANK <span>·</span> DEMO 0.2</div>
      </div>
    </aside>

    <main className="main">
      <header className="topbar">
        <div className="crumb">Личный кабинет <ChevronRight size={14}/> <b>{pageNames[page]}</b></div>
        <div className="top-actions">
          <span className="demo-pill"><i/> ДЕМО-РЕЖИМ</span>
          <button className="icon-btn" onClick={() => changePage('notifications')} aria-label="Уведомления"><Bell size={19}/>{unread > 0 && <i/>}</button>
          <button className="top-avatar" onClick={() => changePage('profile')}>{data.profile.name.slice(0, 1) || 'N'}</button>
        </div>
      </header>

      <div className="content">
        <div className="page-heading">
          <div><div className="eyebrow">{new Intl.DateTimeFormat('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date()).toLocaleUpperCase('ru-RU')}</div><h1>{title}</h1><p>{page === 'home' ? 'Ваши демо-финансы собраны в одном пространстве.' : 'Управляйте демонстрационными счетами и настройками North Bank.'}</p></div>
          <button className="secondary-btn" onClick={() => setShowBalance(value => !value)}>{showBalance ? <EyeOff size={16}/> : <Eye size={16}/>} {showBalance ? 'Скрыть суммы' : 'Показать суммы'}</button>
        </div>
        {loading ? <div className="panel loading-panel"><RefreshCw className="spin"/> Подключаем локальный демо-сервер…</div> : <>
          {page === 'home' && <Dashboard data={data} total={total} income={income} expenses={expenses} show={showBalance} onPage={changePage} onOperation={openOperation}/>}
          {page === 'accounts' && <AccountsPage data={data} total={total} show={showBalance} busy={busy} name={newAccountName} setName={setNewAccountName} type={newAccountType} setType={setNewAccountType} onCreate={submitNewAccount} onRename={(id, name) => runAction('/api/accounts/' + id, { name }, 'PATCH', 'Название счёта изменено')} onHistory={() => changePage('history')}/>}
          {page === 'cards' && <CardsPage cards={data.cards} accounts={data.accounts} busy={busy} onToggle={id => runAction('/api/cards/' + id + '/toggle', undefined, 'POST', 'Статус демо-карты изменён')}/>}
          {page === 'payments' && <PaymentsPage accounts={data.accounts} onOperation={openOperation}/>}
          {page === 'history' && <HistoryPage items={filtered} search={search} setSearch={setSearch} filter={filter} setFilter={setFilter} show={showBalance}/>}
          {page === 'analytics' && <AnalyticsPage income={income} expenses={expenses} categories={categories} transactions={data.transactions} show={showBalance}/>}
          {page === 'savings' && <SavingsPage goals={data.goals} accounts={data.accounts} accountId={accountId} setAccountId={setAccountId} contribution={goalContribution} setContribution={setGoalContribution} title={newGoalTitle} setTitle={setNewGoalTitle} target={newGoalTarget} setTarget={setNewGoalTarget} deadline={newGoalDate} setDeadline={setNewGoalDate} onCreate={submitNewGoal} onContribute={contribute} busy={busy}/>}
          {page === 'notifications' && <NotificationsPage items={data.notifications} enabled={data.profile.notificationsEnabled} onRead={id => runAction('/api/notifications/' + id + '/read', undefined, 'POST')}/>}
          {page === 'profile' && <ProfilePage data={data} onTheme={toggleTheme} onNotifications={value => runAction('/api/profile', { notificationsEnabled: value }, 'PATCH', 'Настройки уведомлений сохранены')} onReset={resetDemo} busy={busy}/>}
          {page === 'support' && <SupportPage tickets={data.supportTickets} subject={supportSubject} setSubject={setSupportSubject} message={supportMessage} setMessage={setSupportMessage} onSubmit={async (event) => { event.preventDefault(); const ok = await runAction('/api/support', { subject: supportSubject, message: supportMessage }, 'POST', 'Демо-обращение зарегистрировано'); if (ok) { setSupportSubject(''); setSupportMessage(''); } }}/>}
          {page === 'admin' && <AdminPage data={data} admin={admin} onRefresh={() => getAdminSummary().then(setAdmin).catch(error => toast(error.message))}/>}
        </>}
      </div>
      <footer className="footer">© 2026 NORTH BANK <span>Локальный демонстрационный продукт · Не является финансовой организацией</span></footer>
    </main>

    {operation && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setOperation(null); }}>
      <form className="modal" onSubmit={submitOperation}>
        <div className="modal-head"><div><span className="eyebrow">ЛОКАЛЬНАЯ СИМУЛЯЦИЯ</span><h2>{operation === 'transfer' ? 'Новый демо-перевод' : operation === 'payment' ? 'Оплата услуги' : operation === 'internal' ? 'Между своими счетами' : 'Пополнение счёта'}</h2></div><button type="button" className="icon-btn" onClick={() => setOperation(null)}><X/></button></div>
        <div className="field"><label>{operation === 'internal' ? 'Счёт списания' : 'Счёт операции'}</label><select value={accountId} onChange={event => setAccountId(Number(event.target.value))}>{data.accounts.map(item => <option key={item.id} value={item.id}>{item.name} · {item.number}</option>)}</select><small>Доступно: {money(activeAccount?.balance ?? 0)}</small></div>
        {operation === 'internal' && <div className="field"><label>Счёт зачисления</label><select value={targetAccountId} onChange={event => setTargetAccountId(Number(event.target.value))}>{data.accounts.filter(item => item.id !== accountId).map(item => <option key={item.id} value={item.id}>{item.name} · {item.number}</option>)}</select></div>}
        {(operation === 'transfer' || operation === 'payment') && <div className="field"><label>{operation === 'transfer' ? 'Имя тестового получателя' : 'Название услуги'}</label><input value={recipient} onChange={event => setRecipient(event.target.value)} maxLength={80} placeholder={operation === 'transfer' ? 'Тестовый получатель' : 'Например, интернет'}/></div>}
        <div className="field"><label>Сумма, ₽ (виртуальная)</label><input required type="number" min="0.01" max="1000000" step="0.01" value={amount} onChange={event => setAmount(event.target.value)} placeholder="0"/></div>
        <div className="modal-warning"><ShieldCheck size={17}/> Это не платёжная операция. Меняются только вымышленные данные на локальном сервере.</div>
        <button className="primary-btn full" disabled={busy || (operation === 'internal' && data.accounts.length < 2)}><Check size={17}/> {busy ? 'Обработка…' : 'Подтвердить демо-операцию'}</button>
      </form>
    </div>}
    {notice && <div className="toast"><Check size={17}/>{notice}</div>}
  </div>;
}

function NavButton({ item, active, onClick, badge = 0 }: { item: { id: Page; label: string; icon: typeof Home }; active: boolean; onClick: () => void; badge?: number }) {
  const Icon = item.icon;
  return <button className={active ? 'nav-item active' : 'nav-item'} onClick={onClick}><Icon size={18}/>{item.label}{badge > 0 && <span className="nav-count">{badge}</span>}</button>;
}

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
function AccountsPage({ data, total, show, busy, name, setName, type, setType, onCreate, onRename, onHistory }: { data: BankState; total: number; show: boolean; busy: boolean; name: string; setName: (value: string) => void; type: 'current' | 'savings'; setType: (value: 'current' | 'savings') => void; onCreate: (event: FormEvent) => void; onRename: (id: number, name: string) => void; onHistory: () => void }) {
  const [renaming, setRenaming] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');
  return <div className="module-grid">
    <section className="panel"><PanelHead title="Все счета" subtitle={'Всего: ' + data.accounts.length + ' · Общий демо-баланс: ' + (show ? money(total) : '•••• ₽')}/><div className="account-grid">{data.accounts.map(item => <div className={'account-big ' + item.color} key={item.id}><div className="account-big-top"><span>{item.type}</span><Wallet size={21}/></div><h3>{item.name}</h3><p>{item.number}</p><strong>{show ? money(item.balance) : '•••• ₽'}</strong><div className="account-actions"><button onClick={() => { setRenaming(item.id); setRenameValue(item.name); }}>Переименовать</button><button onClick={onHistory}>История <ChevronRight size={14}/></button></div>{renaming === item.id && <form className="rename-form" onSubmit={event => { event.preventDefault(); onRename(item.id, renameValue); setRenaming(null); }}><input value={renameValue} onChange={event => setRenameValue(event.target.value)} maxLength={40}/><button disabled={busy}>Сохранить</button></form>}</div>)}</div></section>
    <section className="panel"><PanelHead title="Открыть демо-счёт" subtitle="Создай дополнительный виртуальный счёт"/><form className="stack-form" onSubmit={onCreate}><div className="field"><label>Название счёта</label><input required maxLength={40} value={name} onChange={event => setName(event.target.value)} placeholder="Например, На поездку"/></div><div className="field"><label>Тип счёта</label><select value={type} onChange={event => setType(event.target.value as 'current' | 'savings')}><option value="current">Текущий</option><option value="savings">Накопительный</option></select></div><button className="primary-btn" disabled={busy}><Plus size={16}/> Создать счёт</button></form><div className="inline-info"><ShieldCheck size={17}/> Новый счёт создаётся с нулевым виртуальным балансом.</div></section>
  </div>;
}
function CardsPage({ cards, accounts, busy, onToggle }: { cards: BankCard[]; accounts: Account[]; busy: boolean; onToggle: (id: number) => void }) {
  return <section className="panel page-panel"><PanelHead title="Демо-карты" subtitle="Макеты карт связаны с виртуальными счетами"/><div className="cards-grid">{cards.map(card => {
    const account = accounts.find(item => item.id === card.accountId);
    return <div className={'bank-card ' + (card.id % 2 ? 'purple-card' : 'blue-card')} key={card.id}><div className="bank-card-head"><b>NORTH</b><span>{card.type}</span></div><div className="chip"/><div className="card-number">•••• &nbsp; •••• &nbsp; •••• &nbsp; {card.last4}</div><div className="bank-card-bottom"><div><small>НАЗВАНИЕ</small><b>{card.name}</b></div><div><small>СЧЁТ</small><b>{account?.name || 'Не найден'}</b></div><b className="visa">N</b></div><div className="card-state"><span className={card.status === 'active' ? 'state-active' : 'state-frozen'}>{card.status === 'active' ? 'АКТИВНА В ДЕМО' : 'ЗАМОРОЖЕНА В ДЕМО'}</span><button disabled={busy} onClick={() => onToggle(card.id)}>{card.status === 'active' ? <Snowflake size={15}/> : <BadgeCheck size={15}/>} {card.status === 'active' ? 'Заморозить' : 'Разморозить'}</button></div></div>;
  })}</div><div className="inline-info"><LockKeyhole size={17}/> Здесь нет номера платёжной карты, срока действия или CVV. Переключатель меняет только демонстрационный статус.</div></section>;
}
function PaymentsPage({ accounts, onOperation }: { accounts: Account[]; onOperation: (kind: Operation) => void }) {
  const actions: { kind: Operation; title: string; desc: string; icon: ReactNode; color: string }[] = [
    { kind: 'transfer', title: 'Демо-перевод', desc: 'Симуляция отправки виртуальных средств условному получателю', icon: <Send/>, color: 'purple' },
    { kind: 'internal', title: 'Между своими счетами', desc: 'Перемещение виртуального баланса между счетами', icon: <ArrowLeftRight/>, color: 'blue' },
    { kind: 'payment', title: 'Оплата услуги', desc: 'Создать тестовую запись о списании', icon: <BriefcaseBusiness/>, color: 'orange' },
    { kind: 'topup', title: 'Пополнение', desc: 'Добавить виртуальные средства на демо-счёт', icon: <Plus/>, color: 'green' },
  ];
  return <section className="panel page-panel"><PanelHead title="Операции" subtitle="Все операции выполняются только в локальной демонстрационной базе"/><div className="payment-options">{actions.map(item => <button key={item.kind} onClick={() => onOperation(item.kind)} disabled={item.kind === 'internal' && accounts.length < 2}><span className={'quick-icon ' + item.color}>{item.icon}</span><b>{item.title}</b><small>{item.desc}</small><ChevronRight/></button>)}</div></section>;
}
function HistoryPage({ items, search, setSearch, filter, setFilter, show }: { items: Transaction[]; search: string; setSearch: (value: string) => void; filter: 'all' | 'income' | 'expense'; setFilter: (value: 'all' | 'income' | 'expense') => void; show: boolean }) {
  return <section className="panel page-panel"><div className="panel-head"><div><h3>История операций</h3><p>{items.length} операций найдено</p></div><div className="search-box"><Search size={17}/><input placeholder="Поиск" value={search} onChange={event => setSearch(event.target.value)}/><SlidersHorizontal size={16}/></div></div><div className="filter-row"><button className={filter === 'all' ? 'filter-active' : ''} onClick={() => setFilter('all')}>Все</button><button className={filter === 'income' ? 'filter-active' : ''} onClick={() => setFilter('income')}>Поступления</button><button className={filter === 'expense' ? 'filter-active' : ''} onClick={() => setFilter('expense')}>Списания</button></div><div className="history-table"><div className="table-labels"><span>ОПЕРАЦИЯ</span><span>ДАТА</span><span>СУММА</span></div>{items.map(item => <TxRow key={item.id} tx={item} show={show}/>)}{items.length === 0 && <div className="empty">По этому запросу ничего не найдено.</div>}</div></section>;
}
function AnalyticsPage({ income, expenses, categories, transactions, show }: { income: number; expenses: number; categories: [string, number][]; transactions: Transaction[]; show: boolean }) {
  const max = Math.max(1, ...categories.map(item => item[1]));
  return <div className="module-grid"><section className="panel"><PanelHead title="Сводка" subtitle="Расчёт по сохранённой демо-истории"/><div className="analytics-summary"><div><span>Поступления</span><b className="positive">{show ? money(income) : '•••• ₽'}</b></div><div><span>Списания</span><b>{show ? money(expenses) : '•••• ₽'}</b></div><div><span>Разница</span><b className={income - expenses >= 0 ? 'positive' : 'negative'}>{show ? money(income - expenses) : '•••• ₽'}</b></div><div><span>Операций</span><b>{transactions.length}</b></div></div></section><section className="panel"><PanelHead title="Расходы по категориям" subtitle="Распределение всех демо-списаний"/>{categories.length ? <div className="category-chart">{categories.map(([name, value]) => <div className="category-line" key={name}><div><b>{name}</b><span>{show ? money(value) : '•••• ₽'}</span></div><div className="bar-track"><i style={{ width: (value / max * 100) + '%' }}/></div></div>)}</div> : <div className="empty">Пока нет расходов для аналитики.</div>}</section><section className="panel"><PanelHead title="Последние движения" subtitle="Первые 10 операций"/>{transactions.slice(0, 10).map(item => <TxRow key={item.id} tx={item} show={show}/>)}</section></div>;
}
function SavingsPage({ goals, accounts, accountId, setAccountId, contribution, setContribution, title, setTitle, target, setTarget, deadline, setDeadline, onCreate, onContribute, busy }: { goals: SavingsGoal[]; accounts: Account[]; accountId: number; setAccountId: (id: number) => void; contribution: Record<number, string>; setContribution: (fn: (old: Record<number, string>) => Record<number, string>) => void; title: string; setTitle: (value: string) => void; target: string; setTarget: (value: string) => void; deadline: string; setDeadline: (value: string) => void; onCreate: (event: FormEvent) => void; onContribute: (goal: SavingsGoal) => void; busy: boolean }) {
  return <div className="module-grid"><section className="panel"><PanelHead title="Мои цели" subtitle="Накопления внутри демонстрационного приложения"/>{goals.map(goal => { const percent = Math.min(100, goal.current / goal.target * 100); return <div className="goal-card" key={goal.id}><div className="goal-top"><div><h3>{goal.title}</h3><small>{goal.deadline ? 'Плановая дата: ' + goal.deadline : 'Без срока'}</small></div><b>{Math.round(percent)}%</b></div><div className="bar-track"><i style={{ width: percent + '%' }}/></div><div className="goal-numbers"><b>{money(goal.current)}</b><span>из {money(goal.target)}</span></div>{percent < 100 && <div className="goal-contribute"><input type="number" min="1" step="1" placeholder="Сумма взноса" value={contribution[goal.id] || ''} onChange={event => setContribution(old => ({ ...old, [goal.id]: event.target.value }))}/><button className="primary-btn" disabled={busy} onClick={() => onContribute(goal)}>Внести</button></div>}{percent >= 100 && <span className="goal-complete"><Check size={15}/> Цель достигнута</span>}</div>; })}{goals.length === 0 && <div className="empty">Создай первую цель накопления.</div>}</section><section className="panel"><PanelHead title="Новая цель" subtitle="Задай ориентир и плановую дату"/><form className="stack-form" onSubmit={onCreate}><div className="field"><label>Название</label><input required maxLength={60} value={title} onChange={event => setTitle(event.target.value)} placeholder="Например, путешествие"/></div><div className="field"><label>Сумма цели, ₽</label><input required type="number" min="100" max="10000000" value={target} onChange={event => setTarget(event.target.value)} placeholder="50000"/></div><div className="field"><label>Плановая дата</label><input type="date" value={deadline} onChange={event => setDeadline(event.target.value)}/></div><button className="primary-btn" disabled={busy}><Plus size={16}/> Создать цель</button></form><div className="field goal-account"><label>Счёт для взносов</label><select value={accountId} onChange={event => setAccountId(Number(event.target.value))}>{accounts.map(item => <option key={item.id} value={item.id}>{item.name} · {item.number}</option>)}</select></div><div className="inline-info">Взносы уменьшают баланс выбранного демо-счёта и увеличивают сумму цели.</div></section></div>;
}
function NotificationsPage({ items, enabled, onRead }: { items: BankState['notifications']; enabled: boolean; onRead: (id: number) => void }) {
  return <section className="panel page-panel"><PanelHead title="Уведомления" subtitle={enabled ? 'Уведомления включены в настройках демо-профиля' : 'Уведомления отключены в настройках профиля'}/>{items.map(item => <div className={item.read ? 'notification-row read' : 'notification-row'} key={item.id}><div className="notification-icon"><Bell size={18}/></div><div><b>{item.title}</b><p>{item.message}</p><small>{item.date}</small></div>{!item.read && <button className="text-link" onClick={() => onRead(item.id)}>Прочитано</button>}</div>)}{items.length === 0 && <div className="empty">Уведомлений пока нет.</div>}</section>;
}
function ProfilePage({ data, onTheme, onNotifications, onReset, busy }: { data: BankState; onTheme: () => void; onNotifications: (value: boolean) => void; onReset: () => void; busy: boolean }) {
  return <div className="module-grid"><section className="panel"><div className="profile-large"><div className="avatar large">{data.profile.name.slice(0, 1)}</div><div><h2>{data.profile.name}</h2><p>Демо-клиент · {data.profile.customerId}</p></div></div><div className="profile-settings"><div><UserRound/><span><b>Профиль</b><small>Вымышленный профиль локального прототипа</small></span><BadgeCheck/></div><div><ShieldCheck/><span><b>Режим защиты</b><small>Нет реальных паролей и платёжных реквизитов</small></span><LockKeyhole/></div><div><Settings/><span><b>Тема интерфейса</b><small>Переключение оформления приложения</small></span><button className="toggle" onClick={onTheme}>{data.profile.theme === 'dark' ? 'Тёмная' : 'Светлая'}</button></div><div><Bell/><span><b>Уведомления</b><small>Локальные уведомления об операциях</small></span><button className={data.profile.notificationsEnabled ? 'toggle toggle-on' : 'toggle'} onClick={() => onNotifications(!data.profile.notificationsEnabled)}>{data.profile.notificationsEnabled ? 'Включены' : 'Выключены'}</button></div></div></section><section className="panel"><PanelHead title="Данные приложения" subtitle="North Bank Demo · версия 0.2"/><div className="profile-info-grid"><div><span>Счета</span><b>{data.accounts.length}</b></div><div><span>Карты</span><b>{data.cards.length}</b></div><div><span>Операции</span><b>{data.transactions.length}</b></div><div><span>Цели</span><b>{data.goals.length}</b></div></div><button className="reset-btn" disabled={busy} onClick={onReset}><RefreshCw size={16}/> Сбросить все демо-данные</button><div className="inline-info"><ShieldCheck size={17}/> Сброс затрагивает только локальную JSON-базу этого прототипа.</div></section></div>;
}
function SupportPage({ tickets, subject, setSubject, message, setMessage, onSubmit }: { tickets: BankState['supportTickets']; subject: string; setSubject: (value: string) => void; message: string; setMessage: (value: string) => void; onSubmit: (event: FormEvent) => void }) {
  return <div className="module-grid"><section className="panel"><PanelHead title="Демо-поддержка" subtitle="Создай локальное обращение — ответа оператора нет"/><form className="stack-form" onSubmit={onSubmit}><div className="field"><label>Тема обращения</label><input required maxLength={80} value={subject} onChange={event => setSubject(event.target.value)} placeholder="Кратко опиши вопрос"/></div><div className="field"><label>Сообщение</label><textarea required minLength={5} maxLength={1000} rows={5} value={message} onChange={event => setMessage(event.target.value)} placeholder="Текст обращения"/></div><button className="primary-btn"><Send size={16}/> Зарегистрировать демо-обращение</button></form></section><section className="panel"><PanelHead title="Мои обращения" subtitle={tickets.length + ' записей в локальной базе'}/>{tickets.map(ticket => <div className="ticket-row" key={ticket.id}><div><b>{ticket.subject}</b><p>{ticket.message}</p><small>{new Date(ticket.date).toLocaleString('ru-RU')}</small></div><span className="ticket-status">{ticket.status}</span></div>)}{tickets.length === 0 && <div className="empty">Обращений пока нет.</div>}</section></div>;
}
function AdminPage({ data, admin, onRefresh }: { data: BankState; admin: AdminSummary | null; onRefresh: () => void }) {
  const summary = admin?.summary;
  return <div className="module-grid"><section className="panel"><div className="panel-head"><div><h3>Демо-администрирование</h3><p>Локальная обзорная панель без авторизации и реальных пользователей</p></div><button className="secondary-btn" onClick={onRefresh}><RefreshCw size={15}/> Обновить</button></div><div className="admin-warning"><ShieldCheck size={18}/> Эта панель предназначена только для демонстрации. Она не является защищённой админкой и не управляет настоящими банковскими данными.</div><div className="admin-stats"><Stat label="Демо-счета" value={String(summary?.accounts ?? data.accounts.length)} icon={<Wallet/>}/><Stat label="Макеты карт" value={String(summary?.cards ?? data.cards.length)} icon={<CreditCard/>}/><Stat label="Операции" value={String(summary?.transactions ?? data.transactions.length)} icon={<Activity/>}/><Stat label="Открытые обращения" value={String(summary?.openTickets ?? data.supportTickets.length)} icon={<Headphones/>}/></div><div className="admin-total"><span>Суммарный виртуальный баланс</span><b>{money(summary?.totalDemoBalance ?? data.accounts.reduce((sum, item) => sum + item.balance, 0))}</b></div></section><section className="panel"><PanelHead title="Журнал событий" subtitle="Последние действия в локальной демо-среде"/>{(admin?.audit ?? data.audit).slice(0, 30).map(entry => <div className="audit-row" key={entry.id}><div><b>{entry.action}</b><small>{entry.details}</small></div><time>{new Date(entry.date).toLocaleString('ru-RU')}</time></div>)}</section></div>;
}
