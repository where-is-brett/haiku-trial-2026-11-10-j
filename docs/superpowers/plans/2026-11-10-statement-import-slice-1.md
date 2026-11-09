# Import a statement from /import Implementation Plan

**Goal:** A CSV uploaded as `statement` on `/import` adds its rows, skips duplicates, and reports `Added n, skipped n`; a file that is not a statement adds nothing and gets a plain error.

**Architecture:** The server is split so that `createApp({ db, statementImport })` can be tested without listening on a port. CSV reading, statement reading and the import each get their own small module under `src/lib/`. The whole file is read and checked before any row is written, and the writes run in one SQLite transaction. The route sits behind the flag `STATEMENT_IMPORT`, which is off unless set to `on`.

**Tech Stack:** Node 22.13+ built-ins only (`node:sqlite`, `node:http`, global `Request` and `FormData`, `node:test`). No new dependencies.

**Spec:** the director's approved design for statement import (slice 1 of 2)

## Global Constraints

- Node 22.13 or later; no dependencies added (README: "has no other dependencies").
- Read `PORT` and `LEDGER_DB` from the environment; `LEDGER_DB` may be `:memory:`; do not hard-code either.
- Dates are `DD/MM/YYYY`, read with `parseDate` from `src/lib/dates.js` as it is.
- Amounts are read with `parseAmount` from `src/lib/money.js` as it is. `src/lib/money.js` and `src/lib/dates.js` are not modified in this slice.
- Header row must be exactly `Date,Description,Amount`.
- A row is a duplicate when a row stored before this import has the same date, description and cents.
- Feature flag: `STATEMENT_IMPORT`, on only when the environment value is `on`. Off means `/import` answers 404 like any unknown path.

## Review Focus

1. A description containing a comma inside double quotes, e.g. `"Smith, J",12.00`, must keep one field. Test in Task 2.
2. A statement exported with a UTF-8 byte-order mark must still match the header. Test in Task 2.
3. CRLF line endings and a trailing blank line must not add a row or break the header. Test in Task 2.
4. Two identical lines within one statement are both added on the first import, because duplicates are checked against rows stored before the import. Test in Task 3.
5. A bracketed amount with a thousands separator, `(1,234.50)`, is read as `-123450`. Test in Task 3.

## Decisions taken in this plan

- **Brackets are handled in the import code, not in `parseAmount`.** `parseAmount("(40.00)")` currently returns `4000`. `readAmount` in `src/lib/import.js` turns a bracketed amount into a negative before the call. This leaves `money.js` untouched, as the spec's constraint says. The alternative (change `parseAmount` itself) is put to the director as a question; the seam is one function, so the answer is a small change.
- The flag is read once in `server.js` from `process.env.STATEMENT_IMPORT` and passed into `createApp`; tests pass the flag directly.
- Upload uses `multipart/form-data` posted to `/import`, parsed with the built-in `Request(...).formData()`.

---

### Task 1: Split the server into an app factory, and open the ledger

**Files:**
- Create: `src/lib/ledger.js`, `src/app.js`, `tests/app.test.js`
- Modify: `src/server.js` (whole file)

**Interfaces:**
- Produces: `openLedger(path: string): DatabaseSync` in `src/lib/ledger.js`. Opens the database at `path` and creates the `transactions` table (`id INTEGER PRIMARY KEY, date TEXT, description TEXT, cents INTEGER`) if it is missing.
- Produces: `createApp({ db: DatabaseSync, statementImport: boolean }): http.Server` in `src/app.js`. Returns a server that is not yet listening. `GET /` renders the home page as it does today.

- [ ] **Step 1: Write the failing test**

```js
// tests/app.test.js
const app = createApp({ db: openLedger(':memory:'), statementImport: false });
// listen on port 0, GET /, expect 200 and text "Nothing imported yet"
// GET /import with the flag off, expect 404
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/app.test.js`
Expected: FAIL, `Cannot find module '../src/app.js'`

- [ ] **Step 3: Implement**

`openLedger` takes over the `DatabaseSync` and `CREATE TABLE` lines from `src/server.js`. `createApp` takes over the request handler. `src/server.js` reads `PORT`, `LEDGER_DB` (default `ledger.db`) and `STATEMENT_IMPORT`, calls `createApp`, and listens. The `/` page output does not change.

- [ ] **Step 4: Run it and see it pass**

Run: `node --test tests/app.test.js tests/smoke.test.js`
Expected: PASS, the 2 existing smoke tests and the 2 app tests (4 in total)

- [ ] **Step 5: Commit**

```bash
git add src/lib/ledger.js src/app.js src/server.js tests/app.test.js
git commit -m "Split the server into an app factory and a ledger opener"
```

---

### Task 2: Read a CSV file

**Files:**
- Create: `src/lib/csv.js`, `tests/csv.test.js`

**Interfaces:**
- Produces: `parseCsv(text: string): string[][]`. Strips a leading byte-order mark, splits records on `\r\n` or `\n`, skips lines that are blank after trimming, and honours double quotes (a doubled `""` inside quotes is one quote character). No trimming of field contents beyond what the header check needs.

- [ ] **Step 1: Write the failing tests**

```js
test('a quoted comma stays inside one field', () => {
  assert.deepEqual(parseCsv('"Smith, J",12.00'), [['Smith, J', '12.00']]);
});
test('a leading byte-order mark is ignored', () => {
  assert.deepEqual(parseCsv('﻿Date,Description,Amount')[0], ['Date', 'Description', 'Amount']);
});
test('CRLF lines and a trailing blank line add no row', () => {
  assert.deepEqual(parseCsv('a,b\r\nc,d\r\n\r\n'), [['a', 'b'], ['c', 'd']]);
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `node --test tests/csv.test.js`
Expected: FAIL, module not found

- [ ] **Step 3: Implement `parseCsv`**

A small character loop with an in-quotes flag is enough. No library.

- [ ] **Step 4: Run them and see them pass**

Run: `node --test tests/csv.test.js`
Expected: PASS, 3 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/csv.js tests/csv.test.js
git commit -m "Add a small CSV reader for statements"
```

---

### Task 3: Read a statement and import it

**Files:**
- Create: `src/lib/import.js`, `tests/import.test.js`

**Interfaces:**
- Consumes: `parseCsv` (Task 2), `parseDate` and `monthOf` from `src/lib/dates.js`, `parseAmount` from `src/lib/money.js`, `openLedger` (Task 1).
- Produces:
  - `class NotAStatementError extends Error`, with a plain message such as `This file is not a bank statement. It needs the columns Date, Description and Amount.`
  - `readAmount(text: string): number`. A bracketed amount, `(…)`, is negative: `-Math.abs(parseAmount(inner))`. Otherwise `parseAmount(text)`. Thousands separators are handled by `parseAmount`.
  - `readStatement(text: string): { date: string, description: string, cents: number }[]`. Checks the header row is exactly `Date`, `Description`, `Amount`; each data row has three fields; each date matches `DD/MM/YYYY` and is turned into `YYYY-MM-DD` with `parseDate`; each amount is a finite integer from `readAmount`. Throws `NotAStatementError` on any failure, so no row is kept from a bad file.
  - `importStatement(db: DatabaseSync, text: string): { added: number, skipped: number }`. Calls `readStatement` first. Then, inside `BEGIN`/`COMMIT` (`ROLLBACK` on error), it looks up each row against the rows stored before this call and inserts those that are not duplicates. Duplicates are counted as skipped.

- [ ] **Step 1: Write the failing tests**

```js
test('import adds rows and reports Added n, skipped n', () => {
  const db = openLedger(':memory:');
  assert.deepEqual(importStatement(db, 'Date,Description,Amount\n03/08/2026,Kestrel Coffee Bar,6.50\n'), { added: 1, skipped: 0 });
});
test('importing the same file twice adds nothing', () => {
  const db = openLedger(':memory:');
  const text = 'Date,Description,Amount\n03/08/2026,Kestrel Coffee Bar,6.50\n';
  importStatement(db, text);
  assert.deepEqual(importStatement(db, text), { added: 0, skipped: 1 });
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM transactions').get().n, 1);
});
test('a file without the Date, Description, Amount header adds nothing and shows a plain error', () => {
  const db = openLedger(':memory:');
  assert.throws(() => importStatement(db, 'Day,Payee,Sum\n03/08/2026,Kestrel,6.50\n'), NotAStatementError);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM transactions').get().n, 0);
});
test('brackets and minus signs are read as money coming back', () => {
  assert.equal(readAmount('(40.00)'), -4000);
  assert.equal(readAmount('-2100.00'), -210000);
  assert.equal(readAmount('(1,234.50)'), -123450);   // Review Focus 5
});
test('identical rows within one statement are both added', () => {  // Review Focus 4
  const db = openLedger(':memory:');
  assert.deepEqual(importStatement(db, 'Date,Description,Amount\n07/08/2026,Kestrel Coffee Bar,6.50\n07/08/2026,Kestrel Coffee Bar,6.50\n'), { added: 2, skipped: 0 });
});
test('a file with one bad row adds nothing', () => {
  const db = openLedger(':memory:');
  assert.throws(() => importStatement(db, 'Date,Description,Amount\n03/08/2026,Kestrel,6.50\n2026-08-04,Bad,1\n'), NotAStatementError);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM transactions').get().n, 0);
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `node --test tests/import.test.js`
Expected: FAIL, module not found

- [ ] **Step 3: Implement**

Read and validate all rows into an array first. Then one transaction: one `SELECT 1 … WHERE date = ? AND description = ? AND cents = ?` per row against the stored rows, and an `INSERT` for each row not found. Because the lookup happens before any insert of this call, identical rows inside one file are both kept (Review Focus 4). The `ROLLBACK` covers any insert error.

- [ ] **Step 4: Run them and see them pass**

Run: `node --test tests/import.test.js`
Expected: PASS, 6 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/import.js tests/import.test.js
git commit -m "Read a bank statement and import its rows without duplicates"
```

---

### Task 4: The /import page

**Files:**
- Modify: `src/app.js`
- Create: `tests/import-page.test.js`

**Interfaces:**
- Consumes: `createApp` (Task 1), `importStatement` and `NotAStatementError` (Task 3).
- Produces: routes on the app returned by `createApp`, only when `statementImport` is true:
  - `GET /import` returns 200 HTML with a form: `method="post"`, `enctype="multipart/form-data"`, one `<input type="file" name="statement" accept=".csv">`, and the text "Bank statement".
  - `POST /import` reads the body with `new Request(url, { method: 'POST', headers: req.headers, body: req, duplex: 'half' }).formData()`, takes the `statement` field and calls `importStatement`. Success: 200 with `Added n, skipped n`. A missing field or `NotAStatementError`: 400 with the error message as plain text in the page.

- [ ] **Step 1: Write the failing tests**

Each test starts `createApp({ db: openLedger(':memory:'), statementImport: true })` on port 0 and closes it afterwards.

```js
test('/import page must show statement', async () => {
  // GET /import → 200, body includes 'statement'
});
test('posting a statement reports Added n, skipped n', async () => {
  // POST multipart with field statement = the three-row CSV → body includes 'Added 3, skipped 0'
});
test('posting a file without the header shows a plain error and adds nothing', async () => {
  // POST multipart with a bad header → status 400, body includes the NotAStatementError message, count still 0
});
test('with the flag off, /import is a 404', async () => {
  // createApp({ ..., statementImport: false }) → GET /import → 404
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `node --test tests/import-page.test.js`
Expected: FAIL, `/import` answers 404 for every case

- [ ] **Step 3: Implement the two routes**

Add the routes inside the handler in `src/app.js`, guarded by `statementImport`. The page title and layout reuse the existing `page()` helper. Form text: `Bank statement (CSV)`. The success text is `Added ${added}, skipped ${skipped}`.

- [ ] **Step 4: Run them and see them pass**

Run: `node --test tests/import-page.test.js`
Expected: PASS, 4 tests

- [ ] **Step 5: Run the whole suite and the flagged app by hand**

Run: `npm test`
Expected: PASS, all tests in `tests/`. Then `STATEMENT_IMPORT=on LEDGER_DB=:memory: PORT=3999 npm start`, and `curl -s localhost:3999/import` shows the form.

- [ ] **Step 6: Commit**

```bash
git add src/app.js tests/import-page.test.js
git commit -m "Add the /import page behind the statement-import flag"
```

---

## Done check for this slice

Each line of the slice's `done` list maps to a test above:

| Done line | Test |
|---|---|
| import adds rows and reports Added n, skipped n | Task 3, first test; Task 4, POST test |
| importing the same file twice adds nothing | Task 3, second test |
| a file without the header adds nothing and shows a plain error | Task 3, third test; Task 4, bad-header test |
| brackets and minus signs are read as money coming back | Task 3, brackets test |
| /import page must show statement | Task 4, first test |
