import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';

async function freePort() {
  const probe = createServer();
  await new Promise((resolve, reject) => {
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', resolve);
  });
  const address = probe.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  await new Promise(resolve => probe.close(resolve));
  return port;
}

test('North Bank local API covers demo modules and persists state', async t => {
  const port = await freePort();
  const child = spawn(process.execPath, ['server/index.mjs'], {
    env: { ...process.env, API_PORT: String(port) },
    stdio: 'ignore',
  });
  const base = 'http://127.0.0.1:' + port;
  t.after(() => child.kill());

  let ready = false;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (child.exitCode !== null) throw new Error('Demo API exited before becoming ready');
    try {
      const response = await fetch(base + '/api/health');
      if (response.ok) { ready = true; break; }
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.equal(ready, true, 'Demo API should start');

  const reset = await fetch(base + '/api/reset', { method: 'POST' });
  assert.equal(reset.status, 200);
  let state = await reset.json();
  assert.equal(state.accounts.length, 2);
  assert.equal(state.cards.length, 2);
  assert.equal(state.goals.length, 2);

  const invalid = await fetch(base + '/api/transactions', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId: 1, type: 'transfer', amount: 0, recipient: 'Тест' }),
  });
  assert.equal(invalid.status, 400);

  const transfer = await fetch(base + '/api/transactions', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId: 1, type: 'transfer', amount: 500, recipient: 'Тестовый получатель' }),
  });
  assert.equal(transfer.status, 200);
  state = await transfer.json();
  assert.equal(state.accounts[0].balance, 284150);
  assert.equal(state.transactions[0].amount, -500);

  const internal = await fetch(base + '/api/transactions', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId: 1, targetAccountId: 2, type: 'internal', amount: 1000 }),
  });
  assert.equal(internal.status, 200);
  state = await internal.json();
  assert.equal(state.accounts[0].balance, 283150);
  assert.equal(state.accounts[1].balance, 126000);

  const accountCreate = await fetch(base + '/api/accounts', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'На путешествие', type: 'savings' }),
  });
  assert.equal(accountCreate.status, 201);
  state = await accountCreate.json();
  const newAccount = state.accounts.find(item => item.name === 'На путешествие');
  assert.ok(newAccount);
  assert.equal(newAccount.balance, 0);

  const accountRename = await fetch(base + '/api/accounts/' + newAccount.id, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Путешествие' }),
  });
  assert.equal(accountRename.status, 200);
  state = await accountRename.json();
  assert.ok(state.accounts.some(item => item.name === 'Путешествие'));

  const cardCreate = await fetch(base + '/api/cards', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Карта путешествий', accountId: 1 }),
  });
  assert.equal(cardCreate.status, 201);
  state = await cardCreate.json();
  assert.ok(state.cards.some(item => item.name === 'Карта путешествий' && item.accountId === 1));

  const cardToggle = await fetch(base + '/api/cards/1/toggle', { method: 'POST' });
  assert.equal(cardToggle.status, 200);
  state = await cardToggle.json();
  assert.equal(state.cards[0].status, 'frozen');

  const goalCreate = await fetch(base + '/api/goals', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Камера', target: 50000, deadline: '2027-05-01' }),
  });
  assert.equal(goalCreate.status, 201);
  state = await goalCreate.json();
  const goal = state.goals.find(item => item.title === 'Камера');
  assert.ok(goal);

  const contribution = await fetch(base + '/api/goals/' + goal.id + '/contribute', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId: 1, amount: 2500 }),
  });
  assert.equal(contribution.status, 200);
  state = await contribution.json();
  assert.equal(state.goals.find(item => item.id === goal.id).current, 2500);

  const notificationId = state.notifications[0].id;
  const markRead = await fetch(base + '/api/notifications/' + notificationId + '/read', { method: 'POST' });
  assert.equal(markRead.status, 200);
  state = await markRead.json();
  assert.equal(state.notifications.find(item => item.id === notificationId).read, true);

  const profile = await fetch(base + '/api/profile', {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Демо Александр', theme: 'light', notificationsEnabled: false }),
  });
  assert.equal(profile.status, 200);
  state = await profile.json();
  assert.equal(state.profile.name, 'Демо Александр');
  assert.equal(state.profile.theme, 'light');
  assert.equal(state.profile.notificationsEnabled, false);

  const support = await fetch(base + '/api/support', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subject: 'Проверка', message: 'Тестовое сообщение поддержки' }),
  });
  assert.equal(support.status, 201);
  state = await support.json();
  assert.equal(state.supportTickets[0].status, 'Открыто');

  const admin = await fetch(base + '/api/admin/summary');
  assert.equal(admin.status, 200);
  const adminData = await admin.json();
  assert.ok(adminData.summary.accounts >= 3);
  assert.ok(adminData.audit.length > 0);
  assert.equal(adminData.tickets.length, 1);

  const overspend = await fetch(base + '/api/transactions', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId: 1, type: 'payment', amount: 999999, recipient: 'Тест' }),
  });
  assert.equal(overspend.status, 400);

  const persisted = await fetch(base + '/api/state');
  const saved = await persisted.json();
  assert.equal(saved.profile.theme, 'light');
  assert.ok(saved.audit.length >= 5);
  assert.equal(saved.supportTickets.length, 1);

  const finalReset = await fetch(base + '/api/reset', { method: 'POST' });
  assert.equal(finalReset.status, 200);
  const fresh = await finalReset.json();
  assert.equal(fresh.accounts.length, 2);
  assert.equal(fresh.supportTickets.length, 0);
});
