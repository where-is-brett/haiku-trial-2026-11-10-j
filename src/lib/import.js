// src/lib/import.js
import { parseCsv } from './csv.js';
import { parseDate } from './dates.js';
import { parseAmount } from './money.js';

const NOT_A_STATEMENT = 'This file is not a bank statement. It needs the columns Date, Description and Amount.';
const DATE_PATTERN = /^\d{2}\/\d{2}\/\d{4}$/;

export class NotAStatementError extends Error {
  constructor() {
    super(NOT_A_STATEMENT);
    this.name = 'NotAStatementError';
  }
}

// The only amount forms read: an optional leading minus, or one pair of brackets with no minus inside.
// Digits may carry comma thousands groups and at most two decimal places.
const PLAIN_AMOUNT = /^-?(\d+|\d{1,3}(,\d{3})+)(\.\d{1,2})?$/;
const BRACKETED_AMOUNT = /^\((\d+|\d{1,3}(,\d{3})+)(\.\d{1,2})?\)$/;

// A bracketed amount such as (40.00) is money going back, so it reads as negative.
// Any other form is refused rather than read as a guess.
export function readAmount(text) {
  const trimmed = text.trim();
  if (BRACKETED_AMOUNT.test(trimmed)) {
    return -Math.abs(parseAmount(trimmed.slice(1, -1)));
  }
  if (PLAIN_AMOUNT.test(trimmed)) {
    return parseAmount(trimmed);
  }
  throw new NotAStatementError();
}

// A real day: month 1 to 12, and a day within that month's length, leap years included.
function isRealDate(day, month, year) {
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const lengths = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return month >= 1 && month <= 12 && day >= 1 && day <= lengths[month - 1];
}

// Reads every row of a statement. Throws NotAStatementError for any bad file, before anything is written.
export function readStatement(text) {
  let records;
  try {
    records = parseCsv(text);
  } catch {
    throw new NotAStatementError();
  }

  const [header, ...body] = records;
  if (!header || header.length !== 3 || header[0] !== 'Date' || header[1] !== 'Description' || header[2] !== 'Amount') {
    throw new NotAStatementError();
  }

  return body.map((fields) => {
    if (fields.length !== 3) throw new NotAStatementError();
    const [date, description, amount] = fields;
    if (!DATE_PATTERN.test(date)) throw new NotAStatementError();
    const [day, month, year] = date.split('/').map(Number);
    if (!isRealDate(day, month, year)) throw new NotAStatementError();
    const cents = readAmount(amount);
    if (!Number.isInteger(cents)) throw new NotAStatementError();
    return { date: parseDate(date), description, cents };
  });
}

// Adds the statement's rows that are not already stored. A row is a duplicate when the table already held
// the same date, description and cents before this call; rows within one file never count as duplicates of each other.
export function importStatement(db, text) {
  const rows = readStatement(text);
  const find = db.prepare(
    'SELECT COUNT(*) AS n FROM transactions WHERE date = ? AND description = ? AND cents = ?',
  );
  const insert = db.prepare('INSERT INTO transactions (date, description, cents) VALUES (?, ?, ?)');

  db.exec('BEGIN');
  try {
    // Check every row against the table as it was at the start, before any insert.
    const isNew = rows.map((row) => find.get(row.date, row.description, row.cents).n === 0);
    let added = 0;
    let skipped = 0;
    rows.forEach((row, i) => {
      if (isNew[i]) {
        insert.run(row.date, row.description, row.cents);
        added += 1;
      } else {
        skipped += 1;
      }
    });
    db.exec('COMMIT');
    return { added, skipped };
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
