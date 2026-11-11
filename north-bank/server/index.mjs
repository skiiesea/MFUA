import { createServer } from 'node:http';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(ROOT, 'data');
const DATA_FILE = join(DATA_DIR, 'demo-state.json');
const HOST = '127.0.0.1';
const PORT = Number(process.env.API_PORT || 4175);
const MAX_AMOUNT = 1_000_000;

const initialState = () => ({
  accounts: [
    { id: 1, name: 'Основной счёт', number: '•• 4821', balance: 284650, color: 'violet', type: 'Текущий' },
    { id: 2, name: 'Накопительный', number: '•• 1904', balance: 125000, color: 'blue', type: 'Сбережения' },
  ],
  transactions: [
    { id: 1, title: 'Зачисление', detail: 'Пополнение демо-баланса', amount: 25000, date: 'Сегодня, 12:42', category: 'Доход', kind: 'income', accountId: 1 },
    { id: 2, title: 'Кофейня Север', detail: 'Покупка по карте •• 4821', amount: -460, date: 'Сегодня, 10:18', category: 'Кафе', kind: 'expense', accountId: 1 },
    { id: 3, title: 'Маркетплейс', detail: 'Покупка по карте •• 4821', amount: -3290, date: 'Вчера, 19:05', category: 'Покупки', kind: 'expense', accountId: 1 },
    { id: 4, title: 'Перевод между счетами', detail: 'На накопительный', amount: -10000, date: 'Вчера, 14:20', category: 'Переводы', kind: 'transfer', accountId: 1 },
    { id: 5, title: 'Возврат покупки', detail: 'Маркетплейс', amount: 1890, date: '10 ноября, 09:12', category: 'Возврат', kind: 'income', accountId: 1 },
  ],
  cards: [
    { id: 1, accountId: 1, name: 'Основная карта', last4: '4821', network: 'NORTH', status: 'active', type: 'DEBIT · DEMO' },
    { id: 2, accountId: 2, name: 'Карта накоплений', last4: '1904', network: 'NORTH', status: 'active', type: 'SAVINGS · DEMO' },
  ],
  goals: [
    { id: 1, title: 'Новый ноутбук', target: 120000, current: 45000, deadline: '2027-03-01' },
    { id: 2, title: 'Резерв', target: 200000, current: 72000, deadline: '2027-06-01' },
  ],
  notifications: [
    { id: 1, title: 'Добро пожаловать в North Bank', message: 'Это демонстрационный проект. Все операции вымышленные.', date: 'Сегодня', read: false },
    { id: 2, title: 'Демо-счета готовы', message: 'Можно изучать интерфейс и тестировать локальные операции.', date: 'Сегодня', read: false },
  ],
  audit: [{ id: 1, action: 'Инициализация демо-среды', details: 'Созданы стартовые счета, карты и цели', date: new Date().toISOString() }],
  supportTickets: [],
  profile: { name: 'Александр', customerId: 'NB-000042', theme: 'dark', notificationsEnabled: true },
});

function normalizeState(saved) {
  const defaults = initialState();
  return {
    ...defaults,
    ...saved,
    accounts: Array.isArray(saved.accounts) ? saved.accounts : defaults.accounts,
    transactions: Array.isArray(saved.transactions) ? saved.transactions : defaults.transactions,
    cards: Array.isArray(saved.cards) ? saved.cards : defaults.cards,
    goals: Array.isArray(saved.goals) ? saved.goals : defaults.goals,
    notifications: Array.isArray(saved.notifications) ? saved.notifications : defaults.notifications,
    audit: Array.isArray(saved.audit) ? saved.audit : defaults.audit,
    supportTickets: Array.isArray(saved.supportTickets) ? saved.supportTickets : defaults.supportTickets,
    profile: { ...defaults.profile, ...(saved.profile || {}) },
  };
}

async function saveState(state) {
  await mkdir(DATA_DIR, { recursive: true });
  const tempFile = DATA_FILE + '.tmp';
  await writeFile(tempFile, JSON.stringify(state, null, 2), 'utf8');
  await rename(tempFile, DATA_FILE);
}

async function readState() {
  try {
    return normalizeState(JSON.parse(await readFile(DATA_FILE, 'utf8')));
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
    const state = initialState();
    await saveState(state);
    return state;
  }
}

function send(response, status, payload) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(JSON.stringify(payload));
}

async function readBody(request) {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 16_384) {
      const error = new Error('Слишком большой запрос');
      error.status = 413;
      throw error;
    }
  }
  try {
    return JSON.parse(body || '{}');
  } catch {
    const error = new Error('Некорректный JSON');
    error.status = 400;
    throw error;
  }
}

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function audit(state, action, details) {
  state.audit.unshift({ id: Date.now() + state.audit.length, action, details, date: new Date().toISOString() });
  state.audit = state.audit.slice(0, 100);
}

function notify(state, title, message) {
  state.notifications.unshift({ id: Date.now() + state.notifications.length, title, message, date: 'Сегодня', read: false });
  state.notifications = state.notifications.slice(0, 50);
}

function transaction(state, { title, detail, amount, category, kind, accountId }) {
  const date = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date());
  state.transactions.unshift({ id: Date.now() + state.transactions.length, title, detail, amount, category, kind, accountId, date });
  state.transactions = state.transactions.slice(0, 500);
}

let queue = Promise.resolve();
function serialize(task) {
  const result = queue.then(task, task);
  queue = result.catch(() => {});
  return result;
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url || '/', 'http://localhost');
  const method = request.method || 'GET';
  try {
    if (method === 'GET' && url.pathname === '/api/health') return send(response, 200, { ok: true, mode: 'demo' });
    if (method === 'GET' && url.pathname === '/api/state') {
      const state = await serialize(readState);
      return send(response, 200, state);
    }
    if (method === 'POST' && url.pathname === '/api/reset') {
      const state = await serialize(async () => {
        const fresh = initialState();
        await saveState(fresh);
        return fresh;
      });
      return send(response, 200, state);
    }
    if (method === 'POST' && url.pathname === '/api/transactions') {
      const input = await readBody(request);
      const state = await serialize(async () => {
        const current = await readState();
        const amount = Number(input.amount);
        const accountId = Number(input.accountId);
        const type = input.type;
        const recipient = typeof input.recipient === 'string' ? input.recipient.trim().slice(0, 80) : '';
        if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_AMOUNT) fail('Сумма должна быть от 0,01 до 1 000 000 ₽');
        if (!['transfer', 'payment', 'topup', 'internal'].includes(type)) fail('Неизвестный тип демо-операции');
        if (type !== 'topup' && !recipient && type !== 'internal') fail('Укажи тестового получателя или услугу');
        const account = current.accounts.find(item => item.id === accountId);
        if (!account) fail('Демо-счёт не найден', 404);
        if (account.balance < amount) fail('Недостаточно средств на демо-счёте');
        if (type === 'internal') {
          const targetId = Number(input.targetAccountId);
          const target = current.accounts.find(item => item.id === targetId);
          if (!target || target.id === account.id) fail('Выбери другой существующий счёт');
          account.balance -= amount;
          target.balance += amount;
          transaction(current, { title: 'Перевод между своими счетами', detail: account.name + ' → ' + target.name, amount: -amount, category: 'Переводы', kind: 'transfer', accountId: account.id });
          transaction(current, { title: 'Зачисление между своими счетами', detail: account.name + ' → ' + target.name, amount, category: 'Переводы', kind: 'income', accountId: target.id });
        } else if (type === 'topup') {
          account.balance += amount;
          transaction(current, { title: 'Тестовое пополнение', detail: 'Виртуальные средства', amount, category: 'Пополнение', kind: 'income', accountId: account.id });
        } else {
          account.balance -= amount;
          transaction(current, { title: type === 'transfer' ? 'Демо-перевод' : recipient, detail: type === 'transfer' ? 'Тестовый получатель: ' + recipient : 'Демо-платёж', amount: -amount, category: type === 'transfer' ? 'Переводы' : 'Платежи', kind: type === 'transfer' ? 'transfer' : 'expense', accountId: account.id });
        }
        audit(current, 'Демо-операция', 'Тип: ' + type + ', сумма: ' + amount + ' ₽');
        notify(current, 'Новая демо-операция', 'В истории появилась операция на ' + amount + ' ₽.');
        await saveState(current);
        return current;
      });
      return send(response, 200, state);
    }
    if (method === 'POST' && url.pathname === '/api/accounts') {
      const input = await readBody(request);
      const state = await serialize(async () => {
        const current = await readState();
        const name = typeof input.name === 'string' ? input.name.trim().slice(0, 40) : '';
        const type = input.type === 'savings' ? 'Сбережения' : 'Текущий';
        if (!name) fail('Укажи название счёта');
        if (current.accounts.length >= 8) fail('В демо-режиме можно создать не более 8 счетов');
        const id = Math.max(0, ...current.accounts.map(item => item.id)) + 1;
        const account = { id, name, number: '•• ' + String(1000 + id * 137).slice(-4), balance: 0, color: id % 2 ? 'violet' : 'blue', type };
        current.accounts.push(account);
        audit(current, 'Создан демо-счёт', name);
        notify(current, 'Создан новый счёт', name + ' доступен в списке счетов.');
        await saveState(current);
        return current;
      });
      return send(response, 201, state);
    }
    const accountMatch = url.pathname.match(/^\/api\/accounts\/(\d+)$/);
    if (accountMatch && method === 'PATCH') {
      const input = await readBody(request);
      const state = await serialize(async () => {
        const current = await readState();
        const account = current.accounts.find(item => item.id === Number(accountMatch[1]));
        if (!account) fail('Счёт не найден', 404);
        const name = typeof input.name === 'string' ? input.name.trim().slice(0, 40) : '';
        if (!name) fail('Название счёта не может быть пустым');
        account.name = name;
        audit(current, 'Изменено название счёта', name);
        await saveState(current);
        return current;
      });
      return send(response, 200, state);
    }
    const cardMatch = url.pathname.match(/^\/api\/cards\/(\d+)\/toggle$/);
    if (cardMatch && method === 'POST') {
      const state = await serialize(async () => {
        const current = await readState();
        const card = current.cards.find(item => item.id === Number(cardMatch[1]));
        if (!card) fail('Демо-карта не найдена', 404);
        card.status = card.status === 'active' ? 'frozen' : 'active';
        audit(current, 'Изменён статус демо-карты', card.name + ': ' + card.status);
        notify(current, 'Статус демо-карты изменён', card.name + ' — ' + (card.status === 'frozen' ? 'заморожена' : 'активна') + '.');
        await saveState(current);
        return current;
      });
      return send(response, 200, state);
    }
    if (method === 'POST' && url.pathname === '/api/goals') {
      const input = await readBody(request);
      const state = await serialize(async () => {
        const current = await readState();
        const title = typeof input.title === 'string' ? input.title.trim().slice(0, 60) : '';
        const target = Number(input.target);
        if (!title) fail('Укажи название цели');
        if (!Number.isFinite(target) || target < 100 || target > 10_000_000) fail('Цель должна быть от 100 до 10 000 000 ₽');
        if (current.goals.length >= 12) fail('В демо-режиме можно создать не более 12 целей');
        const goal = { id: Math.max(0, ...current.goals.map(item => item.id)) + 1, title, target, current: 0, deadline: typeof input.deadline === 'string' ? input.deadline : '' };
        current.goals.push(goal);
        audit(current, 'Создана цель накопления', title);
        await saveState(current);
        return current;
      });
      return send(response, 201, state);
    }
    const goalMatch = url.pathname.match(/^\/api\/goals\/(\d+)\/contribute$/);
    if (goalMatch && method === 'POST') {
      const input = await readBody(request);
      const state = await serialize(async () => {
        const current = await readState();
        const goal = current.goals.find(item => item.id === Number(goalMatch[1]));
        const account = current.accounts.find(item => item.id === Number(input.accountId));
        const amount = Number(input.amount);
        if (!goal) fail('Цель не найдена', 404);
        if (!account) fail('Демо-счёт не найден', 404);
        if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_AMOUNT) fail('Некорректная сумма');
        if (amount > account.balance) fail('Недостаточно средств на демо-счёте');
        if (goal.current >= goal.target) fail('Эта цель уже достигнута');
        const contribution = Math.min(amount, goal.target - goal.current);
        account.balance -= contribution;
        goal.current += contribution;
        transaction(current, { title: 'Взнос в цель', detail: goal.title, amount: -contribution, category: 'Накопления', kind: 'transfer', accountId: account.id });
        audit(current, 'Пополнение цели', goal.title + ': ' + contribution + ' ₽');
        await saveState(current);
        return current;
      });
      return send(response, 200, state);
    }
    const notificationMatch = url.pathname.match(/^\/api\/notifications\/(\d+)\/read$/);
    if (notificationMatch && method === 'POST') {
      const state = await serialize(async () => {
        const current = await readState();
        const item = current.notifications.find(entry => entry.id === Number(notificationMatch[1]));
        if (!item) fail('Уведомление не найдено', 404);
        item.read = true;
        await saveState(current);
        return current;
      });
      return send(response, 200, state);
    }
    if (method === 'PATCH' && url.pathname === '/api/profile') {
      const input = await readBody(request);
      const state = await serialize(async () => {
        const current = await readState();
        if (typeof input.theme === 'string' && ['dark', 'light'].includes(input.theme)) current.profile.theme = input.theme;
        if (typeof input.notificationsEnabled === 'boolean') current.profile.notificationsEnabled = input.notificationsEnabled;
        audit(current, 'Изменены настройки профиля', 'Обновлены настройки демо-профиля');
        await saveState(current);
        return current;
      });
      return send(response, 200, state);
    }
    if (method === 'POST' && url.pathname === '/api/support') {
      const input = await readBody(request);
      const state = await serialize(async () => {
        const current = await readState();
        const subject = typeof input.subject === 'string' ? input.subject.trim().slice(0, 80) : '';
        const message = typeof input.message === 'string' ? input.message.trim().slice(0, 1000) : '';
        if (!subject || message.length < 5) fail('Заполни тему и сообщение (минимум 5 символов)');
        if (current.supportTickets.length >= 50) fail('Лимит демо-обращений достигнут');
        const ticket = { id: Date.now(), subject, message, status: 'Открыто', date: new Date().toISOString() };
        current.supportTickets.unshift(ticket);
        audit(current, 'Создано демо-обращение', subject);
        notify(current, 'Обращение зарегистрировано', 'Тема: ' + subject + '. Ответы операторов в прототипе не отправляются.');
        await saveState(current);
        return current;
      });
      return send(response, 201, state);
    }
    if (method === 'GET' && url.pathname === '/api/admin/summary') {
      const state = await serialize(readState);
      return send(response, 200, {
        summary: {
          accounts: state.accounts.length,
          cards: state.cards.length,
          transactions: state.transactions.length,
          goals: state.goals.length,
          openTickets: state.supportTickets.filter(ticket => ticket.status === 'Открыто').length,
          totalDemoBalance: state.accounts.reduce((sum, account) => sum + account.balance, 0),
        },
        audit: state.audit.slice(0, 30),
        tickets: state.supportTickets.slice(0, 20),
      });
    }
    return send(response, 404, { error: 'Маршрут не найден' });
  } catch (error) {
    const status = Number.isInteger(error?.status) ? error.status : 500;
    return send(response, status, { error: error instanceof Error ? error.message : 'Ошибка сервера' });
  }
});

server.listen(PORT, HOST, () => {
  console.log('[north-bank] Demo API: http://' + HOST + ':' + PORT);
  console.log('[north-bank] Только локальные вымышленные данные. Реальные платежи отключены.');
});
