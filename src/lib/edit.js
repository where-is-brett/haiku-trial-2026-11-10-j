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

// Creates the manual_categories table when it is not there yet. Each row holds the
// category a person chose for one transaction; transactions itself is left alone.
export function ensureCategoryTable(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS manual_categories (
    transaction_id INTEGER PRIMARY KEY REFERENCES transactions(id),
    category TEXT NOT NULL
  )`);
}

// Stores a category key for a transaction and returns that transaction's date.
export function setCategory(db, id, key) {
  if (!Object.hasOwn(labels, key)) throw new UnknownCategoryError(key);
  const row = db.prepare('SELECT date FROM transactions WHERE id = ?').get(id);
  if (row === undefined) throw new TransactionNotFoundError(id);
  db.prepare(
    'INSERT INTO manual_categories (transaction_id, category) VALUES (?, ?) ON CONFLICT(transaction_id) DO UPDATE SET category = excluded.category'
  ).run(id, key);
  return { date: row.date };
}
