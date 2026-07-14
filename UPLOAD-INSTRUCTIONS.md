# Upload instructions

Upload or replace these repository files:

1. `app-parts/29.js` — new
2. `app-loader.js` — replace
3. `README.md` — replace
4. `scripts/check-bundle.mjs` — replace
5. `scripts/check-architecture-review.mjs` — new

No change is required to `index.html` or `styles.css` in this package.
`app-parts/29.js` injects the new review controls and their CSS at runtime. This
keeps the update isolated and avoids copying large current files.

After uploading, run:

```bash
node scripts/check-bundle.mjs
node scripts/check-architecture-review.mjs
```

Then test in the browser:

1. Open a ZIP containing measured JSON and a basemap.
2. Apply scale.
3. Confirm that wall and opening coordinates do not change immediately.
4. Confirm that the review panel shows Current JSON and Basemap candidate.
5. Select Keep JSON and verify no project geometry changes.
6. Select Apply suggestion and verify only that target changes.
7. Confirm architecture with unresolved suggestions and verify the warning.
8. Reopen the project and test Use JSON only.
