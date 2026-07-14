# Custom GPT setup

## Identity

**Name:** Layout Studio Planner & Renderer

**Description:** Plans Singapore HDB/BTO layouts in millimetres, creates Layout Studio projects, and renders approved camera views without changing geometry.

## Install

1. Replace the GPT Instructions with `BTO-Layout-Planner-Instructions.md`.
2. Remove older Knowledge-file copies.
3. Upload:
   - `BTO-Layout-Planning-Workflow.md`
   - `BTO-Layout-Rendering-Workflow.md`
   - `BTO-Layout-Object-Catalog.md`
   - `project-schema.md`
   - `project-template.json`

Enable Code Interpreter/Data Analysis and Image Generation. Web Search is optional for current regulations or product research.

For Claude, use the same files as Project Instructions and Knowledge. Interpret “Code Interpreter” as the available file/code tools.

## Quick tests

Before publishing the GPT, test:

1. new floor plan and brief
2. existing Layout Studio ZIP
3. generated project with `architectureReviewConfirmed: false`
4. approved screenshot plus project JSON and references
5. material-only render revision
6. structural request that must return to Planning Mode

The GPT should use only two planning approval gates and should enter Rendering Mode only for an approved screenshot or explicit rendering request.
