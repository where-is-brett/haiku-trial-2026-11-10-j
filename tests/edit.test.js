// tests/edit.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import {
  ensureCategoryColumn,
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

function categoryOf(db, id) {
  return db.prepare('SELECT category FROM transactions WHERE id = ?').get(id).category;
}

test('setCategory stores a valid key and returns the row\'s date', () => {
  const db = freshDb();
  const id = insertRow(db);
  ensureCategoryColumn(db);
  assert.deepEqual(setCategory(db, id, 'eating_out'), { date: '2026-10-14' });
  assert.equal(categoryOf(db, id), 'eating_out');
});

test('setCategory refuses an unknown key and stores nothing', () => {
  const db = freshDb();
  const id = insertRow(db);
  ensureCategoryColumn(db);
  assert.throws(() => setCategory(db, id, 'nope'), UnknownCategoryError);
  assert.equal(categoryOf(db, id), null);
});

test('setCategory refuses a key in the wrong case', () => {
  const db = freshDb();
  const id = insertRow(db);
  ensureCategoryColumn(db);
  assert.throws(() => setCategory(db, id, 'Groceries'), UnknownCategoryError);
});

test('setCategory refuses an id that is not stored', () => {
  const db = freshDb();
  insertRow(db);
  ensureCategoryColumn(db);
  assert.throws(() => setCategory(db, 999, 'groceries'), TransactionNotFoundError);
});

test('ensureCategoryColumn adds the column once and is safe to call twice', () => {
  const db = freshDb();
  ensureCategoryColumn(db);
  ensureCategoryColumn(db);
  const columns = db.prepare('PRAGMA table_info(transactions)').all();
  assert.equal(columns.filter((column) => column.name === 'category').length, 1);
});
