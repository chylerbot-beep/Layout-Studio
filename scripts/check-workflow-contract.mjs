import fs from 'node:fs';
import vm from 'node:vm';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const loader = fs.readFileSync('app-loader.js', 'utf8');
const workflowSource = fs.readFileSync('app-parts/40.js', 'utf8');
const packageSource = fs.readFileSync('app-parts/09.js', 'utf8');
const plannerInstructions = fs.readFileSync('gpt/BTO-Layout-Planner-Instructions.md', 'utf8');
const plannerWorkflow = fs.readFileSync('gpt/BTO-Layout-Planning-Workflow.md', 'utf8');
const schema = fs.readFileSync('schema/project-schema.md', 'utf8');
const template = JSON.parse(fs.readFileSync('schema/project-template.json', 'utf8'));

new vm.Script(workflowSource, {filename: 'app-parts/40.js'});

const workflowIndex = loader.indexOf("'app-parts/40.js'");
const startupIndex = loader.indexOf("'app-parts/08.js'");
assert(workflowIndex >= 0, 'app-parts/40.js is missing from app-loader.js');
assert(startupIndex >= 0, 'app-parts/08.js is missing from app-loader.js');
assert(workflowIndex < startupIndex, 'The workflow module must load before app startup');

assert(template.meta.appVersion === '2.8', 'The project template must use schema/app version 2.8');
assert(template.workflow?.approvals?.layout?.status === 'pending', 'Gate 1 must default to pending');
assert(template.workflow?.approvals?.design?.status === 'pending', 'Gate 2 must default to pending');
assert(template.workflow?.locks?.layout === false, 'Layout must not default to locked');
assert(template.workflow?.locks?.design === false, 'Design must not default to locked');
assert(template.workflow?.locks?.cameraShots === false, 'Camera shots must not default to locked');
assert(Array.isArray(template.design?.shotRenderSpecs), 'The template must include shotRenderSpecs');

[
  'layoutFingerprintV75',
  'designFingerprintV75',
  "status = 'changes-required'",
  'approveLayoutV75',
  'approveDesignV75',
  'designReadinessIssuesV75',
  'image-generation-only',
  'projectZipAllowed: false',
  'canModifyLayout: false',
  'canModifyDesign: false',
  'canAddObjects: false',
  'canSourceProducts: false',
  "zip.file(pngName, pngBlob)",
  "zip.file('render-spec.json'"
].forEach(token => assert(workflowSource.includes(token), `Workflow token is missing: ${token}`));

const renderExportStart = workflowSource.indexOf('async function exportRenderHandoffV75');
const renderExportEnd = workflowSource.indexOf('function openRenderHandoffV75', renderExportStart);
const renderExport = workflowSource.slice(renderExportStart, renderExportEnd);
assert(renderExportStart >= 0 && renderExportEnd > renderExportStart, 'Could not inspect the Step 3 exporter');
assert(!renderExport.includes("zip.file('project.json'"), 'Step 3 must not export project.json');
assert(!renderExport.includes("zip.file('manifest.json'"), 'Step 3 must not export the Layout Studio manifest');
assert(!renderExport.includes('portable'), 'Step 3 must not clone or package project data');

[
  'formatVersion:2',
  "designFile:'design/design-spec.json'",
  "renderSpecDirectory:'render-specs/'",
  "zip.file('project.json'",
  "zip.file('design/design-spec.json'",
  'portable.design?.shotRenderSpecs'
].forEach(token => assert(packageSource.includes(token), `Step 2 ZIP token is missing: ${token}`));

[
  'exactly two approval gates',
  'Layout (end of Step 1)',
  'Design (end of Step 2)',
  'Image generation — separate Step 3 only',
  'project JSON, Layout Studio ZIP'
].forEach(token => assert(plannerInstructions.includes(token), `Planner instruction is missing: ${token}`));

[
  'Step 1 — Layout planning and approval',
  'Gate 1 — Layout approval',
  'Step 2 — Design development and complete Layout Studio ZIP',
  'Gate 2 — Design approval',
  'Step 3 — Image generation only',
  'Do not give the image generator the planning conversation'
].forEach(token => assert(plannerWorkflow.includes(token), `Planner workflow token is missing: ${token}`));

[
  'Layout Studio project schema v2.8',
  'Workflow approvals and locks',
  'Approved design metadata',
  'projectZipAllowed: false',
  'A Step 3 handoff contains no project JSON'
].forEach(token => assert(schema.includes(token), `Schema token is missing: ${token}`));

console.log('Two-gate planning/design workflow and isolated Step 3 contract checks OK.');
