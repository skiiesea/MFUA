import { createServer } from 'node:http';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(ROOT, 'data');
const DATA_FILE = join(DATA_DIR, 'demo-state.json');
const HOST = '127.0.0.1';
const PORT = Number(process.env.API_PORT || 4175);

const initialState = () => ({
  accounts: [
    { id: 1, name: 'Основной счёт', number: '•• 4821', balance: 284650, color: 'violet', type: 'Текущий' },
    { id: 2, name: 'Накопительный', number: '•• 1904', balance: 125000, color: 'blue', type: 'Сбережения' },
  ],
  transactions: [
    { id: 1, title: 'Зачисление', detail: 'Пополнение демо-баланса', amount: 25000, date: 'Сегодня, 12:42', category: 'Доход', kind: 'income' },
    { id: 2, title: 'Кофейня Север', detail: 'Покупка по карте •• 4821', amount: -460, date: 'Сегодня, 10:18', category: 'Кафе', kind: 'expense' },
    { id: 3, title: 'Маркетплейс', detail: 'Покупка по карте •• 4821', amount: -3290, date: 'Вчера, 19:05', category: 'Покупки', kind: 'expense' },
    { id: 4, title: 'Перевод между счетами', detail: 'На накопительный', amount: -10000, date: 'Вчера, 14:20', category: 'Переводы', kind: 'transfer' },
    { id: 5, title: 'Возврат покупки', detail: 'Маркетплейс', amount: 1890, date: '10 ноября, 09:12', category: 'Возврат', kind: 'income' },
  ],
});

async function saveState(state) {
  await mkdir(DATA_DIR, { recursive: true });
  const tempFile = DATA_FILE + '.tmp';
  await writeFile(tempFile, JSON.stringify(state, null, 2), 'utf8');
  await rename(tempFile, DATA_FILE);
}

async function readState() {
  try {
    return JSON.parse(await readFile(DATA_FILE, 'utf8'));
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
    if (body.length > 16_384) throw new Error('Слишком большой запрос');
  }
  try {
    return JSON.parse(body || '{}');
  } catch {
    throw new Error('Некорректный JSON');
  }
}

let queue = Promise.resolve();
function serialize(task) {
  const result = queue.then(task, task);
  queue = result.catch(() => {});
  return result;
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url || '/', 'http://localhost');
  try {
    if (request.method === 'GET' && url.pathname === '/api/health') {
      return send(response, 200, { ok: true, mode: 'demo' });
    }
    if (request.method === 'GET' && url.pathname === '/api/state') {
      const state = await serialize(readState);
      return send(response, 200, state);
    }
    if (request.method === 'POST' && url.pathname === '/api/reset') {
      const state = await serialize(async () => {
        const fresh = initialState();
        await saveState(fresh);
        return fresh;
      });
      return send(response, 200, state);
    }
    if (request.method === 'POST' && url.pathname === '/api/transactions') {
      const input = await readBody(request);
      const state = await serialize(async () => {
        const current = await readState();
        const amount = Number(input.amount);
        const accountId = Number(input.accountId);
        const type = input.type;
        const recipient = typeof input.recipient === 'string' ? input.recipient.trim().slice(0, 80) : '';
        if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) {
          const error = new Error('Сумма должна быть от 0,01 до 1 000 000 ₽');
          error.status = 400;
          throw error;
        }
        if (!['transfer', 'payment', 'topup'].includes(type)) {
          const error = new Error('Неизвестный тип демо-операции');
          error.status = 400;
          throw error;
        }
        if ((type === 'transfer' || type === 'payment') && !recipient) {
          const error = new Error('Укажи тестового получателя или услугу');
          error.status = 400;
          throw error;
        }
        const account = current.accounts.find(item => item.id === accountId);
        if (!account) {
          const error = new Error('Демо-счёт не найден');
          error.status = 404;
          throw error;
        }
        if (type !== 'topup' && account.balance < amount) {
          const error = new Error('Недостаточно средств на демо-счёте');
          error.status = 400;
          throw error;
        }
        const now = new Date();
        const time = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(now);
        const entry = type === 'topup'
          ? { title: 'Тестовое пополнение', detail: 'Виртуальные средства', amount, category: 'Пополнение', kind: 'income' }
          : type === 'transfer'
            ? { title: 'Демо-перевод', detail: 'Тестовая операция · ' + recipient, amount: -amount, category: 'Переводы', kind: 'transfer' }
            : { title: recipient, detail: 'Демо-платёж', amount: -amount, category: 'Платежи', kind: 'expense' };
        account.balance += type === 'topup' ? amount : -amount;
        current.transactions.unshift({
          id: Date.now() + Math.floor(Math.random() * 1000),
          ...entry,
          date: 'Сегодня, ' + time,
        });
        current.transactions = current.transactions.slice(0, 200);
        await saveState(current);
        return current;
      });
      return send(response, 200, state);
    }
    return send(response, 404, { error: 'Маршрут не найден' });
  } catch (error) {
    const status = Number.isInteger(error?.status) ? error.status : 400;
    return send(response, status, { error: error instanceof Error ? error.message : 'Ошибка сервера' });
  }
});

server.listen(PORT, HOST, () => {
  console.log('[north-bank] Demo API: http://' + HOST + ':' + PORT);
  console.log('[north-bank] Только локальные вымышленные данные. Реальные платежи отключены.');
});
