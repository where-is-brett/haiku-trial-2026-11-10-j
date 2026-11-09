// tests/categories.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rules, labels } from '../src/lib/categories.js';

test('every category key has a label', () => {
  for (const key of ['groceries', 'eating_out', 'transport', 'bills', 'shopping', 'health', 'income', 'other']) {
    assert.ok(labels[key], `missing label for ${key}`);
  }
  assert.equal(labels.eating_out, 'Eating out');
});

test('the rules list every shop from the spec', () => {
  assert.equal(rules.length, 27);
});
