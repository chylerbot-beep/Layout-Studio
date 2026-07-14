# Layout Studio Rendering Workflow

Use this workflow to turn an approved Layout Studio camera view into a photorealistic interior without changing its layout.

## Required handoff

Prefer:

1. approved camera PNG
2. latest project JSON or ZIP
3. relevant inspiration images
4. room name and requested mood
5. optional top view

Authority order:

1. Camera PNG controls camera, crop, perspective and visible composition.
2. Project data controls dimensions, object identity, elevation and hidden relationships.
3. Inspiration images control materials, colours, lighting and styling.

Geometry always overrides aesthetics.

## Prepare the source view

Before export, prefer Eye level with a believable interior lens. Photo mode keeps the Camera panel available for FOV/lens, height, blocking-wall and furniture-visibility adjustments. Hide only genuinely blocking foreground walls or furniture. Turn off labels, validation, grid, clearances, basemap, selection handles and transform controls when possible.

The rendering step must remove any UI remnants that remain.

## Rendering contract

Preserve:

- camera angle, crop and perspective
- visible wall and ceiling planes
- doors, windows and openings
- furniture and carpentry count, position, orientation and approximate bounds
- circulation gaps and dining capacity

Convert blocks into realistic objects while keeping their overall footprint and location. Small detailing changes—legs, edge profiles and upholstery thickness—are acceptable. Moving or materially resizing an object is not.

Use inspiration references only for:

- materials and colours
- furniture detailing
- lighting
- curtains, rugs, art, plants and small decoration
- photographic mood

Do not show:

- labels or UI
- red review or validation outlines
- blue selection overlays
- transform or resize handles
- grids, clearances or basemap graphics

A hidden blocking wall or furniture object is a camera aid. Do not interpret it as deleted or hacked unless the project or brief confirms that change.

## Compact prompt recipe

```text
Create a photorealistic interior from the approved Layout Studio camera screenshot.

Preserve the exact camera, crop, perspective, visible architecture, object count,
placement, orientation and approximate dimensions. Use project JSON for millimetres
and identity. Apply references only to materials, colours, lighting and styling.
Remove all Layout Studio UI, labels, outlines, grids and controls.
```

Add only room-specific material and mood instructions after this contract.

## Geometry-drift check

Compare the result with the approved screenshot:

- same camera and visible walls
- same doors and windows
- same major furniture and carpentry positions
- same object count and dining capacity
- same important circulation gaps
- no invented room or corridor

Regenerate when drift is material. Do not rationalise an incorrect image.

## Return to Planning Mode when needed

Make spatial changes in Layout Studio first, including:

- moving or removing walls
- adding or relocating doors or windows
- changing zoning, dining capacity or kitchen configuration
- moving or resizing major furniture or carpentry

Continue rendering from a newly approved screenshot after the project is updated.
