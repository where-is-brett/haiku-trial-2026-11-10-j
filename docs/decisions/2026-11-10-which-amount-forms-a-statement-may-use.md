<!-- docs/decisions/2026-11-10-which-amount-forms-a-statement-may-use.md -->
# Which amount forms a statement may use

- **Date:** 10 November 2026
- **Piece:** statement-import
- **Options:** A. Keep the strict list: plain and bracketed numbers only, and any other form refused with the plain error (None now; a statement with a sign or a bare .50 is refused until widened; Can be undone) · B. Also accept a leading pound or dollar sign, a leading plus, a leading point and a trailing point (Small change, with more forms to test; Can be undone)
- **Recommended:** strict
- **Chosen:** strict
- **The director's words:** none
