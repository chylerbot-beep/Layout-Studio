# Layout Studio

A lightweight browser-based 2D/Three.js planning tool for Singapore BTO layouts. The authoritative model is structured project data in millimetres.

## Run

Host the repository as a static site, or run locally with:

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000` in a normal desktop browser.

## Current interaction updates

- Moved **Align all walls β** into the left basemap-tools section
- Added **Align furniture β** with conservative room, wall, support and grouped-layout logic
- Added a **Resize** button for selected carpentry
- Straight carpentry can be extended or shortened from either end along its length only
- Added an **L-shaped wardrobe** with one resize handle on each free end
- Every resize is stored as one undoable action

## Camera visibility and cutaway

- Added **Auto-hide blocking walls** under Camera visibility
- Automatic cutaway only operates at eye-level or other low camera heights; top and bird's-eye views remain intact
- Cutaway style can be **Fade** or **Hide**
- Fade opacity and cutaway depth are adjustable
- A selected wall can be manually hidden for a camera view
- **Show all walls** restores every manually hidden wall
- Cutaway affects only viewport and PNG rendering; walls remain in project data, wall editing, collisions and validation
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
- reference images under `references/`

Older `.btozip` files remain accepted because they were ordinary ZIP archives with a custom extension.

The importer is tolerant of several handoff formats:

- a standard ZIP with `project.json` at its root
- a ZIP whose project file has another `.json` filename, such as `approved_bto_layout_project.json`
- a Layout Studio JSON file accidentally given a `.zip` extension

The JSON project data remains authoritative; images are references.

## Hosted project library

Add package entries to `projects/index.json`. Each entry uses:

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

Use these files from `gpt/`:

- `BTO-Layout-Planner-Instructions.md` — paste into the GPT Instructions field
- `BTO-Layout-Object-Catalog.md` — upload as a Knowledge file

Also upload `schema/project-schema.md` as Knowledge. The GPT should always provide a validated `project.json` separately and may also provide a real standard ZIP containing that file, notes, basemap and references. It must not merely rename a text file to `.zip`.

The latest object catalogue includes the L-shaped wardrobe model, carpentry resize rules and furniture-placement metadata used by **Align furniture β**. Replace the older Knowledge file in the GPT editor after pulling this update.

## Browser dependencies

- Three.js for 3D
- Tesseract.js for optional in-browser OCR
- JSZip for project ZIP import/export

No OCR service API is required.
