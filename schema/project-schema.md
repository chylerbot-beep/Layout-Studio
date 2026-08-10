# Layout Studio project schema v2.8

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
  "cameraShots": [],
  "workflow": {},
  "design": {},
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
- `camera`: Three.js position, target and FOV (last manually-set view; metres)
- `cameraShots`: named, predetermined camera views in millimetres (see below)
- `workflow`: two-gate approval state, fingerprints and locks
- `design`: approved style-board, furniture-archetype, material, lighting, styling and shot-render metadata
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

Camera vectors use Three.js world units in metres; project geometry remains millimetres. `fov` is vertical field of view in degrees. `camera` stores only the single, last-applied view.

## Camera shots

`cameraShots` stores zero or more named, predetermined views, each independently selectable in the app without manual re-aiming:

```json
{
  "cameraShots": [
    {
      "id": "shot-living-hero",
      "label": "Living – sofa and shelving",
      "roomId": "room-living",
      "type": "eye",
      "positionMm": [11200, 1500, 8500],
      "targetMm": [9000, 1500, 3200],
      "fov": 40,
      "notes": "Frame the sofa and shelving wall; keep the dining table visible at the right edge."
    }
  ]
}
```

- `id`: stable, unique, kebab-case.
- `label`: shown in the app's shot selector; keep it short and room-first.
- `roomId`: optional matching `rooms[].id`.
- `type`: `eye` (default), `bird` or `top`. Only `eye` locks the view to a level horizontal orbit.
- `positionMm` / `targetMm`: `[x, y, z]` in millimetres, unlike `camera` which uses metres. `y` is height above the floor. For a level `eye` shot, `positionMm[1]` and `targetMm[1]` should match — that shared value is the eye height.
- `fov`: vertical field of view in degrees, 20–100. 35–45 reads closest to a real interior-photography lens; the app-wide default of 52 is wider than typical editorial framing.
- `notes`: optional one-line framing intent, shown next to the shot in the app.

Unlike `camera`, `cameraShots` is a list: the app can step through it (Prev/Next) or jump to any entry, and a user can add their own alongside generated ones. Invalid entries (missing/non-numeric `positionMm` or `targetMm`) are dropped silently on load. `cameraShots` is optional; its absence or an empty array leaves existing behaviour unchanged.

## Workflow approvals and locks

`workflow` records the two approval gates. Layout Studio derives the locks from current approvals and invalidates them when a fingerprint changes.

```json
{
  "workflow": {
    "schemaVersion": 1,
    "stage": "design-approved",
    "approvals": {
      "layout": {
        "status": "approved",
        "approvedAt": "2026-08-10T12:00:00.000Z",
        "fingerprint": "fnv1a32:1234abcd"
      },
      "design": {
        "status": "approved",
        "approvedAt": "2026-08-10T13:00:00.000Z",
        "fingerprint": "fnv1a32:5678ef90"
      }
    },
    "locks": {
      "layout": true,
      "design": true,
      "cameraShots": true
    }
  }
}
```

Allowed `stage` values:

- `layout-planning`: Step 1 is not approved or spatial changes require approval again.
- `design-development`: Gate 1 is current; Step 2 is pending or changed.
- `design-approved`: both gates are current; the complete Step 2 ZIP and isolated Step 3 handoff may be exported.

Allowed approval `status` values are `pending`, `approved` and `changes-required`.

Gate 1 fingerprints the spatial contract: plan, rooms, architecture, fixed shell, clearances and furniture/built-in footprints. Gate 2 fingerprints Gate 1 plus approved design metadata, references, object appearance, camera shots and camera visibility settings. A changed Gate 1 fingerprint invalidates both approvals. A changed Gate 2 fingerprint invalidates Gate 2 only.

`settings.architectureReviewConfirmed` remains an import-verification state, not a third approval gate.

## Approved design metadata

```json
{
  "design": {
    "styleBoard": {
      "referenceIds": ["reference-style-board"],
      "notes": "Warm, restrained natural palette with low visual density."
    },
    "furnitureArchetypes": [
      "Low-profile oatmeal sofa with slim arms",
      "Rounded solid-oak dining table"
    ],
    "materials": [
      "Floor: light warm oak, matte finish",
      "Built-ins: natural oak veneer with warm-grey laminate accents"
    ],
    "lighting": [
      "3000 K ambient lighting with concealed cove light at the living room",
      "Small opal pendant centred over the dining table"
    ],
    "styling": [
      "One large artwork above the sofa and a restrained ceramic grouping on the console"
    ],
    "shotRenderSpecs": []
  }
}
```

- `styleBoard.referenceIds` must reference `references[].id`; the corresponding assets must be present in the approved Step 2 ZIP.
- The four metadata arrays contain concise approved statements, one decision per string. They are design intent, not instructions to source or invent products.
- `shotRenderSpecs` must contain exactly one current entry for every locked camera shot before Gate 2 approval.

### Shot-specific render spec

```json
{
  "id": "render-shot-living-hero",
  "shotId": "shot-living-hero",
  "intent": "Produce a natural editorial interior image while preserving the exact approved composition.",
  "mustInclude": [
    "Sofa, shelving wall and the dining-table edge shown in the Layout Studio PNG"
  ],
  "allowedInterpretation": [
    "Resolve exact fabric weave and wood grain within the approved style board"
  ],
  "negativeConstraints": [
    "Do not introduce books, plants or lamps that are absent from the approved scene"
  ],
  "lockedInputs": [
    "Use the Layout Studio PNG as the spatial and compositional source of truth."
  ],
  "policy": {
    "canModifyLayout": false,
    "canModifyDesign": false,
    "canAddObjects": false,
    "canSourceProducts": false
  }
}
```

The Step 3 render handoff is intentionally not a Layout Studio project package. For one shot it contains only:

- `layout-studio-export.png` from the exact locked camera
- the selected approved assets under `style-board/`
- `render-spec.json` with `stage: "image-generation-only"` and `projectZipAllowed: false`

The renderer must never receive or modify `project.json` or the Step 2 Layout Studio ZIP. If a render reveals a project problem, update Layout Studio in Step 1 or Step 2, reapprove invalidated gates and create a new handoff.

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
- Workflow approval statuses and stages use the documented values.
- A design approval is invalid unless layout approval is current.
- Approved style-board IDs reference available project assets.
- Every camera shot has exactly one shot render spec before Gate 2 approval.
- Every shot render policy forbids layout changes, design changes, new objects and sourcing.
- A Step 3 handoff contains no project JSON or Layout Studio ZIP.

For generated projects, start from `project-template.json`, validate the JSON, and test the exported ZIP by reopening its root `project.json`.
