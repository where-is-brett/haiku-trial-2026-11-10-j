<!-- docs/decisions/2026-11-10-a-size-limit-on-statement-uploads.md -->
# A size limit on statement uploads

- **Date:** 10 November 2026
- **Piece:** statement-import
- **Options:** A. Refuse uploads over a fixed size with a plain error (recommended) (Small: one check on the upload size; a statement over the cap is refused until the cap is raised; Can be undone) · B. Keep no limit, as the app is only run on the director's own machine (None now; an oversized upload can crash the app; Can be undone)
- **Recommended:** cap
- **Chosen:** cap
- **The director's words:** none
