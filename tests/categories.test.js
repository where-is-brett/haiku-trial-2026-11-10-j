// tests/categories.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rules, labels, categoryFor } from '../src/lib/categories.js';

test('every category key has a label', () => {
  for (const key of ['groceries', 'eating_out', 'transport', 'bills', 'shopping', 'health', 'income', 'other']) {
    assert.ok(labels[key], `missing label for ${key}`);
  }
  assert.equal(labels.eating_out, 'Eating out');
});

test('the rules list every shop from the spec', () => {
  assert.equal(rules.length, 27);
});

test('each listed shop maps to its category, ignoring case', () => {
  for (const { shop, category } of rules) {
    assert.equal(categoryFor(shop), category, shop);
    assert.equal(categoryFor(shop.toUpperCase()), category, shop.toUpperCase());
    assert.equal(categoryFor(shop.toLowerCase()), category, shop.toLowerCase());
  }
});

test('a shop name with a reference suffix still matches', () => {
  assert.equal(categoryFor('Lowtide Grocers REF 4817'), 'groceries');
});

test('a description with no shop name gives other', () => {
  assert.equal(categoryFor('Unknown Trader 99'), 'other');
  assert.equal(categoryFor(''), 'other');
  assert.equal(categoryFor(null), 'other');
  assert.equal(categoryFor(undefined), 'other');
});

test('no two shop names overlap', () => {
  const names = rules.map(({ shop }) => shop.toLowerCase());
  for (const a of names) {
    for (const b of names) {
      if (a !== b) assert.equal(b.includes(a), false, `"${a}" appears inside "${b}"`);
    }
  }
});
