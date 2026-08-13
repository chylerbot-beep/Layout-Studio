# Layout Studio Planning Workflow

Use this workflow for new plans, project corrections and layout validation. It has exactly two approval gates and three clearly separated steps:

1. **Layout planning** → Gate 1 layout approval.
2. **Design development and complete Layout Studio ZIP** → Gate 2 design approval.
3. **Image generation only**, as a separate post-approval action.

Never generate an image during Step 1 or Step 2. Never let Step 3 reopen or modify the layout or design.

## 1. Gather only essential inputs

Ask for missing information that affects the layout:

- floor plan and reliable printed dimensions
- property type when it affects plan conventions, structural constraints or ceiling height
- occupants and room uses
- walls that may be hacked or opened
- required beds, TV, dining capacity, work areas and storage
- renovation constraints and inspiration images

Use printed dimensions and project data. Do not derive authoritative millimetres from screenshot pixels.

Do not assume the home's property type. Clarify it when it materially affects the plan. If an HDB ceiling height is not documented, use 2,600 mm as the working default and state that assumption; confirm the height for other property types.

## Step 1 — Layout planning and approval

### Reconstruct architecture

1. Confirm orientation and scale. If Layout Studio will calibrate a new basemap, identify one clear horizontal printed dimension for its ruler.
2. Reconstruct walls in millimetres.
3. Add doors and windows with valid `wallId` and `offset` values.
4. Preserve the household shelter and other fixed or non-hackable elements. Represent a shelter with walls and openings, not a second room-sized solid shell block.
5. Mark assumptions and distinguish retained, proposed and uncertain work.
6. Check endpoints, thicknesses, opening offsets and room adjacency.
7. Present one top-down architecture review.

### Architecture checkpoint — not an approval gate

Present the reconstructed architecture and resolve walls, openings, fixed shell, proposed hacked walls and dimensional assumptions as part of Step 1. Continue into furniture planning before requesting Gate 1 approval. Do not create a separate architecture approval gate.

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

### Complete the spatial layout

Use inspiration images for design language—materials, colour, furniture character, lighting and visual density—without forcing objects into unsuitable spaces.

Work as both an interior designer and interior stylist: resolve function, scale and circulation first, then add a restrained layer of materials, lighting and decoration that supports the concept.

### Translate inspiration images

For each inspiration image or mood board:

1. Identify the overall design language, materials, colours, lighting character and visual density.
2. Identify only spatially relevant objects: furniture, built-in carpentry, substantial decoration and fixtures that affect the plan or elevations.
3. Keep finishes, atmosphere and purely visual references in the notes; do not turn them into collision boxes.
4. Reuse native basic objects when they match: sofa, dining table or chair, lounge chair, coffee table, console, king or queen bed, full-height wardrobe, kitchen cabinets, worktop, settee and TV console. Omit `model` for these editable basic forms.
5. Use a native specialist model when appropriate: `plant`, `tv`, `picture-frame`, `fruit-bowl`, `phone`, `flask`, `glass-blocks` or `l-wardrobe`.
6. If no native option fits, create a `custom-box` with a descriptive name, valid category, explicit dimensions, placement metadata and `custom: true`.
7. Record the source image and what was identified in `reference`. Use `confidence` to distinguish clear identification from interpretation.
8. Treat dimensions inferred from an image as assumptions and adapt them to the authoritative floor plan, circulation and physical constraints.

Example custom element:

```json
{
  "id": "custom-entry-fluted-panel",
  "name": "Entry fluted feature panel",
  "category": "carpentry",
  "model": "custom-box",
  "custom": true,
  "description": "Full-height timber fluted feature panel",
  "x": 10500,
  "y": 7200,
  "w": 1200,
  "d": 80,
  "h": 2600,
  "elevation": 0,
  "rotation": 90,
  "color": 11185874,
  "placement": {
    "roomId": "room-entry",
    "mode": "wall",
    "wallId": "wall-entry-east",
    "gap": 0
  },
  "reference": {
    "image": "mood-board-2.jpg",
    "description": "Fluted panel behind the console",
    "confidence": "high"
  }
}
```

Custom elements remain simple, editable bounding boxes so Layout Studio can label, align, resize and validate them. Use a few grouped custom boxes with a shared `groupId` only when a built-in needs more than one rectangular part. Never generate executable code or external 3D assets.

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

### Gate 1 — Layout approval

Obtain approval for the complete spatial plan:

- walls, openings, retained and hacked architecture
- room uses and zoning
- furniture and built-in footprints, sizes and orientations
- circulation, door access and clearances
- all dimensional assumptions and unresolved spatial warnings

Gate 1 approves layout only. Do not render, source products or develop new visual concepts in this gate. Store the approval in `workflow.approvals.layout`; record a layout fingerprint when tools support it. A later spatial change invalidates Gate 1 and Gate 2.

## Step 2 — Design development and complete Layout Studio ZIP

Starting from the approved Step 1 layout, resolve the design without moving or resizing approved spatial elements. Define and store:

- the approved style board using `design.styleBoard.referenceIds`
- furniture archetypes, without claiming exact products unless supplied by the user
- material palette and finish intent
- lighting direction and fixture metadata
- major styling objects and styling density
- one shot-specific render spec for every camera shot

If design development reveals a spatial problem, return to Step 1, change the layout and obtain Gate 1 approval again. Do not silently redesign the approved layout inside Step 2.

### Generate 12 candidates and select the best 8

Planner V3 must first create exactly 12 unique camera candidates under `cameraPlan.candidates`. Recommend:

- Top for plan checking
- Bird's-eye for spatial understanding
- Eye level for spatial previews and exported camera screenshots

Use blocking-wall hiding only for photography. Hidden walls remain part of the model and validation. Set wall hiding to a preferred 3,000 mm within 1,800–4,500 mm, and furniture hiding to a preferred 1,500 mm within 750–2,500 mm.

The candidate set must contain meaningful hero, layered, architectural, transition and useful detail alternatives rather than near-duplicates. Normally use a level 1,350–1,550 mm eye height and 35–45° vertical FOV. Every candidate identifies its hero objects, photographic role, framing intent, wall/furniture penetration permissions and candidate-specific render spec. Camera placement within or behind nearby furniture is allowed by default when Studio's selected furniture-hide distance removes that exact object; set `allowCameraInHiddenFurniture: false` only for an object that must never be penetrated.

Create an interim V3 candidate ZIP while `workflow.stage` is `design-development`; this is the one permitted pre-Gate-2 project package. Layout Studio evaluates all 12 candidates locally using projected geometry, visibility, occlusion, depth, balance, negative space, perspective, hiding penalties and a small browser-rendered preview. It writes exactly the best 8 into `cameraShots`, including each shot's exact auto-hide distances, resolved hidden IDs, composition score and rank.

Review those eight shots in Layout Studio. Save every approved final camera in `cameraShots`; Gate 2 locks the exact eight-shot list, position, target, lens, framing and per-shot visibility. Manual camera movement is not a substitute for a locked shot. Ranking or editing a camera invalidates Gate 2.

Photo mode keeps a floating Camera panel available. Nearby furniture can be hidden automatically by camera distance, or selected furniture can be hidden and shown manually. Camera visibility settings never delete or resize project objects.

Each candidate carries its provisional render spec. When Studio selects the best eight, it copies only those eight specs into `design.shotRenderSpecs[]`. Every final entry must reference one `cameraShots[].id`, state the shot's render intent and allowed surface-level interpretation, and carry a policy that forbids layout changes, design changes, new objects and sourcing.

### Gate 2 — Design approval

Obtain approval for the style board, furniture archetypes, materials, lighting, styling, shot contents, camera shots and shot-specific render specs. On approval:

- set `workflow.approvals.design.status` to `approved`
- set `workflow.stage` to `design-approved`
- lock layout, design and camera shots
- invalidate Gate 2 if any approved design metadata, object appearance, visibility setting or camera shot later changes

### Create the complete Layout Studio handoff

Only after Gate 2, create:

- `project.json`
- concise notes
- standard ZIP with `project.json` at the root
- layout rationale, assumptions and warnings
- a list of custom elements, their source images and assumed dimensions
- approved style-board references
- furniture-archetype, material, lighting and styling metadata
- ranked and locked `cameraShots` containing exactly the best 8 of the 12 Planner candidates
- one render spec per camera shot

Validate before delivery:

- unique IDs
- positive dimensions and walls at least 200 mm long
- valid opening, placement, support and cutaway references
- valid categories, models and placement modes
- non-negative elevations
- `settings.architectureReviewConfirmed: false`
- both workflow approvals are present and current
- `workflow.locks.layout`, `workflow.locks.design` and `workflow.locks.cameraShots` are `true`
- every selected style-board reference exists in the ZIP
- every camera shot has a matching `design.shotRenderSpecs` entry
- `cameraPlan.candidates` contains exactly 12 valid unique candidates
- `cameraPlan.results` and `cameraShots` contain exactly 8 ranked final shots before Gate 2 is approved

When file tools are available, parse `project.json`, create the ZIP, reopen it and parse its root `project.json`. Provide the JSON separately as well.

The Step 2 ZIP is Layout Studio's source of truth. If inspection reveals a spatial or design issue, return to the applicable earlier step, update the project, reapprove the invalidated gate and export a new ZIP.

## Step 3 — Image generation only

Run image generation as a completely separate post-approval action. For one camera shot at a time, give the image generator only:

1. the PNG exported from that exact locked Layout Studio camera
2. the approved style-board image assets
3. that shot's isolated render spec

Do not give the image generator the planning conversation, Layout Studio ZIP, project JSON, sourcing notes, alternatives or unresolved design discussion.

The renderer may interpret only surface detail explicitly allowed by the shot spec, such as exact fabric weave or wood grain within the approved style board. It must not change the camera, crop, architecture, openings, floor zones, ceiling, furniture, built-ins, lighting-fixture positions or major styling-object positions. It must not add or remove objects, source products, re-plan or redesign.

If the render exposes a problem, do not repair it inside Step 3. Return to Step 1 or Step 2, update Layout Studio, obtain any invalidated approval again, export a new camera PNG and rerun Step 3.
