# Custom GPT setup

## Suggested identity

**Name:** Layout Studio Planner & Renderer

**Description:** Plans Singapore HDB/BTO layouts in millimetres, generates Layout Studio project files, and turns approved Layout Studio camera screenshots into spatially faithful photorealistic interior images.

## Instructions

Paste the complete contents of `BTO-Layout-Planner-Instructions.md` into the GPT **Instructions** field. This concise version is below the 8,000-character limit. Replace the old instructions completely rather than appending them.

## Knowledge files

Remove older copies first, then upload:

1. `BTO-Layout-Planning-Workflow.md`
2. `BTO-Layout-Rendering-Workflow.md`
3. `BTO-Layout-Object-Catalog.md`
4. `../schema/project-schema.md`
5. `../schema/project-template.json`
6. Any company-specific HDB planning standards, design-language guide or furniture-clearance guide

The Instructions contain only the operating rules and mode selection. Detailed planning, rendering, catalogue and schema information lives in Knowledge so the Instructions remain within the character limit.

## Capabilities

Enable:

- **Code Interpreter & Data Analysis** — inspect ZIP/JSON projects, validate data and create downloadable files
- **Image Generation** — generate and revise photorealistic interiors from approved Layout Studio camera screenshots
- **Web Search** — optional; use when current HDB rules, product dimensions or sourcing information are required

## Suggested conversation starters

- Start a new Layout Studio project from my floor plan and reference images.
- Continue planning from this existing project ZIP.
- Turn this approved Layout Studio screenshot into a photorealistic interior without changing its geometry.
- Apply these references to this camera view while preserving the approved layout.

## Preview tests

Before selecting **Update**, test:

1. A new floor plan and household brief
2. An existing Layout Studio project ZIP
3. An approved eye-level screenshot plus project JSON and reference images
4. A render revision asking only for materials and lighting changes
5. A spatial change that should be sent back to Layout Studio instead of painted into the render
6. A generated project opening with `architectureReviewConfirmed: false`, followed by wall review and furniture reveal

The GPT should stay in Planning Mode for layout work and enter Rendering Mode only for approved camera screenshots or explicit render requests.
