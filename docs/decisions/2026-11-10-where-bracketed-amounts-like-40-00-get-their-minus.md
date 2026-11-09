<!-- docs/decisions/2026-11-10-where-bracketed-amounts-like-40-00-get-their-minus.md -->
# Where bracketed amounts like (40.00) get their minus sign

- **Date:** 10 November 2026
- **Piece:** statement-import
- **Options:** A. Bracket handling stays in the import step; money.js is not changed (recommended) (Small: one function in the import step, nothing else changes; Can be undone) · B. parseAmount itself reads brackets as negative, for every caller (Small now, but any later reader of amounts gets the new reading too; Can be partly undone)
- **Recommended:** import
- **Chosen:** import
- **The director's words:** none
