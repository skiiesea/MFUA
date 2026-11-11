import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import {
  Activity, ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Bell, BriefcaseBusiness, Check,
  ChevronDown, ChevronRight, CircleHelp, CreditCard, Eye, EyeOff, FileText, Home,
  LayoutDashboard, LogOut, Plus, Search, Settings, ShieldCheck, SlidersHorizontal,
  Sparkles, Target, UserRound, Wallet, X, Snowflake, PieChart, Headphones, Landmark,
  RefreshCw, LockKeyhole, TrendingUp, CircleDollarSign, Send, BadgeCheck,
} from 'lucide-react';
import { apiRequest, getAdminSummary, getBankState, postBankAction } from './api';
import type { AdminSummary, BankState, Page, Operation, SavingsGoal } from './types';
import { Dashboard } from './features/DashboardPage';
import { AccountsPage } from './features/AccountsPage';
import { CardsPage } from './features/CardsPage';
import { PaymentsPage } from './features/PaymentsPage';
import { HistoryPage } from './features/HistoryPage';
import { AnalyticsPage } from './features/AnalyticsPage';
import { SavingsPage } from './features/SavingsPage';
import { NotificationsPage } from './features/NotificationsPage';
import { ProfilePage } from './features/ProfilePage';
import { SupportPage } from './features/SupportPage';
import { AdminPage } from './features/AdminPage';

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
