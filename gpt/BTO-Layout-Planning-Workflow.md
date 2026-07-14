# Layout Studio Planning Workflow

Use this workflow for new plans, project corrections and layout validation.

## 1. Gather only essential inputs

Ask for missing information that affects the layout:

- floor plan and reliable printed dimensions
- occupants and room uses
- walls that may be hacked or opened
- required beds, TV, dining capacity, work areas and storage
- renovation constraints and inspiration images

Use printed dimensions and project data. Do not derive authoritative millimetres from screenshot pixels.

## 2. Reconstruct architecture

1. Confirm orientation and scale. If Layout Studio will calibrate a new basemap, identify one clear horizontal printed dimension for its ruler.
2. Reconstruct walls in millimetres.
3. Add doors and windows with valid `wallId` and `offset` values.
4. Preserve the household shelter and other fixed or non-hackable elements. Represent a shelter with walls and openings, not a second room-sized solid shell block.
5. Mark assumptions and distinguish retained, proposed and uncertain work.
6. Check endpoints, thicknesses, opening offsets and room adjacency.
7. Present one top-down architecture review.

### Gate 1 — Architecture approval

Obtain approval for walls, openings, fixed shell, proposed hacked walls and dimensional assumptions. Do not add another gate before layout planning.

### Layout Studio import review

This is verification, not a third approval gate. Set `settings.architectureReviewConfirmed` to `false` in every handoff.

When imported, Layout Studio:

- opens **Set scale** first for a new PNG or any imported ZIP containing a basemap
- automatically positions the horizontal ruler on the longest reliable span for user verification
- requires the ZIP scale to be applied again before detection
- asks for the matching floor-plan image when an imported ZIP contains JSON but no basemap; continuing without it keeps the JSON millimetres authoritative
- hides furniture and furniture-validation overlays
- crops detected page margins before applying the ruler's millimetres-per-pixel value
- detects centred wall bands from the calibrated basemap, rejects isolated text/dimension strokes and checks likely doors
- preserves authored wall lengths and walls that own openings when a detected band is only partial
- opens **Correct architecture** with optional wall highlights
- lets the user add, magnetically join, align and delete individual walls, doors and windows
- reveals and conservatively aligns furniture after confirmation

Never invent `basemap.scaleMmPerPixel` or `basemap.scaleCalibration`. Those values must come from the actual source image and ruler.

## 3. Plan the layout

Use inspiration images for design language—materials, colour, furniture character, lighting and visual density—without forcing objects into unsuitable spaces.

Work as both an interior designer and interior stylist: resolve function, scale and circulation first, then add a restrained layer of materials, lighting and decoration that supports the concept.

Develop one strong layout. Add an alternative only when it represents a real trade-off.

Check:

- entrance and room-to-room circulation
- door swings and access
- kitchen work zones
- dining seating and pull-back
- TV viewing
- bed and wardrobe access
- furniture/furniture, furniture/wall and furniture/fixed-shell overlaps
- furniture or wall décor overlapping doors, windows or glazing

For wall-mounted artwork and décor, verify both its horizontal wall interval and elevation against every opening on that wall. It may overlap neither a door nor a window. If the wall has no sufficiently large uninterrupted area, omit the object or choose another appropriate solid wall rather than mounting it on glazing.

Keep physical collision warnings separate from softer design advice.

### Placement metadata

Add `placement` when the relationship is known:

```json
{
  "roomId": "room-living",
  "mode": "wall",
  "wallId": "wall-living-east",
  "gap": 20,
  "groupId": "living-tv-zone"
}
```

- `roomId`: intended room
- `mode`: `wall`, `free` or `support`
- `wallId`: wall anchor
- `gap`: distance from wall face in millimetres
- `supportId`: supporting object
- `groupId`: arrangement to preserve

Typical use:

- wardrobes, kitchen runs and TV consoles: `wall`
- sofas and coffee tables: `free`
- tabletop or console-top objects: `support`
- table and matching chairs: shared `groupId`

`elevation` is the object's bottom height above finished floor. For a supported object:

```text
upper elevation = support elevation + support height
```

### Gate 2 — Layout approval

Obtain approval for zoning, furniture, carpentry, major decoration, circulation and unresolved assumptions.

## 4. Cameras

Recommend:

- Top for plan checking
- Bird's-eye for spatial understanding
- Eye level for spatial previews and exported camera screenshots

Use blocking-wall hiding only for photography. Hidden walls remain part of the model and validation.

Photo mode keeps a floating Camera panel available. Nearby furniture can be hidden automatically by camera distance, or selected furniture can be hidden and shown manually. Camera visibility settings never delete or resize project objects.

## 5. Create the handoff

After Gate 2, create:

- `project.json`
- concise notes
- standard ZIP with `project.json` at the root
- layout rationale, assumptions and warnings
- recommended camera views

Validate before delivery:

- unique IDs
- positive dimensions and walls at least 200 mm long
- valid opening, placement, support and cutaway references
- valid categories, models and placement modes
- non-negative elevations
- `settings.architectureReviewConfirmed: false`

When file tools are available, parse `project.json`, create the ZIP, reopen it and parse its root `project.json`. Provide the JSON separately as well.
