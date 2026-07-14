# Layout Studio

A lightweight browser-based Three.js planner for reconstructing Singapore floor plans in millimetres, placing furniture and carpentry, validating physical overlaps, setting cameras and exporting views.

Structured project JSON is authoritative. Basemaps and screenshots are visual references.
During the explicit architecture-review pass, a calibrated basemap temporarily guides wall X/Y placement; confirming writes the reviewed geometry back into authoritative project data.

## Run locally

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000` in a desktop browser.

## Main workflow

1. Start blank or open a JSON/ZIP project.
2. Upload a floor-plan image.
3. Verify the automatically positioned horizontal ruler and enter the printed dimension.
4. Check the plan and correct architecture.
5. Confirm architecture to reveal and conservatively align furniture.
6. Validate, set a camera and export PNG or project files.

For a new PNG or any imported ZIP containing a basemap, the guided review is **Set scale → Correct architecture → Confirm**. Set scale searches for the longest reliable horizontal span and positions the ruler there; the user verifies its endpoints and enters the printed dimension. ZIP scale must be applied again before detection. The correction and confirmation steps replace the normal left panel and provide:

- near-top-down Bird's-eye navigation
- centred wall-band and door checking against the calibrated basemap
- **Align all walls** plus selected-wall alignment
- toggleable wall highlights
- manual wall, door and window creation
- align and delete tools
- temporary full-opacity basemap comparison
- Exit and discard, which restores the pre-review project and camera

Furniture and furniture-validation overlays remain hidden until architecture is confirmed. Automatic window insertion is intentionally omitted because generic floor-plan symbols are not reliable enough.

## Project compatibility

Layout Studio imports and exports normal ZIP files containing `project.json` at the root. Packages may also contain:

- `manifest.json`
- project notes
- a basemap under `assets/`
- reference images under `references/`

The importer also accepts:

- older `.btozip` archives
- differently named or nested project JSON
- project data wrapped in `project`, `data`, `layout` or `scene`
- one ZIP nested inside another
- standalone Layout Studio JSON

Ruler metadata and `settings.architectureReviewConfirmed` are optional, so older files remain compatible.

## Editing and validation

- Walls support body movement, endpoint editing and centre rotation.
- Ctrl/Cmd preserves a wall's angle while dragging an endpoint.
- Furniture, carpentry and decoration use millimetre fields and optional placement metadata.
- Straight carpentry resizes lengthwise; L-shaped wardrobes resize from either free end.
- Conservative alignment preserves rooms, wall intent, support relationships and grouped arrangements.
- Validation reports physical furniture/furniture, furniture/wall and furniture/fixed-shell overlaps only.
- The precision panel becomes a drawer below 900 px.

## Camera and display

- Top, Bird's-eye and Eye-level views
- 52° default perspective lens and 1300 mm default eye height
- blocking-wall hiding without deleting geometry
- Photo mode for clean screenshots
- project-name-based PNG filenames

Hidden walls remain in project data, collision checks and validation.

## Code structure

- `app-loader.js` loads `app-parts/` in a fixed order and concatenates them into one shared IIFE.
- Later modules intentionally refine earlier functions.
- `app-parts/25.js` owns architecture detection and review state.
- `app-parts/26.js` owns ruler calibration.
- `app-parts/27.js` owns review and responsive precision UI.
- `app-parts/08.js` starts the app after all overrides load.

Keep this order intact. Do not convert the project to another framework without a separate migration plan.

## Custom GPT / Claude files

Use:

- `gpt/BTO-Layout-Planner-Instructions.md`
- `gpt/BTO-Layout-Planning-Workflow.md`
- `gpt/BTO-Layout-Rendering-Workflow.md`
- `gpt/BTO-Layout-Object-Catalog.md`
- `schema/project-schema.md`
- `schema/project-template.json`

Generated handoffs should set `settings.architectureReviewConfirmed` to `false`, provide validated `project.json` separately, and include a real ZIP rather than a renamed text file.

## Browser dependencies

- Three.js
- JSZip

Ruler calibration and floor-plan checking run locally in the browser without a paid AI service.
