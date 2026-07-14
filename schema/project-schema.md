# Layout Studio project schema v2.7

The project file is UTF-8 JSON. Coordinates and dimensions are millimetres. The top-left of the calibrated plan is `(0, 0)`; positive X moves right and positive Y moves down in plan view.

## Top-level fields

- `meta`: project name, brief, timestamps and app version
- `references`: reference-image metadata; package builds may add `assetPath`
- `basemap`: calibrated floor-plan image metadata; JSON builds may include `dataUrl`, package builds use `assetPath`
- `rooms`: semantic rectangular room zones
- `walls`: editable wall centre lines
- `openings`: doors and windows attached to a wall by `wallId` and millimetre `offset`
- `shell`: fixed rectangular architecture or existing built-ins
- `clearances`: rectangular circulation zones
- `furniture`: furniture, carpentry and decorative objects
- `settings`: ceiling, blocking-wall and architecture-review settings
- `camera`: Three.js camera position, target and FOV

## Optional basemap scale calibration

Layout Studio can calculate the basemap dimensions from a draggable ruler. These fields are optional and additive; older projects containing only `basemap.width` and `basemap.depth` remain valid.

```json
{
  "basemap": {
    "width": 12600,
    "depth": 9400,
    "scaleMmPerPixel": 12.3046875,
    "scaleCalibration": {
      "knownMm": 12600,
      "a": { "u": 0.12, "v": 0.16 },
      "b": { "u": 0.88, "v": 0.16 }
    }
  }
}
```

`a` and `b` are normalized source-image coordinates. The structured millimetre geometry remains authoritative; calibration metadata only helps display and analyse the visual basemap.

## Wall

```json
{
  "id": "wall-living-north",
  "name": "Living north wall",
  "x1": 6200,
  "y1": 1000,
  "x2": 14775,
  "y2": 1000,
  "thickness": 120,
  "h": 2600
}
```

## Opening

```json
{
  "id": "window-living-1",
  "name": "Living window 1",
  "type": "window",
  "wallId": "wall-living-north",
  "offset": 1800,
  "width": 1700,
  "height": 1200,
  "sill": 900
}
```

`offset` is measured along the wall centre line from the wall start point to the opening centre.

## Furniture / carpentry / decorative object

```json
{
  "id": "dining-table",
  "name": "Oval dining table",
  "category": "furniture",
  "x": 7200,
  "y": 3200,
  "w": 2200,
  "d": 1000,
  "h": 760,
  "elevation": 0,
  "rotation": 0,
  "shape": "rounded",
  "color": 12102304,
  "placement": {
    "roomId": "room-dining",
    "mode": "free",
    "groupId": "dining-set"
  }
}
```

`x` and `y` refer to the object's top-left unrotated bounding rectangle. Rotation is in degrees around the object centre.

`elevation` is the height of the object's bottom above finished floor level. It defaults to `0`. For an object placed on top of another object, use the supporting object's `elevation + h` as the upper object's elevation.

## Optional placement metadata

The `placement` object lets Layout Studio preserve design intent when **Align furniture β** is used after walls have been corrected.

```json
{
  "roomId": "room-living",
  "mode": "wall",
  "wallId": "wall-living-east",
  "gap": 20,
  "supportId": null,
  "groupId": "living-tv-zone"
}
```

Fields:
- `roomId`: intended room-zone ID
- `mode`: `wall`, `free`, or `support`
- `wallId`: valid wall ID for wall-anchored objects
- `gap`: desired clear distance in millimetres from the wall face
- `supportId`: object ID beneath an elevated decorative object
- `groupId`: shared ID for objects whose relative arrangement should be preserved

Recommended use:
- Wardrobes, kitchen cabinets, worktops and TV consoles: `mode: "wall"` with `wallId`
- Beds: `mode: "wall"` when the intended headboard wall is known
- Dining table and chairs: shared `groupId`, usually `dining-set`
- Freestanding sofa, lounge chair and coffee table: usually `mode: "free"`
- TV, fruit bowl, handphone and flask on another object: `mode: "support"` with `supportId`

Placement metadata is advisory. Collision, circulation and door-clearance checks take priority.

## L-shaped wardrobe

```json
{
  "id": "wardrobe-master-l",
  "name": "L-shaped wardrobe",
  "category": "carpentry",
  "model": "l-wardrobe",
  "x": 950,
  "y": 1200,
  "w": 2400,
  "d": 1800,
  "h": 2700,
  "armDepth": 600,
  "elevation": 0,
  "rotation": 0,
  "placement": {
    "roomId": "room-master",
    "mode": "wall",
    "wallId": "wall-master-west",
    "gap": 0
  }
}
```

- `w`: outer length of the first arm
- `d`: outer length of the perpendicular arm
- `armDepth`: shared carcass depth
- Keep `armDepth` smaller than both `w` and `d`
- Layout Studio can resize either free end independently

## Example tabletop object

```json
{
  "id": "fruit-bowl-dining",
  "name": "Bowl of fruits",
  "category": "decorative",
  "model": "fruit-bowl",
  "x": 8060,
  "y": 3500,
  "w": 360,
  "d": 360,
  "h": 190,
  "elevation": 760,
  "rotation": 0,
  "color": 12095597,
  "placement": {
    "roomId": "room-dining",
    "mode": "support",
    "supportId": "dining-table",
    "groupId": "dining-set"
  }
}
```

## Blocking-wall settings

Blocking-wall visibility changes only viewport and PNG rendering. It does not delete walls or remove them from validation.

```json
{
  "settings": {
    "ceilingVisible": false,
    "ceilingHeight": 2600,
    "cameraCutaway": {
      "enabled": false,
      "style": "hide",
      "depth": 1200,
      "hiddenWallIds": []
    }
  }
}
```

- `enabled`: automatically hide blocking walls at low camera heights
- `style`: use `hide`; older `fade` values remain accepted for compatibility but are treated as hidden by the current interface
- `depth`: maximum cutaway distance from the camera in millimetres
- `hiddenWallIds`: walls manually hidden for camera views; all IDs must refer to valid walls

## Align furniture β behaviour

The current beta follows conservative rules:
1. Keep objects in their intended room when possible.
2. Preserve grouped layouts, especially dining tables and matching chairs.
3. Keep wall-anchored carpentry parallel and close to its wall.
4. Move supported decorative objects with their supporting furniture.
5. Avoid walls, fixed shell objects, door-clearance zones and declared circulation clearances.
6. Do not move already valid freestanding furniture merely to make it look more regular.
7. Apply all changes as one undoable action.

When placement metadata is absent, the app infers relationships from object names, current room, proximity to walls and elevation.

## Supported models

Decorative:
- `glass-blocks`
- `plant`
- `tv`
- `picture-frame`
- `fruit-bowl`
- `phone`
- `flask`

Carpentry:
- `l-wardrobe`

Objects without a recognised `model` render as editable boxes.

## Architecture review state

`settings.architectureReviewConfirmed` is an optional boolean. Older projects without it remain valid and enter the architecture-first review when a basemap is available. After the user confirms the reviewed walls, Layout Studio sets it to `true`, reveals furniture and runs conservative furniture alignment.

## Current catalogue defaults

- Full-height wardrobe: `2400 × 600 × 2700 mm`
- L-shaped wardrobe: `2400 × 1800 × 2700 mm`, `armDepth: 600`, model `l-wardrobe`
- TV console: `1800 × 450 × 500 mm`
- TV: `1200 × 180 × 760 mm`, model `tv`
- Framed picture: `800 × 70 × 1000 mm`, model `picture-frame`
- Bowl of fruits: `360 × 360 × 190 mm`, model `fruit-bowl`
- Handphone: `80 × 160 × 14 mm`, model `phone`
- Water flask: `95 × 95 × 300 mm`, model `flask`

## Validation requirements

- IDs must be unique within the project.
- Every opening's `wallId` must exist.
- Every `placement.wallId` and `placement.supportId`, when supplied, must reference a valid object.
- Every `settings.cameraCutaway.hiddenWallIds` entry must reference a valid wall.
- Wall length must be at least 200 mm.
- Dimensions must be positive.
- Elevation must be zero or positive.
- Ceiling height defaults to 2600 mm.
- `category` is one of `furniture`, `carpentry`, or `decorative`.
- `placement.mode`, when supplied, is one of `wall`, `free`, or `support`.
- `settings.architectureReviewConfirmed` is boolean when supplied. Use `false` for a generated or newly handed-off project so the user reviews architecture before furniture is revealed.
- `settings.cameraCutaway.style` should be `hide`; legacy `fade` values remain import-compatible.
- Use a supported `model` value when custom geometry is required.
