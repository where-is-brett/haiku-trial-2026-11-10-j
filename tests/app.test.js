// tests/app.test.js
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { openLedger } from '../src/lib/ledger.js';
import { createApp } from '../src/app.js';

let server;

afterEach(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
    server = undefined;
  }
});

async function start(options) {
  server = createApp({ db: openLedger(':memory:'), ...options });
  await new Promise((resolve) => server.listen(0, resolve));
  return `http://localhost:${server.address().port}`;
}

test('the home page says nothing is imported yet', async () => {
  const base = await start({ statementImport: false });
  const res = await fetch(`${base}/`);
  assert.equal(res.status, 200);
  assert.match(await res.text(), /Nothing imported yet/);
});

test('/import is a 404 when the statement import flag is off', async () => {
  const base = await start({ statementImport: false });
  const res = await fetch(`${base}/import`);
  assert.equal(res.status, 404);
  assert.equal(await res.text(), 'Not found');
});
