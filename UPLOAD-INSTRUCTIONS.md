# Upload instructions

Deploy the repository as a unit so the loader, calibration logic, styles, schema
and Planner GPT files remain in sync.

After uploading, run:

```bash
node scripts/check-bundle.mjs
node scripts/check-architecture-review.mjs
node scripts/check-basemap-scale.mjs
node scripts/check-camera-composition.mjs
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
9. Reopen the ZIP, adjust the ruler and apply scale again.
10. Confirm the basemap retains its previously visible crop and no portion of the
    image disappears unless **Auto-fit drawing β** is selected explicitly.
11. Import a Planner V3 project containing exactly 12 valid camera candidates.
12. Run **Rank 12 → Keep best 8** and confirm exactly eight ranked shots remain.
13. Step through all eight shots and confirm each restores its own wall and
    furniture hide distances.
14. Export camera + depth and confirm the ZIP contains eight aligned image pairs
    plus composition rank, score and visibility metadata in `camera-shots.json`.
