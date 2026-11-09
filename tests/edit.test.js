// tests/edit.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import {
  ensureCategoryTable,
  setCategory,
  UnknownCategoryError,
  TransactionNotFoundError,
} from '../src/lib/edit.js';

function freshDb() {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE IF NOT EXISTS transactions (id INTEGER PRIMARY KEY, date TEXT, description TEXT, cents INTEGER)');
  return db;
}

function insertRow(db) {
  const result = db.prepare('INSERT INTO transactions (date, description, cents) VALUES (?, ?, ?)')
    .run('2026-10-14', 'Greenbarrow Fresh', -1250);
  return Number(result.lastInsertRowid);
}

function storedCategories(db) {
  return db.prepare('SELECT transaction_id, category FROM manual_categories ORDER BY transaction_id').all()
    .map((row) => ({ ...row }));
}

test('setCategory stores a valid key and returns the row\'s date', () => {
  const db = freshDb();
  const id = insertRow(db);
  ensureCategoryTable(db);
  assert.deepEqual(setCategory(db, id, 'eating_out'), { date: '2026-10-14' });
  assert.deepEqual(storedCategories(db), [{ transaction_id: id, category: 'eating_out' }]);
});

test('setCategory replaces an earlier key for the same transaction', () => {
  const db = freshDb();
  const id = insertRow(db);
  ensureCategoryTable(db);
  setCategory(db, id, 'eating_out');
  setCategory(db, id, 'groceries');
  assert.deepEqual(storedCategories(db), [{ transaction_id: id, category: 'groceries' }]);
});

test('setCategory refuses an unknown key and stores nothing', () => {
  const db = freshDb();
  const id = insertRow(db);
  ensureCategoryTable(db);
  assert.throws(() => setCategory(db, id, 'nope'), UnknownCategoryError);
  assert.equal(storedCategories(db).length, 0);
});

test('setCategory refuses a key in the wrong case', () => {
  const db = freshDb();
  const id = insertRow(db);
  ensureCategoryTable(db);
  assert.throws(() => setCategory(db, id, 'Groceries'), UnknownCategoryError);
  assert.equal(storedCategories(db).length, 0);
});

test('setCategory refuses an id that is not stored', () => {
  const db = freshDb();
  insertRow(db);
  ensureCategoryTable(db);
  assert.throws(() => setCategory(db, 999, 'groceries'), TransactionNotFoundError);
  assert.equal(storedCategories(db).length, 0);
});

test('ensureCategoryTable is safe to call twice', () => {
  const db = freshDb();
  ensureCategoryTable(db);
  assert.doesNotThrow(() => ensureCategoryTable(db));
});
