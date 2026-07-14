# Layout Studio Object Catalogue

Use these names, categories and `model` values in generated projects. Dimensions are editable millimetre defaults.

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

- Full-height wardrobe — `2400 × 600 × 2700`
- L-shaped wardrobe — `2400 × 1800 × 2700`, `model: "l-wardrobe"`, `armDepth: 600`
- Kitchen lower cabinets — `2400 × 600 × 870`
- Kitchen upper cabinets — `2400 × 350 × 750`
- Kitchen worktop — `2400 × 650 × 920`
- Settee — `1600 × 550 × 480`
- TV console — `1800 × 450 × 500`

Straight carpentry resizes only along its longest plan dimension.

For an L-shaped wardrobe:

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

`w` and `d` are the outer arm lengths. `armDepth` is the shared carcass depth and must be smaller than both arms. Each free end can resize independently.

## Decorative

- Glass-block screen — `model: "glass-blocks"`
- Potted plant S or M — `model: "plant"`
- TV — `1200 × 180 × 760`, `model: "tv"`
- Framed picture — `800 × 70 × 1000`, `model: "picture-frame"`
- Bowl of fruits — `360 × 360 × 190`, `model: "fruit-bowl"`
- Handphone — `80 × 160 × 14`, `model: "phone"`
- Water flask — `95 × 95 × 300`, `model: "flask"`

## Elevation and support

`elevation` is the object's bottom height above finished floor:

- floor-standing: `0`
- TV on a 500 mm console: `500`
- small object on a 760 mm table: `760`
- picture: bottom-of-frame height, commonly `900–1200`

For supported objects:

```text
upper elevation = support elevation + support height
```

Touching surfaces are valid; overlapping volumes are not.

## Placement rules

- Wall carpentry and known headboard walls: `mode: "wall"` with `wallId`
- Freestanding seating groups: `mode: "free"`
- Objects on furniture: `mode: "support"` with `supportId`
- Dining table and chairs: same `roomId` and `groupId`

Example:

```json
{
  "roomId": "room-living",
  "mode": "support",
  "supportId": "tv-console",
  "groupId": "living-tv-zone"
}
```
