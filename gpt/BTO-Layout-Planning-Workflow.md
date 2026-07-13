# Layout Studio Planning Workflow

Use this Knowledge file whenever the user is reconstructing, planning, correcting or validating a Singapore HDB/BTO layout.

## 1. Inputs

Request only information that is missing and materially necessary:

- floor-plan PNG, JPG or PDF
- printed overall width and depth in millimetres
- reference interior images
- occupants and room uses
- walls that may be opened or hacked
- required beds, TV, dining capacity, work areas and storage
- known HDB or renovation constraints

Do not treat screenshot pixels as authoritative dimensions. Use published dimensions and structured project data.

## 2. Architectural reconstruction

1. Establish plan orientation and calibrated dimensions.
2. Reconstruct external and internal walls in millimetres.
3. Add doors and windows as openings linked to valid wall IDs.
4. Preserve the household shelter and other confirmed non-hackable elements.
5. Distinguish existing, retained, proposed and uncertain walls in the explanation.
6. Check wall endpoints, wall thicknesses, opening offsets and room adjacency.
7. Produce one top-down architectural review.

### Approval Gate 1

Ask the user to approve:

- external and internal walls
- doors and windows
- household shelter and fixed shell
- proposed hacked or opened walls
- any dimensional assumptions

Do not add another approval step before furniture planning.

## 3. Design-language analysis

Analyse the reference images for:

- zoning and spatial composition
- furniture silhouettes and proportions
- material and colour language
- carpentry integration
- visual density
- lighting strategy
- decorative rhythm
- photographic mood

Apply the design language without forcing objects into spaces that cannot accommodate them.

## 4. Layout planning

Develop one strong primary layout. Add alternatives only when there is a genuine trade-off.

Check:

- entrance circulation
- door swings and access
- kitchen work zones
- dining seating and pull-back
- TV viewing
- bed-side access
- wardrobe access
- routes between rooms
- furniture/furniture overlaps
- furniture/wall overlaps
- furniture/fixed-shell overlaps

Keep physical collision warnings separate from softer planning advice.

### Placement metadata

Add `placement` whenever the intended relationship is known:

```json
{
  "roomId": "room-living",
  "mode": "wall",
  "wallId": "wall-living-east",
  "gap": 20,
  "groupId": "living-tv-zone"
}
```

Fields:

- `roomId`: intended room zone
- `mode`: `wall`, `free`, or `support`
- `wallId`: intended wall anchor
- `gap`: distance from wall face in millimetres
- `supportId`: supporting object for a raised decorative object
- `groupId`: objects whose relative arrangement should be preserved

Recommended relationships:

- wardrobes, kitchen runs, worktops and TV consoles: `mode: "wall"`
- beds: wall relationship when the headboard wall is known
- dining table and chairs: same `groupId`
- sofas, lounge chairs and coffee tables: usually `mode: "free"`
- TVs, bowls, phones and flasks on another object: `mode: "support"`

### Elevation

`elevation` is the height of the object's bottom above finished floor level.

Examples:

- floor-standing object: `0`
- TV on a 500 mm TV console: `500`
- bowl on a 760 mm dining table: `760`
- framed picture: bottom-of-frame elevation, often `900–1200`

For stacked objects:

```text
upper elevation = support elevation + support height
```

### Approval Gate 2

Ask the user to approve:

- room zoning
- furniture arrangement
- carpentry
- major decorative placement
- circulation
- unresolved assumptions

## 5. Cameras

Recommend:

- top view for plan checking
- bird’s-eye view for spatial understanding
- eye-level views for rendering

A typical eye-level camera is around 1450–1650 mm, but use the project intent. Use camera cutaway only when a wall blocks the intended photograph.

Example:

```json
{
  "enabled": true,
  "style": "fade",
  "opacity": 0.15,
  "depth": 1200,
  "hiddenWallIds": []
}
```

Cutaway affects photography only and does not remove walls from the model.

## 6. Project output

After Gate 2, produce:

- `project.json`
- concise project notes
- standard ZIP with `project.json` at the root
- layout rationale
- assumptions and unresolved warnings
- recommended camera views

Validate:

- unique IDs
- valid opening `wallId` references
- positive dimensions
- wall length at least 200 mm
- valid categories
- valid supported models
- valid `placement.wallId` and `placement.supportId`
- non-negative elevations
- valid camera-cutaway wall IDs

When Code Interpreter is available:

1. create and parse `project.json`
2. provide it separately
3. create a real ZIP archive
4. reopen the ZIP
5. confirm `project.json` parses from the ZIP

Never create a fake ZIP by renaming a text or JSON file.
