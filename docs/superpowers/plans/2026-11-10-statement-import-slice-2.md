# List months on the home page Implementation Plan

**Goal:** The home page lists each month that has transactions, newest first, each month linking to `/month?m=YYYY-MM`.

**Architecture:** A small query module returns the months with their counts. The home page renders them when the flag is on. The flag is separate from slice 1's, so each slice can be switched on on its own.

**Tech Stack:** Node 22.13+ built-ins only (`node:sqlite`, `node:http`, `node:test`). No new dependencies.

**Spec:** the director's approved design for statement import (slice 2 of 2)

## Global Constraints

- Node 22.13 or later; no dependencies added.
- Stored dates are ISO `YYYY-MM-DD` (written by `parseDate`). A month is `substr(date, 1, 7)`, which gives `YYYY-MM`.
- `src/lib/dates.js`, `src/lib/money.js`, `src/lib/import.js` and `src/lib/csv.js` are not modified in this slice.
- Feature flag: `MONTH_LIST`, on only when the environment value is exactly `on`. Off means the home page is exactly as it is today.
- The existing `/` text `Nothing imported yet` and `N transactions imported` are kept.

## Review Focus

1. Months across a year boundary: 2025-12 and 2026-01 sort with 2026-01 first. Test in Task 1.
2. A month with no transactions does not appear in the list. Test in Task 1.
3. Rows from two separate imports with dates in the same month are counted as one month. Test in Task 1.
4. The link uses the two-digit month: 2026-08, not 2026-8. Test in Task 2.
5. With the flag off, the home page is unchanged. Test in Task 2.

## Interfaces

- Produces: `listMonths(db: DatabaseSync): { month: string, count: number }[]` in `src/lib/months.js`. Months newest first, only months with at least one transaction.
- Produces: `createApp({ db, statementImport, monthList })` in `src/app.js`. `monthList` is a boolean; slice 1's `statementImport` is unchanged.
- `src/server.js` reads `MONTH_LIST` and passes `monthList: process.env.MONTH_LIST === 'on'`.

---

### Task 1: Query the months

**Files:**
- Create: `src/lib/months.js`, `tests/months.test.js`

- [ ] **Step 1: Write the failing tests**

- `home lists months with transactions, newest first`: insert rows dated `2025-12-31`, `2026-01-05`, `2026-01-20`, `2026-03-02` (using `db.prepare('INSERT INTO transactions (date, description, cents) VALUES (?, ?, ?)')`); `listMonths(db)` deep-equals `[{ month: '2026-03', count: 1 }, { month: '2026-01', count: 2 }, { month: '2025-12', count: 1 }]`.
- `a month with no transactions is not listed`: a fresh `openLedger(':memory:')` with no rows; `listMonths(db)` deep-equals `[]`.
- A test that two imports in the same month are one month: insert `2026-02-03` and `2026-02-28` rows from two separate calls; the result has one `{ month: '2026-02', count: 2 }`.

- [ ] **Step 2: Run them and see them fail**

Run: `node --test tests/months.test.js`
Expected: FAIL, module not found

- [ ] **Step 3: Implement `listMonths`**

One query: `SELECT substr(date, 1, 7) AS month, COUNT(*) AS count FROM transactions GROUP BY month ORDER BY month DESC`, returned as plain objects.

- [ ] **Step 4: Run them and see them pass**

Run: `node --test tests/months.test.js`
Expected: PASS, 3 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/months.js tests/months.test.js
git commit -m "List the months that have transactions, newest first"
```

---

### Task 2: Show the months on the home page

**Files:**
- Modify: `src/app.js`, `src/server.js`
- Create: `tests/home-months.test.js`

- [ ] **Step 1: Write the failing tests**

Each test starts `createApp({ db, statementImport: false, monthList: true })` on port 0 with the same four rows as Task 1 and closes the server afterwards.

- `home lists months with transactions, newest first`: the body's order of `2026-03`, `2026-01`, `2025-12` is as listed.
- `each month links to /month?m=YYYY-MM`: the body contains `href="/month?m=2026-01"` and `href="/month?m=2025-12"`, and no `2026-1` form.
- `/ must show month`: the body contains the word `month` when the flag is on and rows exist.
- `with the flag off the home page is unchanged`: `createApp({ ..., monthList: false })` returns the `N transactions imported` text and no `/month?m=` link.

Run `node --test tests/home-months.test.js` and see them fail.

- [ ] **Step 2: Implement**

In `src/app.js`, when `monthList` is true and the ledger has rows, render a `<ul>` below the existing count line, one `<li>` per month: `<a href="/month?m=${month}">${month}</a> &mdash; ${count} transactions`. The month string comes from the database and is already `YYYY-MM`; escape it with the same escape helper as slice 1 (add one if slice 1's is not exported). In `src/server.js`, read `MONTH_LIST` and pass `monthList`.

- [ ] **Step 3: Run the tests and see them pass**

Run: `npm test`
Expected: PASS, all tests in `tests/`.

- [ ] **Step 4: Commit**

```bash
git add src/app.js src/server.js tests/home-months.test.js
git commit -m "Show the months with transactions on the home page"
```

---

## Done check for this slice

| Done line | Test |
|---|---|
| home lists months with transactions, newest first | Task 1, first test; Task 2, first test |
| each month links to /month?m=YYYY-MM | Task 2, second test |
| / must show month | Task 2, third test |
