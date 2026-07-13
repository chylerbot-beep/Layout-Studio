# Layout Studio Object Catalogue

Use these exact names, categories and `model` values when generating project JSON for Layout Studio. All dimensions are millimetres and remain editable.

## Furniture

- Sofa
- Dining table
- Dining chair
- Lounge chair
- Coffee table
- Console
- King bed
- Queen bed

## Carpentry

- Full-height wardrobe — 2400 × 600 × 2700
- L-shaped wardrobe — 2400 × 1800 × 2700, `model: "l-wardrobe"`, `armDepth: 600`
- Kitchen lower cabinets — 2400 × 600 × 870
- Kitchen upper cabinets — 2400 × 350 × 750
- Kitchen worktop — 2400 × 650 × 920
- Settee — 1600 × 550 × 480
- TV console — 1800 × 450 × 500

### Carpentry resize behaviour

Straight carpentry is resized only along its longest plan dimension. The opposite end remains fixed.

An L-shaped wardrobe uses:

```json
{
  "name": "L-shaped wardrobe",
  "category": "carpentry",
  "model": "l-wardrobe",
  "w": 2400,
  "d": 1800,
  "h": 2700,
  "armDepth": 600
}
```

- `w` is the outer length of the horizontal arm.
- `d` is the outer length of the perpendicular arm.
- `armDepth` is the wardrobe carcass depth shared by both arms.
- Keep `armDepth` smaller than both `w` and `d`.
- Layout Studio provides one resize handle at each free end of the L so either arm can be extended or shortened independently.

## Decorative

- Glass-block screen — `model: "glass-blocks"`
- Potted plant S or M — `model: "plant"`
- TV — 1200 × 180 × 760, `model: "tv"`
- Framed picture — 800 × 70 × 1000, `model: "picture-frame"`
- Bowl of fruits — 360 × 360 × 190, `model: "fruit-bowl"`
- Handphone — 80 × 160 × 14, `model: "phone"`
- Water flask — 95 × 95 × 300, `model: "flask"`

## Elevation

`elevation` is the height of the object's bottom above finished floor level.

- Floor objects: `0`
- TV on a 500 mm-high TV console: `500`
- Bowl, phone or flask on a 760 mm-high dining table: `760`
- Framed picture: use the bottom-of-frame height, usually around `900`–`1200`

When placing an object on a support, set:

```text
upper elevation = support elevation + support height
```

Touching surfaces are valid. Do not embed the upper object inside the support object's volume.

## Placement metadata for automatic alignment

Add a `placement` object whenever the intended relationship is known.

### Wall-anchored carpentry

```json
{
  "roomId": "room-living",
  "mode": "wall",
  "wallId": "wall-living-east",
  "gap": 20,
  "groupId": "living-tv-zone"
}
```

Use this for wardrobes, kitchen cabinets, worktops, TV consoles and beds with a known headboard wall.

### Freestanding furniture

```json
{
  "roomId": "room-living",
  "mode": "free",
  "groupId": "living-seating"
}
```

Use this for sofas, lounge chairs and coffee tables unless the design explicitly anchors them to a wall.

### Supported decorative object

```json
{
  "roomId": "room-living",
  "mode": "support",
  "supportId": "tv-console",
  "groupId": "living-tv-zone"
}
```

Use this for a TV on a console and small decorative objects on tables. The upper object should use the support object's top elevation.

### Dining group

The table and all matching dining chairs should share:

```json
{
  "roomId": "room-dining",
  "mode": "free",
  "groupId": "dining-set"
}
```

This lets **Align furniture β** translate the dining arrangement as one unit instead of breaking the chair spacing.
