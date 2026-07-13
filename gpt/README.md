# Custom GPT setup

## Instructions

Paste the complete contents of `BTO-Layout-Planner-Instructions.md` into the GPT **Instructions** field. Do not upload it only as Knowledge, because it defines workflow and behaviour.

## Knowledge files

Upload:

1. `../schema/project-schema.md`
2. `../schema/project-template.json`
3. `BTO-Layout-Object-Catalog.md`
4. Any company-specific HDB planning standards or furniture-clearance guide

Replace the older object-catalogue Knowledge file whenever it changes. The current catalogue includes the L-shaped wardrobe model, `armDepth`, carpentry resize behaviour, TV console and decorative models.

Enable **Code Interpreter & Data Analysis** so the GPT can inspect ZIP or JSON projects, validate data and generate a downloadable `project.json`. Enable **Web Search** only when current product dimensions, HDB rules or sourcing information are required.

After replacing instructions or knowledge files, test the GPT in Preview with one existing project ZIP and one new floor plan before selecting **Update**.
