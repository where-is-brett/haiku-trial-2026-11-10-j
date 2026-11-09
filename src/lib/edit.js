// src/lib/edit.js
import { labels } from './categories.js';

export class UnknownCategoryError extends Error {
  constructor(key) {
    super(`Unknown category: ${key}`);
    this.name = 'UnknownCategoryError';
  }
}

export class TransactionNotFoundError extends Error {
  constructor(id) {
    super(`No transaction with id ${id}`);
    this.name = 'TransactionNotFoundError';
  }
}

// Adds the nullable category column to transactions when it is not there yet.
export function ensureCategoryColumn(db) {
  const columns = db.prepare('PRAGMA table_info(transactions)').all();
  if (!columns.some((column) => column.name === 'category')) {
    db.exec('ALTER TABLE transactions ADD COLUMN category TEXT');
  }
}

// Stores a category key on a transaction and returns that transaction's date.
export function setCategory(db, id, key) {
  if (!Object.hasOwn(labels, key)) throw new UnknownCategoryError(key);
  const row = db.prepare('SELECT date FROM transactions WHERE id = ?').get(id);
  if (row === undefined) throw new TransactionNotFoundError(id);
  db.prepare('UPDATE transactions SET category = ? WHERE id = ?').run(key, id);
  return { date: row.date };
}
