# Upload instructions

Deploy the repository as a unit. The v2.8 workflow contract spans the loader,
`app-parts/40.js`, package export, schema/template, styles and Planner GPT files;
copying only one of those files leaves the approval and isolation rules incomplete.

After uploading, run:

```bash
node scripts/check-bundle.mjs
node scripts/check-architecture-review.mjs
node scripts/check-workflow-contract.mjs
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
9. Approve Gate 1 and confirm a spatial edit invalidates both gates.
10. Complete design metadata, style-board assets, locked shots and render specs.
11. Approve Gate 2 and export the complete Layout Studio ZIP.
12. Confirm a design or camera-shot edit invalidates Gate 2 only.
13. Export a Step 3 handoff and confirm it contains only the Layout Studio PNG,
    approved style-board assets and `render-spec.json`—never `project.json`.
