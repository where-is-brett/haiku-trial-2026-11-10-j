// tests/money-edge.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAmount } from '../src/lib/money.js';

// These pin down what parseAmount does today, not what it should do.

test('a blank amount is read as NaN', () => {
  assert.ok(Number.isNaN(parseAmount('')));
});

test('a negative amount is read as negative cents', () => {
  assert.equal(parseAmount('-12.50'), -1250);
});

test('an amount with a thousands comma is read as cents', () => {
  assert.equal(parseAmount('1,234.56'), 123456);
});
