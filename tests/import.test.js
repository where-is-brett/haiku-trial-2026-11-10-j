// tests/import.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openLedger } from '../src/lib/ledger.js';
import { importStatement, readAmount, NotAStatementError } from '../src/lib/import.js';

const HEADER = 'Date,Description,Amount\n';

function rowCount(db) {
  return db.prepare('SELECT COUNT(*) AS n FROM transactions').get().n;
}

test('import adds rows and reports Added n, skipped n', () => {
  const db = openLedger(':memory:');
  const result = importStatement(db, `${HEADER}03/08/2026,Kestrel Coffee Bar,6.50\n`);
  assert.deepEqual(result, { added: 1, skipped: 0 });
});

test('importing the same file twice adds nothing', () => {
  const db = openLedger(':memory:');
  const text = `${HEADER}03/08/2026,Kestrel Coffee Bar,6.50\n`;
  importStatement(db, text);
  const second = importStatement(db, text);
  assert.deepEqual(second, { added: 0, skipped: 1 });
  assert.equal(rowCount(db), 1);
});

test('a file without the Date, Description, Amount header adds nothing and shows a plain error', () => {
  const db = openLedger(':memory:');
  assert.throws(
    () => importStatement(db, 'Day,Payee,Sum\n03/08/2026,Kestrel,6.50\n'),
    NotAStatementError,
  );
  assert.equal(rowCount(db), 0);
});

test('brackets and minus signs are read as money coming back', () => {
  assert.equal(readAmount('(40.00)'), -4000);
  assert.equal(readAmount('-2100.00'), -210000);
  assert.equal(readAmount('(1,234.50)'), -123450);
});

test('a bracketed amount with a minus inside is still money coming back', () => {
  assert.equal(readAmount('(-40.00)'), -4000);
});

test('a plain amount is read as positive cents', () => {
  assert.equal(readAmount('40.00'), 4000);
});

test('identical rows within one statement are both added', () => {
  const db = openLedger(':memory:');
  const text = `${HEADER}07/08/2026,Kestrel Coffee Bar,6.50\n07/08/2026,Kestrel Coffee Bar,6.50\n`;
  assert.deepEqual(importStatement(db, text), { added: 2, skipped: 0 });
  assert.equal(rowCount(db), 2);
});

test('a file with one bad row adds nothing', () => {
  const db = openLedger(':memory:');
  const text = `${HEADER}03/08/2026,Kestrel,6.50\n2026-08-04,Bad,1\n`;
  assert.throws(() => importStatement(db, text), NotAStatementError);
  assert.equal(rowCount(db), 0);
});

test('an unterminated quote is a plain error, adds nothing', () => {
  const db = openLedger(':memory:');
  const text = `${HEADER}03/08/2026,"Kestrel,6.50\n`;
  assert.throws(() => importStatement(db, text), NotAStatementError);
  assert.equal(rowCount(db), 0);
});
