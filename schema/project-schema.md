# Layout Studio project schema v2.7

Projects are UTF-8 JSON. All plan coordinates and dimensions are millimetres. Plan origin is top-left: X increases right and Y increases down.

Existing JSON, ZIP and `.btozip` projects remain compatible. Do not rename existing keys.

## Top level

```json
{
  "meta": {},
  "references": [],
  "basemap": null,
  "rooms": [],
  "walls": [],
  "openings": [],
  "shell": [],
  "clearances": [],
  "furniture": [],
  "settings": {},
  "camera": null,
  "plan": { "width": 14775, "depth": 9500, "unit": "mm" }
}
```

- `meta`: name, brief, timestamps and app version
- `references`: reference-image metadata; ZIP packages may use `assetPath`
- `basemap`: floor-plan image metadata; JSON may use `dataUrl`, ZIP packages use `assetPath`
- `rooms`: semantic rectangular zones
- `walls`: editable wall centre lines
- `openings`: doors and windows attached to walls
- `shell`: fixed architecture or built-ins
- `clearances`: rectangular advisory zones
- `furniture`: furniture, carpentry and decorative objects
- `settings`: ceiling, camera cutaway, validation and review state
- `camera`: Three.js position, target and FOV
- `plan`: overall millimetre dimensions

## Rectangular zones and fixed shell

Rooms, shell items and clearances use plan rectangles:

```json
{
  "id": "room-living",
  "name": "Living room",
  "type": "living",
  "x": 6200,
  "y": 1000,
  "w": 5575,
  "d": 4700
}
```

Shell items may also include `h`, `elevation`, `rotation`, `color` and `type`.

Use shell rectangles only for genuinely solid fixed obstacles. A household/bomb shelter is represented by its enclosing walls and openings; do not add a solid room-sized shell rectangle over the same footprint. Advisory allowances may remain in project data with `fixed: false` and are not treated as physical blocks.

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

Generate endpoint-based walls. Legacy `x`, `y`, `w`, `d` wall bounds remain import-compatible.

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

`type` is `door` or `window`. `offset` measures from the wall start to the opening centre along the wall centre line. Doors may also include `swing`.

## Furniture, carpentry and decoration

```json
{
  "id": "dining-table",
  "name": "Dining table",
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

`x` and `y` are the top-left of the unrotated plan rectangle. Rotation is degrees around the object centre. `elevation` is the bottom height above finished floor and defaults to `0`.

Categories:

- `furniture`
- `carpentry`
- `decorative`

### Image-derived custom elements

When an inspiration image contains an important element without a suitable native model, store it in the existing `furniture` array as a simple editable box:

```json
{
  "id": "custom-curved-bedside-cabinet",
  "name": "Curved oak bedside cabinet",
  "category": "carpentry",
  "model": "custom-box",
  "custom": true,
  "description": "Rounded bedside cabinet interpreted from the reference image",
  "x": 1450,
  "y": 2100,
  "w": 550,
  "d": 420,
  "h": 520,
  "elevation": 0,
  "rotation": 0,
  "color": 11771878,
  "placement": {
    "roomId": "room-master",
    "mode": "wall",
    "wallId": "wall-master-west",
    "gap": 0
  },
  "reference": {
    "image": "bedroom-mood-board.jpg",
    "description": "Curved cabinet beside the bed",
    "confidence": "medium"
  }
}
```

- `custom`: `true` identifies an image-derived or otherwise non-native element.
- `model`: use `custom-box`; Layout Studio renders it as a named editable box.
- `description`: concise visual and functional intent.
- `reference.image`: source upload filename when available.
- `reference.description`: the element and its location in the source image.
- `reference.confidence`: `high`, `medium` or `low` identification confidence.

Image-derived dimensions are assumptions unless supported by project data. Keep the assumptions in project notes. Use several custom boxes with one `groupId` only when a spatially important object cannot be represented by one rectangle. Do not store executable code or external model URLs.

## Placement metadata

`placement` preserves intent during conservative furniture alignment:

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

- `roomId`: intended room
- `mode`: `wall`, `free` or `support`
- `wallId`: wall anchor
- `gap`: desired distance from wall face
- `supportId`: supporting furniture ID
- `groupId`: arrangement that should move together

Placement is advisory; physical collisions and access take priority.

## Supported models

Decorative models:

- `glass-blocks`
- `plant`
- `tv`
- `picture-frame`
- `fruit-bowl`
- `phone`
- `flask`

Carpentry models:

- `l-wardrobe`

Generic custom model:

- `custom-box`

An L-shaped wardrobe also requires `armDepth`, which must be smaller than both `w` and `d`. `custom-box` and unknown models render as editable boxes.

## Optional basemap calibration

Older projects need only `basemap.width` and `basemap.depth`. Ruler fields are optional:

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

`a` and `b` are normalized source-image coordinates. Calibration affects the visual basemap only; project geometry remains authoritative. Do not invent these values.

## Settings

```json
{
  "settings": {
    "ceilingVisible": false,
    "ceilingHeight": 2600,
    "validationEnabled": true,
    "architectureReviewConfirmed": false,
    "cameraCutaway": {
      "enabled": false,
      "style": "hide",
      "depth": 1200,
      "hiddenWallIds": []
    }
  }
}
```

- `architectureReviewConfirmed` is optional for old projects. Use `false` for generated handoffs.
- Camera cutaway changes only display and PNG output; hidden walls remain in data and validation.
- Use cutaway style `hide`. Legacy `fade` values remain import-compatible and are treated as hidden.

## Camera

```json
{
  "camera": {
    "position": [11.2, 1.3, 8.5],
    "target": [9.0, 1.1, 3.2],
    "fov": 52
  }
}
```

Camera vectors use Three.js world units in metres; project geometry remains millimetres. `fov` is vertical field of view in degrees.

## Validation checklist

- IDs are unique.
- Dimensions are positive; wall length is at least 200 mm.
- Opening `wallId` values reference existing walls.
- Placement wall and support references exist.
- Wall-mounted furniture and décor do not overlap the horizontal and vertical span of any door or window on the same wall.
- Camera-cutaway wall IDs exist.
- Elevation is non-negative.
- Categories, placement modes and custom models are valid.
- Ceiling height defaults to 2600 mm.
- `architectureReviewConfirmed`, when supplied, is boolean.

For generated projects, start from `project-template.json`, validate the JSON, and test the exported ZIP by reopening its root `project.json`.
