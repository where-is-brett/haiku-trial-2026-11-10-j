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
