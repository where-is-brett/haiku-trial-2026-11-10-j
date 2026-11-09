<!-- docs/decisions/2026-11-10-what-to-do-with-a-statement-whose-quote-marks-do-n.md -->
# What to do with a statement whose quote marks do not parse cleanly

- **Date:** 10 November 2026
- **Piece:** statement-import
- **Options:** A. Refuse any statement whose quote marks do not parse cleanly, with the plain error (recommended) (Small: a stricter reader; a statement with an odd quote is refused until the export is fixed; Can be undone) · B. Keep the current reading; a stray quote can still merge rows (None now; a broken export can store one merged row with a wrong amount; Can be undone)
- **Recommended:** refuse
- **Chosen:** refuse
- **The director's words:** none
