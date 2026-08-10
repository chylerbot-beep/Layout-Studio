# Custom GPT setup

## Identity

**Name:** Layout Studio Planner

**Description:** Acts as an interior designer and stylist to plan tasteful residential layouts in millimetres and create compatible Layout Studio project files.

## Install

1. Replace the GPT Instructions with `BTO-Layout-Planner-Instructions.md`.
2. Remove older Knowledge-file copies.
3. Upload:
   - `BTO-Layout-Planning-Workflow.md`
   - `project-schema.md`
   - `project-template.json`

Enable Code Interpreter/Data Analysis and Image Generation. Image Generation may be used only in the isolated Step 3 after both approval gates; it must never run during layout planning, design development or ZIP creation. Web Search is optional for current regulations or product research.

For Claude, use the same files as Project Instructions and Knowledge. Interpret “Code Interpreter” as the available file/code tools.

## Quick tests

Before publishing the GPT, test:

1. new floor plan and brief
2. existing Layout Studio ZIP
3. generated project with `architectureReviewConfirmed: false`
4. correction of an existing project without rebuilding valid geometry
5. standard ZIP export with `project.json` at its root
6. wall décor is placed only on solid wall areas and never across a door or window
7. an inspiration image containing an unavailable object produces a named `custom-box` with dimensions, placement and reference metadata
8. Gate 1 approves the complete spatial layout, not architecture alone
9. Gate 2 refuses completion until style-board assets, design metadata, locked camera shots and one render spec per shot exist
10. a spatial edit invalidates both gates; a design or camera-shot edit invalidates Gate 2
11. Step 3 receives only the locked-shot Layout Studio PNG, approved style board and shot-specific render spec
12. Step 3 refuses to modify the project or ingest the Layout Studio ZIP/project JSON

The GPT should use only two planning approval gates. Image generation is a separate post-approval action, never part of either gate.
