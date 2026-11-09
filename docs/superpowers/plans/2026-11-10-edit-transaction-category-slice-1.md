# Edit a transaction's category Implementation Plan (slice 1 of 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The edit page shows one transaction and a category form; saving stores the chosen category and returns to that transaction's month.

**Architecture:** A small `src/lib/edit.js` module holds the save and the lookup, so the route stays thin. The `/edit` routes are added to the app `createApp` builds, behind the flag `EDIT_TRANSACTION_CATEGORY`.

**Tech Stack:** Node 22.13+ built-ins only (`node:sqlite`, `node:http`, `node:test`). No new dependencies.

**Spec:** `.wheelhouse/feature/approved.md` (read it whole; this plan does not restate it).

**Depends on:** statement-import, PR #5 (branch `feature/statement-import`, head `7640b38`), not yet merged. This slice builds on its code: `openLedger(path)` in `src/lib/ledger.js`, `createApp({ db, statementImport })` in `src/app.js`, and `importStatement(db, text)` in `src/lib/import.js`. Do not start building until that pull request has merged.

**Open director question (data-model):** where the category is stored. This plan builds the recommendation: a nullable `category TEXT` column on `transactions`, added with `ALTER TABLE` only when it is missing, and run only when the flag is on. The column is never added to a real `ledger.db` until the director answers.

## Global Constraints

- Node 22.13 or later; no dependencies added.
- Flag `EDIT_TRANSACTION_CATEGORY`: on only when the environment value is exactly `on`. Off means `/edit` answers `404 Not found` and the schema is unchanged.
- Category keys and labels come only from `src/lib/categories.js` (`labels`); nothing else defines them.
- The redirect is `303` to `/month?m=YYYY-MM`, where `YYYY-MM` is `substr(date, 1, 7)` of the saved row.
- Error bodies are plain text, `content-type: text/plain; charset=utf-8`.

## Review Focus

1. A category key in the wrong case or with spaces (`Groceries`, ` groceries`) is refused, not normalised. Test in Task 3.
2. A missing, empty or non-numeric `id`, or an id that is not stored, gets a plain error and writes nothing. Test in Task 3.
3. The redirect month comes from the saved row's date, not today's date. Test in Task 3.
4. A re-import of a statement that already holds a manually set category keeps that category. Test in Task 4.
5. A description containing HTML characters is shown escaped on the edit page. Test in Task 2.

---

### Task 1: Store a category on a transaction

**Files:**
- Create: `src/lib/edit.js`, `tests/edit.test.js`

**Interfaces:**
- Consumes: `openLedger(path)` from `src/lib/ledger.js` (tests only); `labels` from `src/lib/categories.js`.
- Produces: `ensureCategoryColumn(db: DatabaseSync): void` and `setCategory(db: DatabaseSync, id: number, key: string): { date: string }` in `src/lib/edit.js`. `setCategory` throws `UnknownCategoryError` when `key` is not a key of `labels`, and `TransactionNotFoundError` when no row has `id`. A thrown error writes nothing.

- [ ] **Step 1: Write the failing tests**

In `tests/edit.test.js`, using `openLedger(':memory:')` and one inserted row (`2026-10-14`, `'Greenbarrow Fresh'`, `-1250`):

- `setCategory stores a valid key and returns the row's date`: `setCategory(db, id, 'eating_out')` returns `{ date: '2026-10-14' }`; the row's `category` is `'eating_out'`.
- `setCategory refuses an unknown key and stores nothing`: `setCategory(db, id, 'nope')` throws `UnknownCategoryError`; the row's `category` is still `null`.
- `setCategory refuses a key in the wrong case`: `setCategory(db, id, 'Groceries')` throws `UnknownCategoryError`.
- `setCategory refuses an id that is not stored`: `setCategory(db, 999, 'groceries')` throws `TransactionNotFoundError`.

- [ ] **Step 2: Run them and see them fail**

Run: `node --test tests/edit.test.js`
Expected: FAIL, module not found `src/lib/edit.js`

- [ ] **Step 3: Implement `ensureCategoryColumn` and `setCategory`**

`ensureCategoryColumn` reads `PRAGMA table_info(transactions)` and runs `ALTER TABLE transactions ADD COLUMN category TEXT` only when there is no `category` column. `setCategory` checks `Object.hasOwn(labels, key)` before any write, then runs one `UPDATE ... WHERE id = ?`, and reads the row's date with a `SELECT`.

- [ ] **Step 4: Run them and see them pass**

Run: `node --test tests/edit.test.js`
Expected: PASS, 4 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/edit.js tests/edit.test.js
git commit -m "feat: store a category on a transaction"
```

---

### Task 2: Show the edit page

**Files:**
- Modify: `src/app.js` (add the `GET /edit` route and the `editTransactionCategory` option)
- Create: `tests/edit-page.test.js`

**Interfaces:**
- Consumes: `ensureCategoryColumn` from Task 1; `labels` from `src/lib/categories.js`; `createApp({ db, statementImport })` from `src/app.js`.
- Produces: `findTransaction(db, id): { id, date, description, cents, category } | undefined` in `src/lib/edit.js`; and `createApp({ db, statementImport, editTransactionCategory })`. `editTransactionCategory` is a boolean; `src/server.js` passes `process.env.EDIT_TRANSACTION_CATEGORY === 'on'`. When it is true, `createApp` calls `ensureCategoryColumn(db)` before serving.

- [ ] **Step 1: Write the failing tests**

In `tests/edit-page.test.js`, start the app on an in-memory ledger with one row (id 1) and check the HTTP response:

- `GET /edit?id=1 shows the category label`: status `200`; body contains `Category`.
- `GET /edit?id=1 shows the transaction read-only`: body contains the date, description and amount.
- `GET /edit?id=1 escapes the description`: a row with description `<b>Shop & Co</b>` shows `&lt;b&gt;Shop &amp; Co&lt;/b&gt;` and no raw `<b>`.
- `GET /edit with the flag off is 404`: `createApp` with `editTransactionCategory: false`; status `404`.

- [ ] **Step 2: Run them and see them fail**

Run: `node --test tests/edit-page.test.js`
Expected: FAIL, status 404 for `/edit?id=1`

- [ ] **Step 3: Implement the `GET /edit` route**

With the flag on, `GET /edit?id=N` parses `N` as an integer, calls `findTransaction`, and renders a form. The form has a hidden `id`, a `<select name="category">` with one `<option>` per key of `labels` (value = key, text = label), and a submit button. Escape every stored value before it is placed in HTML. A missing or unknown id renders the plain error `Transaction not found` with status 404. Follow the markup of the existing `page()` helper in `src/app.js`; styling is left to the builder.

- [ ] **Step 4: Run them and see them pass**

Run: `node --test tests/edit-page.test.js`
Expected: PASS, 4 tests

- [ ] **Step 5: Commit**

```bash
git add src/app.js src/lib/edit.js tests/edit-page.test.js
git commit -m "feat: show the edit page for a transaction"
```

---

### Task 3: Save the category from the form

**Files:**
- Modify: `src/app.js` (add the `POST /edit` route)
- Modify: `tests/edit-page.test.js` (add the save tests)

**Interfaces:**
- Consumes: `setCategory`, `UnknownCategoryError`, `TransactionNotFoundError` from `src/lib/edit.js` (Task 1).
- Produces: none for later tasks.

- [ ] **Step 1: Write the failing tests**

Post `application/x-www-form-urlencoded` bodies to `/edit` (`id`, `category`):

- `a valid save redirects to the transaction's month`: row dated `2026-10-14`, body `id=1&category=eating_out`; status `303`; `location` is `/month?m=2026-10`; the stored category is `eating_out`.
- `an unknown key is refused and stores nothing`: body `id=1&category=nope`; status `400`; body is plain text naming the problem; the stored category is still `null`.
- `a missing category is refused`: body `id=1`; status `400`; nothing stored.
- `a wrong-case key is refused`: body `id=1&category=Groceries`; status `400`; nothing stored.
- `a missing or non-numeric id is refused`: body `category=groceries` and body `id=abc&category=groceries`; status `400`; nothing stored.
- `an id that is not stored is refused`: body `id=999&category=groceries`; status `404`.

- [ ] **Step 2: Run them and see them fail**

Run: `node --test tests/edit-page.test.js`
Expected: FAIL, status 404 for `POST /edit`

- [ ] **Step 3: Implement the `POST /edit` route**

Read the form body with the request-reading helper the statement-import upload already uses (built-in `Request` form parsing; no dependency). Parse `id` with `Number`, reject it unless it is a positive integer. Call `setCategory`. Map `UnknownCategoryError` and bad-id to `400`, `TransactionNotFoundError` to `404`, each with a plain text body. On success respond `303` with `location: /month?m=${date.slice(0, 7)}`.

- [ ] **Step 4: Run them and see them pass**

Run: `node --test tests/edit-page.test.js tests/edit.test.js`
Expected: PASS, all tests

- [ ] **Step 5: Commit**

```bash
git add src/app.js tests/edit-page.test.js
git commit -m "feat: save a transaction's category and return to its month"
```

---

### Task 4: A re-import keeps the manual category

**Files:**
- Modify: `tests/edit.test.js` (add the re-import test)

**Interfaces:**
- Consumes: `importStatement(db, text)` from `src/lib/import.js` (statement-import); `setCategory` from Task 1.
- Produces: none.

The duplicate check in `importStatement` only inserts new rows and never updates an existing one, so this task should need no code change. The test pins that.

- [ ] **Step 1: Write the failing test**

- `a re-imported duplicate keeps the manually set category`: import a one-row statement (`Date,Description,Amount` / `14/10/2026,Greenbarrow Fresh,12.50`); `setCategory(db, id, 'eating_out')`; import the same statement again; the result is `{ added: 0, skipped: 1 }`; the row's `category` is still `'eating_out'`.

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/edit.test.js`
Expected: FAIL only if `importStatement` ever touches existing rows; if it passes at once, record that in the report and keep the test.

- [ ] **Step 3: Implement**

No code change expected. If the test fails, the import must be changed so that a duplicate never writes; fix that and note it in the report as a `bug-fix`.

- [ ] **Step 4: Run it and see it pass**

Run: `node --test tests/edit.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/edit.test.js
git commit -m "test: a re-imported duplicate keeps its manual category"
```

---

### Task 5: Verify the slice

- [ ] **Step 1: Run the touched tests**

Run: `node --test tests/edit.test.js tests/edit-page.test.js`
Expected: PASS, every test. Report the files that ran in the report's `tests` field.

- [ ] **Step 2: Check the flag-off path**

Run: `node --test tests/edit-page.test.js`
Expected: the flag-off test passes. A test confirms that with `editTransactionCategory: false`, `createApp` does not call `ensureCategoryColumn` and the `transactions` table has no `category` column.

- [ ] **Step 3: Done contract, slice 1**

Lines 1 to 4 of the spec's slice 1 `done` list each have a test above. Confirm each one by name in the report.
