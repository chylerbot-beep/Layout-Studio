# Layout Studio

A lightweight browser-based 2D/Three.js planning tool for Singapore BTO layouts. The authoritative model is structured project data in millimetres.

## Run

Host the repository as a static site, or run locally with:

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000` in a normal desktop browser.

## Current interaction updates

- Added draggable ruler calibration: place both endpoints on a reliable printed dimension and enter its length in millimetres
- Added **Check floor plan β**, which runs the existing browser-only wall and door recognition without a paid AI service
- Added guided architecture review tools: re-check a selected area, align or delete the selected item, temporarily show the original basemap, and merge aligned overlapping walls by double-clicking
- Architecture review temporarily replaces the normal left panel with a three-step guide, leaving the full viewport interactive for zooming, panning and camera changes
- **Exit and discard** restores the project, undo/redo history and camera to their exact pre-review state; confirmation keeps the reviewed architecture
- New basemap uploads now follow **Set scale → Check floor plan → Review architecture → Confirm → Reveal and align furniture**
- Scale calibration is constrained to a horizontal ruler while still allowing the ruler to move vertically over the drawing
- Added a **Precision** drawer below 900 px so numeric object, wall, camera and validation controls remain accessible
- Removed the visible Save view / Restore view controls; PNG exports use the current project name instead of `bto-camera-view.png`
- Auto-detect replaces matching wall geometry instead of stacking duplicate walls and adds missing suggestions
- Best-effort door-symbol detection realigns nearby doors or adds missing doors
- Existing JSON, ZIP and `.btozip` projects remain compatible; ruler metadata is optional
- Reference-image and hosted-library controls are hidden from the planning interface while legacy package data remains import-compatible
- Moved **Align all walls β** into the left basemap-tools section
- Added **Align furniture β** with conservative room, wall, support and grouped-layout logic
- Added a **Resize** button for selected carpentry
- Straight carpentry can be extended or shortened from either end along its length only
- Added an **L-shaped wardrobe** with one resize handle on each free end
- Every resize is stored as one undoable action

## Camera visibility and blocking walls

- **Blocking walls** can automatically hide foreground walls at eye level; top and bird's-eye views remain intact
- Hide distance controls how far from the camera a blocking wall may be hidden
- A selected wall can be manually hidden for a camera view
- **Show all walls** restores every manually hidden wall
- Camera visibility affects only viewport and PNG rendering; walls remain in project data, wall editing, collisions and validation
- Opening objects and labels attached to a hidden wall follow that wall's camera visibility
- Camera visibility settings are saved in project JSON and ZIP packages

## Current catalogue update

- Added TV console under Carpentry
- Added L-shaped wardrobe under Carpentry
- Added custom decorative models for TV, framed picture, bowl of fruits, handphone and water flask
- Added adjustable object elevation in millimetres for tabletop, console-top and wall-mounted objects
- Furniture-to-furniture collision checks account for vertical separation, so an object can sit on a support surface without being treated as a volume overlap

## Project ZIP files

The app imports and exports normal `.zip` files containing:

- `project.json`
- optional `manifest.json`
- optional project notes
- the calibrated basemap under `assets/`
- optional legacy/reference images under `references/`

Older `.btozip` files remain accepted because they were ordinary ZIP archives with a custom extension.

The importer is tolerant of several handoff formats:

- a standard ZIP with `project.json` at its root
- a ZIP whose project file has another `.json` filename, such as `approved_bto_layout_project.json`
- a Layout Studio JSON file accidentally given a `.zip` extension

The JSON project data remains authoritative; images are references.

## Hosted project packages

The visible hosted-project picker is hidden. Existing `projects/index.json` entries and direct package links remain compatible. Each entry uses:

```json
{
  "id": "example-project",
  "name": "Example project",
  "description": "Optional description",
  "package": "example-project/example-project.zip"
}
```

The package path is resolved relative to `projects/index.json`.

## Custom GPT handoff

Use these files from `gpt/` and `schema/`:

- `BTO-Layout-Planner-Instructions.md` — paste into the GPT Instructions field
- `BTO-Layout-Planning-Workflow.md`
- `BTO-Layout-Rendering-Workflow.md`
- `BTO-Layout-Object-Catalog.md`
- `schema/project-schema.md`
- `schema/project-template.json`

The GPT should always provide a validated `project.json` separately and may also provide a real standard ZIP containing that file, notes, basemap and references. It must not merely rename a text file to `.zip`. Generated projects leave `settings.architectureReviewConfirmed` false so Layout Studio performs architecture review before revealing furniture.

The latest object catalogue includes the L-shaped wardrobe model, carpentry resize rules and furniture-placement metadata used by **Align furniture β**. Replace the older Knowledge file in the GPT editor after pulling this update.

## Browser dependencies

- Three.js for 3D
- JSZip for project ZIP import/export

Ruler calibration and floor-plan checking run locally in the browser. No OCR or AI service API is required.
