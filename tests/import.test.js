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

test('a bracketed amount with a minus inside is refused', () => {
  assert.throws(() => readAmount('(-40.00)'), NotAStatementError);
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

function storedRows(db) {
  return db.prepare('SELECT date, description, cents FROM transactions ORDER BY id').all().map((row) => ({ ...row }));
}

test('a day that does not exist in its month is refused and stores nothing', () => {
  for (const date of ['31/02/2026', '29/02/2026', '31/04/2026']) {
    const db = openLedger(':memory:');
    assert.throws(() => importStatement(db, `${HEADER}${date},Kestrel,6.50\n`), NotAStatementError, date);
    assert.equal(rowCount(db), 0);
  }
});

test('a month above 12, or a zero day and month, is refused and stores nothing', () => {
  for (const date of ['08/25/2026', '00/00/0000']) {
    const db = openLedger(':memory:');
    assert.throws(() => importStatement(db, `${HEADER}${date},Kestrel,6.50\n`), NotAStatementError, date);
    assert.equal(rowCount(db), 0);
  }
});

test('a leap day is stored as its real date', () => {
  const db = openLedger(':memory:');
  importStatement(db, `${HEADER}29/02/2028,Kestrel Coffee Bar,6.50\n`);
  assert.deepEqual(storedRows(db), [{ date: '2028-02-29', description: 'Kestrel Coffee Bar', cents: 650 }]);
});

test('an amount in a form the reader does not know is refused and stores nothing', () => {
  const amounts = ['"12,50"', '"1.234,56"', '1e5', '6.5.0', '40.00-', '£-40.00', '$(40.00)', '(40.00', '−40.00'];
  for (const amount of amounts) {
    const db = openLedger(':memory:');
    assert.throws(() => importStatement(db, `${HEADER}03/08/2026,Kestrel,${amount}\n`), NotAStatementError, amount);
    assert.equal(rowCount(db), 0);
  }
});

test('accepted amount forms are stored with their sign and cents', () => {
  const db = openLedger(':memory:');
  importStatement(
    db,
    `${HEADER}01/08/2026,Bracketed,(40.00)\n02/08/2026,Minus,-2100.00\n03/08/2026,Grouped,"1,234.50"\n04/08/2026,Grouped bracket,"(1,234.50)"\n`,
  );
  assert.deepEqual(storedRows(db), [
    { date: '2026-08-01', description: 'Bracketed', cents: -4000 },
    { date: '2026-08-02', description: 'Minus', cents: -210000 },
    { date: '2026-08-03', description: 'Grouped', cents: 123450 },
    { date: '2026-08-04', description: 'Grouped bracket', cents: -123450 },
  ]);
});
