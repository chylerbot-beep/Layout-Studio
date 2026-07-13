# BTO Layout Studio project schema v2.7

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
- `settings`: ceiling visibility and height
- `camera`: Three.js camera position, target and FOV

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
  "color": 12102304
}
```

`x` and `y` refer to the object's top-left unrotated bounding rectangle. Rotation is in degrees around the object centre.

`elevation` is the height of the object's bottom above finished floor level. It defaults to `0`. For an object placed on top of another object, use the supporting object's `elevation + h` as the upper object's elevation.

Example tabletop object:

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
  "color": 12095597
}
```

## Supported decorative models

- `glass-blocks` — glass-block screen
- `plant` — potted plant
- `tv` — television with stand
- `picture-frame` — framed picture
- `fruit-bowl` — bowl with fruit
- `phone` — handphone
- `flask` — water flask

Objects without a recognised `model` render as editable boxes. Carpentry such as `TV console`, wardrobes and kitchen cabinets does not require a `model` value.

## Current catalogue defaults

- TV console: `1800 × 450 × 500 mm`, category `carpentry`
- TV: `1200 × 180 × 760 mm`, model `tv`
- Framed picture: `800 × 70 × 1000 mm`, model `picture-frame`
- Bowl of fruits: `360 × 360 × 190 mm`, model `fruit-bowl`
- Handphone: `80 × 160 × 14 mm`, model `phone`
- Water flask: `95 × 95 × 300 mm`, model `flask`

## Validation requirements

- IDs must be unique within the project.
- Every opening's `wallId` must exist.
- Wall length must be at least 200 mm.
- Dimensions must be positive.
- Elevation must be zero or positive.
- Ceiling height defaults to 2600 mm.
- `category` is one of `furniture`, `carpentry`, or `decorative`.
- Use a supported `model` value when a recognised decorative object should render with its custom geometry.
