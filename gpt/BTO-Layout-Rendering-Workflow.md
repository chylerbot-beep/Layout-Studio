# Layout Studio Rendering Workflow

This file teaches the Custom GPT how to turn approved Layout Studio screenshots into photorealistic interior images without changing the approved layout.

## Rendering handoff package

Preferred inputs for each camera view:

1. `camera-view.png` exported from Layout Studio
2. latest `project.json` or project ZIP
3. relevant reference interior images
4. room name and requested mood
5. optional top-view screenshot

The eye-level camera PNG is the binding composition reference. The project JSON is the binding dimensional reference. Inspiration images are the binding aesthetic reference.

## Best screenshot preparation

Before exporting from Layout Studio:

- use Eye level view
- position camera around 1450–1650 mm unless another viewpoint is intended
- set a believable interior FOV, usually around 50–70 degrees
- hide blocking walls only when a wall blocks the desired photograph
- turn off validation outlines
- turn off labels for the cleanest source image, or use eye-level label cleanup
- hide grids, clearance zones, selection handles and transform controls
- confirm the door, window and furniture arrangement in the frame

The GPT must still remove any interface remnants that remain in the screenshot.

## Reference hierarchy

### 1. Camera screenshot controls geometry and composition
Preserve:
- camera angle and crop
- perspective
- visible wall planes
- ceiling height and visible beams or bulkheads
- doors, windows and openings
- furniture and carpentry positions
- furniture orientation and massing
- circulation gaps

### 2. Project JSON controls dimensions and object identity
Use it to verify:
- exact object dimensions
- wall and opening relationships
- ceiling height
- object elevation
- room assignment
- objects partly hidden in the screenshot

### 3. Inspiration images control styling
Use them for:
- materials and colours
- furniture detailing
- lighting
- curtains and rugs
- artwork, plants and decorative objects
- photographic mood

Never let an inspiration image change the approved floor-plan geometry.

## Blocking-wall interpretation

A hidden foreground wall is a camera aid. It does not automatically mean the wall was hacked.

For the final image:
- keep the photographic view opened by the hidden blocking wall
- do not show a translucent construction wall in the final render
- do not invent a permanent opening unless the project or brief confirms one
- do not alter other walls to compensate

## Block-to-real-object conversion

Replace simplified Layout Studio masses with realistic objects while preserving bounding dimensions.

Examples:
- sofa block → realistic sofa with approximately the same width, depth and position
- oval dining-table block → realistic oval table with the same footprint
- wardrobe block → full-height carpentry following the same wall run
- kitchen cabinets → realistic upper/lower cabinetry within the same runs
- TV console and TV → realistic objects at the same elevation and centreline
- glass-block block → glass-block screen with the same extent

Small changes to upholstery thickness, legs and edge profiles are acceptable. Changing the total footprint or moving the object is not.

## Screenshot elements that must not appear in the render

Remove or ignore:
- labels
- red validation outlines
- yellow detected-wall outlines
- blue wall-selection overlays
- transform arrows and rotation rings
- resize handles
- grid lines
- clearance zones
- basemap drawing
- UI panels, buttons and status messages

## Prompt assembly template

Use this internal structure when preparing a render request:

```text
Create a photorealistic architectural interior photograph from the supplied Layout Studio camera screenshot.

BINDING SPATIAL REFERENCE
- Preserve the screenshot's exact camera angle, composition, perspective and major geometry.
- Preserve all visible wall, ceiling, door and window positions.
- Preserve furniture and carpentry placement, orientation, count and approximate bounding dimensions.
- Do not invent or remove openings or move major objects.

PROJECT DATA
- Use the attached project JSON for millimetre dimensions, object identity, ceiling height and hidden spatial relationships.

AESTHETIC REFERENCE
- Apply the supplied reference images to materials, colours, furniture detailing, lighting and styling only.
- Geometry takes priority over aesthetics.

CLEANUP
- Remove all Layout Studio labels, outlines, grids, controls and UI remnants.

PHOTOGRAPHY
- Realistic interior photography, natural material detail, believable lighting and lens behaviour.
```

Then add room-specific material and styling instructions derived from the references.

## Geometry-drift review

After generation, compare the output with the Layout Studio screenshot and check:

- Is the camera angle unchanged?
- Are the same walls and openings visible?
- Is the number of windows and doors unchanged?
- Are sofa, table, chairs, beds, TV and carpentry in the same places?
- Is the dining capacity preserved?
- Are major circulation gaps still visible?
- Did the generator invent another room or corridor?

Regenerate when a material spatial change occurs.

## When to return to Layout Studio

Do not paint a structural planning change into the render. Return to Layout Studio first when the user asks to:

- move or remove a wall
- add or relocate a door or window
- change room zoning
- move major furniture or carpentry
- change dining capacity
- change kitchen configuration
- resize beds, wardrobes, islands or major circulation routes

After the Layout Studio screenshot is updated, continue Rendering Mode from the new approved camera view.

## Suggested rendering conversation starters

- Turn this approved Layout Studio screenshot into a photorealistic interior without changing its geometry.
- Apply these reference images to this camera view while preserving the approved layout.
- Compare this screenshot with the project JSON, then render the room.
- Revise only the materials and lighting; keep the camera and furniture positions unchanged.
- Create a second photorealistic view from this new approved Layout Studio camera screenshot.
