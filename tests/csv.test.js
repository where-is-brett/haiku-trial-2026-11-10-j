// tests/csv.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv } from '../src/lib/csv.js';

test('a quoted comma stays inside one field', () => {
  assert.deepEqual(parseCsv('"Smith, J",12.00'), [['Smith, J', '12.00']]);
});

test('a leading byte-order mark is ignored', () => {
  assert.deepEqual(parseCsv('﻿Date,Description,Amount')[0], ['Date', 'Description', 'Amount']);
});

test('CRLF lines and a trailing blank line add no row', () => {
  assert.deepEqual(parseCsv('a,b\r\nc,d\r\n\r\n'), [['a', 'b'], ['c', 'd']]);
});

test('a doubled quote inside quotes gives one quote', () => {
  assert.deepEqual(parseCsv('"say ""hi""",1'), [['say "hi"', '1']]);
});

test('an unterminated quoted field is refused, not swallowed', () => {
  assert.throws(() => parseCsv('a,"b\nc,d\n'), /unterminated quoted field/);
});

test('a quote inside an unquoted field is a literal character', () => {
  assert.deepEqual(parseCsv('a,Kestrel 12" pan,6.50'), [['a', 'Kestrel 12" pan', '6.50']]);
});

test('quotes inside an unquoted field are kept as they are', () => {
  assert.deepEqual(parseCsv('a,Smith "Bob" Ltd,12.00'), [['a', 'Smith "Bob" Ltd', '12.00']]);
});

test('a stray quote in one row does not swallow the rows after it', () => {
  const text = [
    'Date,Description,Amount',
    '03/08/2026,Kestrel 12" pan,6.50',
    '04/08/2026,Lowtide Grocers,8.00',
    '05/08/2026,Marlowe "Homewares,20.00',
  ].join('\n');
  const rows = parseCsv(text);
  assert.equal(rows.length, 4);
  assert.deepEqual(rows[0], ['Date', 'Description', 'Amount']);
  assert.deepEqual(rows[1], ['03/08/2026', 'Kestrel 12" pan', '6.50']);
  assert.deepEqual(rows[2], ['04/08/2026', 'Lowtide Grocers', '8.00']);
  assert.deepEqual(rows[3], ['05/08/2026', 'Marlowe "Homewares', '20.00']);
});

test('a closing quote followed by other text is refused', () => {
  assert.throws(() => parseCsv('a,"b"c,d'), /malformed quoted field/);
});

test('a closing quote followed by a comma is accepted', () => {
  assert.deepEqual(parseCsv('a,"b",c'), [['a', 'b', 'c']]);
});

test('a closing quote followed by a line break is accepted', () => {
  assert.deepEqual(parseCsv('a,"b"\nc'), [['a', 'b'], ['c']]);
});
