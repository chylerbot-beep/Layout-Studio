# BTO Layout Studio Object Catalogue

Use these exact names, categories and `model` values when generating project JSON for BTO Layout Studio. All dimensions are millimetres and remain editable.

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
- Kitchen lower cabinets — 2400 × 600 × 870
- Kitchen upper cabinets — 2400 × 350 × 750
- Kitchen worktop — 2400 × 650 × 920
- Settee — 1600 × 550 × 480
- TV console — 1800 × 450 × 500

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
