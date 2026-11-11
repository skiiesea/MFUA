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

test('local demo API validates and persists simulated transactions', async t => {
  const port = await freePort();
  const child = spawn(process.execPath, ['server/index.mjs'], {
    env: { ...process.env, API_PORT: String(port) },
    stdio: 'ignore',
  });
  const base = 'http://127.0.0.1:' + port;
  t.after(() => child.kill());

  let ready = false;
  for (let attempt = 0; attempt < 60; attempt += 1) {
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
  const initial = await reset.json();
  assert.equal(initial.accounts[0].balance, 284650);

  const invalid = await fetch(base + '/api/transactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId: 1, type: 'transfer', amount: 0, recipient: 'Тест' }),
  });
  assert.equal(invalid.status, 400);

  const transfer = await fetch(base + '/api/transactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId: 1, type: 'transfer', amount: 500, recipient: 'Тестовый получатель' }),
  });
  assert.equal(transfer.status, 200);
  const afterTransfer = await transfer.json();
  assert.equal(afterTransfer.accounts[0].balance, 284150);
  assert.equal(afterTransfer.transactions[0].amount, -500);

  const overspend = await fetch(base + '/api/transactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId: 1, type: 'payment', amount: 999999, recipient: 'Тест' }),
  });
  assert.equal(overspend.status, 400);

  const persisted = await fetch(base + '/api/state');
  const saved = await persisted.json();
  assert.equal(saved.accounts[0].balance, 284150);
  assert.equal(saved.transactions[0].title, 'Демо-перевод');

  const finalReset = await fetch(base + '/api/reset', { method: 'POST' });
  assert.equal(finalReset.status, 200);
});
