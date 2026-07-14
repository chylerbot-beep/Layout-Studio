# Layout Studio

A lightweight browser-based Three.js planner for reconstructing Singapore floor
plans in millimetres, placing furniture and carpentry, validating physical
overlaps, setting cameras and exporting views.

## Authority model

Structured project JSON is authoritative. Floor-plan basemaps are visual
comparison layers.

Calibration registers and crops the source image. It does not move walls,
openings or furniture. The architecture scan creates review suggestions with
separate **Current JSON** and **Basemap candidate** values. A project coordinate
changes only when the user selects **Apply suggestion**, uses an explicit manual
editing tool, or applies the high-confidence suggestions after confirmation.

A persistent status identifies the current state:

- **Basemap calibrated and cropped** — suggestions are available.
- **Basemap unregistered** — set scale before scanning.
- **JSON-only mode** — basemap detection is disabled.

## Run locally

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000` in a desktop browser.

## Main workflow

1. Start blank or open a JSON/ZIP project.
2. Upload or load a floor-plan image.
3. Choose one route:
   - **Set scale** to register the basemap and compare it with the JSON; or
   - **Use JSON only** to skip basemap detection for an existing measured project.
4. Review mismatches one at a time.
5. Choose **Keep JSON** or **Apply suggestion** for each item.
6. Confirm architecture to reveal and conservatively align furniture.
7. Validate, set a camera and export PNG or project files.

When unresolved suggestions remain, confirmation asks whether to keep the
current JSON geometry for those items.

## Calibration and architecture review

Scale calibration:

- uses a horizontal ruler with a known printed millimetre dimension;
- detects and stores a normalized drawing crop;
- stores millimetres per pixel and ruler endpoints;
- updates the basemap registration;
- preserves `project.plan` extents when the imported project already contains
  authored architecture.

Architecture detection:

- requires a registered basemap;
- ignores isolated short marks where possible;
- proposes wall centre-line and door changes without applying them;
- never deletes unmatched authored walls;
- never joins split wall pairs automatically;
- leaves split-wall door candidates for manual review;
- shows the current JSON position in red and the candidate in amber.

Manual **Align selected**, add and delete tools remain available because they
are explicit user actions.

## Project compatibility

Layout Studio imports and exports normal ZIP files containing `project.json` at
the root. Packages may also contain:

- `manifest.json`
- project notes
- a basemap under `assets/`
- reference images under `references/`

The importer also accepts older `.btozip` archives, nested project JSON,
standalone Layout Studio JSON and supported wrapper objects.

Ruler metadata and `settings.architectureReviewConfirmed` remain optional for
older files. JSON-only review mode is stored as
`settings.basemapReviewMode: "json-only"`.

## Editing and validation

- Walls support body movement, endpoint editing and centre rotation.
- New and extended wall endpoints magnetically join nearby centre lines and
  endpoints; Alt temporarily bypasses the magnet.
- Windows can be dragged along their owning wall.
- Ctrl/Cmd preserves a wall angle while dragging an endpoint.
- Furniture, carpentry and decoration use millimetre fields and optional
  placement metadata.
- Conservative alignment preserves room, wall-side, support and group intent.
- Validation reports physical furniture, wall, opening and fixed-shell
  collisions.

## Camera and display

- Top, Bird's-eye and Eye-level views
- 52° default perspective lens and 1,300 mm default eye height
- blocking-wall hiding without deleting geometry
- Photo mode with camera and furniture-visibility controls
- project-name-based PNG filenames

Hidden walls and furniture remain in project data and validation.

## Code structure

`app-loader.js` loads `app-parts/` in a fixed order and concatenates them into
one shared IIFE. Later files intentionally refine earlier functions.

- `app-parts/25.js` — legacy detection primitives and review state
- `app-parts/26.js` — ruler calibration
- `app-parts/27.js` — review and responsive precision UI
- `app-parts/28.js` — Photo-mode controls
- `app-parts/29.js` — non-destructive suggestions, authority status and
  JSON-only route
- `app-parts/08.js` — starts the app after every override loads

Keep this order intact.

## Checks

```bash
node scripts/check-bundle.mjs
node scripts/check-architecture-review.mjs
```

The bundle check validates the concatenated JavaScript syntax. The architecture
review check verifies that the non-destructive module is loaded before startup
and contains the required registration guard, suggestion actions and unresolved
review warning.

## Custom GPT files

Use:

- `gpt/BTO-Layout-Planner-Instructions.md`
- `gpt/BTO-Layout-Planning-Workflow.md`
- `schema/project-schema.md`
- `schema/project-template.json`

Generated handoffs should set
`settings.architectureReviewConfirmed` to `false`. Parsing JSON and reopening a
ZIP proves schema and packaging validity only; it does not prove calibrated
overlay alignment.

## Browser dependencies

- Three.js
- JSZip

Ruler calibration and floor-plan checking run locally in the browser.
