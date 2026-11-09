// tests/import-page.test.js
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

async function start(db, statementImport = true) {
  server = createApp({ db, statementImport });
  await new Promise((resolve) => server.listen(0, resolve));
  return `http://localhost:${server.address().port}`;
}

function statementForm(text) {
  const form = new FormData();
  form.append('statement', new Blob([text], { type: 'text/csv' }), 'statement.csv');
  return form;
}

const GOOD_STATEMENT = [
  'Date,Description,Amount',
  '03/01/2026,Corner shop,-4.50',
  '04/01/2026,Salary,1500.00',
  '05/01/2026,Bus pass,(40.00)',
].join('\n');

function countRows(db) {
  return db.prepare('SELECT COUNT(*) AS n FROM transactions').get().n;
}

test('/import page must show statement', async () => {
  const db = openLedger(':memory:');
  const base = await start(db);
  const res = await fetch(`${base}/import`);
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /statement/);
  assert.match(html, /<form[^>]*method="post"/);
  assert.match(html, /enctype="multipart\/form-data"/);
  assert.match(html, /<input type="file" name="statement" accept="\.csv">/);
  assert.match(html, /Bank statement \(CSV\)/);
});

test('posting a statement reports Added n, skipped n', async () => {
  const db = openLedger(':memory:');
  const base = await start(db);
  const res = await fetch(`${base}/import`, { method: 'POST', body: statementForm(GOOD_STATEMENT) });
  assert.equal(res.status, 200);
  assert.match(await res.text(), /Added 3, skipped 0/);
  assert.equal(countRows(db), 3);
});

test('posting the same statement again reports skipped', async () => {
  const db = openLedger(':memory:');
  const base = await start(db);
  await fetch(`${base}/import`, { method: 'POST', body: statementForm(GOOD_STATEMENT) });
  const res = await fetch(`${base}/import`, { method: 'POST', body: statementForm(GOOD_STATEMENT) });
  assert.equal(res.status, 200);
  assert.match(await res.text(), /Added 0, skipped 3/);
  assert.equal(countRows(db), 3);
});

test('posting a file without the header shows a plain error and adds nothing', async () => {
  const db = openLedger(':memory:');
  const base = await start(db);
  const bad = 'Day,Payee,Total\n03/01/2026,Corner shop,-4.50\n';
  const res = await fetch(`${base}/import`, { method: 'POST', body: statementForm(bad) });
  assert.equal(res.status, 400);
  assert.match(await res.text(), /This file is not a bank statement/);
  assert.equal(countRows(db), 0);
});

test('with the flag off, /import is a 404 for GET and POST', async () => {
  const db = openLedger(':memory:');
  const base = await start(db, false);
  const get = await fetch(`${base}/import`);
  assert.equal(get.status, 404);
  assert.equal(await get.text(), 'Not found');
  const post = await fetch(`${base}/import`, { method: 'POST', body: statementForm(GOOD_STATEMENT) });
  assert.equal(post.status, 404);
  assert.equal(await post.text(), 'Not found');
  assert.equal(countRows(db), 0);
});

const CAP = 1048576;
const TOO_LARGE = 'This file is too large to import. The limit is 1 MB.';

// A statement of exactly `bytes` bytes: a valid header, then rows with
// distinct descriptions, the last row padded out to the size.
function statementOfBytes(bytes, rowCount = 200) {
  const lines = ['Date,Description,Amount'];
  for (let i = 1; i < rowCount; i++) lines.push(`03/01/2026,Shop ${i},-4.50`);
  const fixed = lines.join('\n') + '\n';
  const last = '03/01/2026,Shop ,-4.50';
  const pad = bytes - fixed.length - last.length;
  return fixed + `03/01/2026,Shop ${'x'.repeat(pad)},-4.50`;
}

test('an upload over 1 MB is refused with a plain error and adds nothing', async () => {
  const db = openLedger(':memory:');
  const base = await start(db);
  const res = await fetch(`${base}/import`, { method: 'POST', body: statementForm(statementOfBytes(CAP + 1)) });
  assert.equal(res.status, 413);
  assert.match(res.headers.get('content-type'), /^text\/plain/);
  assert.equal(await res.text(), TOO_LARGE);
  assert.equal(countRows(db), 0);
});

test('an upload at the 1 MB cap is still imported', async () => {
  const db = openLedger(':memory:');
  const base = await start(db);
  // Leave room in the cap for the multipart headers and boundaries.
  const res = await fetch(`${base}/import`, {
    method: 'POST',
    body: statementForm(statementOfBytes(CAP - 1024)),
  });
  assert.equal(res.status, 200);
  assert.match(await res.text(), /Added 200, skipped 0/);
  assert.equal(countRows(db), 200);
});

test('a chunked upload over 1 MB is refused too', async () => {
  const db = openLedger(':memory:');
  const base = await start(db);
  const boundary = 'statementboundary';
  const head = `--${boundary}\r\nContent-Disposition: form-data; name="statement"; filename="statement.csv"\r\nContent-Type: text/csv\r\n\r\n`;
  const tail = `\r\n--${boundary}--\r\n`;
  const bytes = new TextEncoder().encode(head + statementOfBytes(CAP + 1) + tail);
  const stream = new ReadableStream({
    start(controller) {
      for (let offset = 0; offset < bytes.length; offset += 65536) {
        controller.enqueue(bytes.subarray(offset, offset + 65536));
      }
      controller.close();
    },
  });
  const res = await fetch(`${base}/import`, {
    method: 'POST',
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
    body: stream,
    duplex: 'half',
  });
  assert.equal(res.status, 413);
  assert.equal(await res.text(), TOO_LARGE);
  assert.equal(countRows(db), 0);
});
