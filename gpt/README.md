# Custom GPT setup

## Identity

**Name:** Layout Studio Planner

**Description:** Acts as an interior designer and stylist to plan tasteful residential layouts in millimetres and create compatible Layout Studio project files.

## Install

1. Replace the GPT Instructions with `BTO-Layout-Planner-Instructions.md`.
2. Remove older Knowledge-file copies.
3. Upload:
   - `BTO-Layout-Planning-Workflow.md`
   - `BTO-Layout-Object-Catalog.md`
   - `project-schema.md`
   - `project-template.json`

Enable Code Interpreter/Data Analysis. Image Generation is not required. Web Search is optional for current regulations or product research.

For Claude, use the same files as Project Instructions and Knowledge. Interpret “Code Interpreter” as the available file/code tools.

## Quick tests

Before publishing the GPT, test:

1. new floor plan and brief
2. existing Layout Studio ZIP
3. generated project with `architectureReviewConfirmed: false`
4. correction of an existing project without rebuilding valid geometry
5. standard ZIP export with `project.json` at its root
6. wall décor is placed only on solid wall areas and never across a door or window

The GPT should use only two planning approval gates and remain focused on planning, validation and Layout Studio project-file creation.
