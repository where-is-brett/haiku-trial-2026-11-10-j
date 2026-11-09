<!-- docs/decisions/2026-11-10-where-a-manual-category-is-stored-on-a-transaction.md -->
# Where a manual category is stored on a transaction

- **Date:** 10 November 2026
- **Piece:** edit-transaction-category
- **Options:** A. Add a nullable category column to the transactions table, added only when missing and only with the flag on (Small: one schema change, applied only with the flag on; Can be partly undone) · B. Keep categories in a separate table keyed by transaction id (More code: every month page needs a join; Can be undone)
- **Recommended:** column
- **Chosen:** table
- **The director's words:** none
