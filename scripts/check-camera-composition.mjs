import fs from 'node:fs';

const template = JSON.parse(fs.readFileSync('schema/project-template.json', 'utf8'));
const source = fs.readFileSync('app-parts/44.js', 'utf8');
const shots = fs.readFileSync('app-parts/39.js', 'utf8');
const exporter = fs.readFileSync('app-parts/42.js', 'utf8');
const planner = fs.readFileSync('gpt/BTO-Layout-Planner-Instructions.md', 'utf8');
const workflow = fs.readFileSync('gpt/BTO-Layout-Planning-Workflow.md', 'utf8');

if(template.meta?.appVersion !== '3.0')throw new Error('Template must identify Layout Planner/Studio V3');
if(template.cameraPlan?.candidateCount !== 12)throw new Error('Template candidateCount must be 12');
if(template.cameraPlan?.finalShotCount !== 8)throw new Error('Template finalShotCount must be 8');
if(template.cameraPlan?.visibility?.wall?.preferredMm !== 3000)throw new Error('Wall preference must be 3000 mm');
if(template.cameraPlan?.visibility?.furniture?.preferredMm !== 1500)throw new Error('Furniture preference must be 1500 mm');

for(const [label, text, tokens] of [
  ['composition module', source, [
    'const cameraCandidateCountV90 = 12',
    'const cameraFinalShotCountV90 = 8',
    'cameraCompositionDepthOptionsV90',
    'scoreLocalPreviewV90',
    'candidateSimilarityPenaltyV90',
    'candidate.allowCameraInHiddenFurniture !== false',
    'project.cameraShots = selected.map'
  ]],
  ['shot application', shots, ['normaliseShotVisibilityV90', 'visibility.wall.depthMm', 'compositionRank']],
  ['camera/depth exporter', exporter, ['cameraComposition:', 'compositionScore:', 'visibility: shot.visibility']],
  ['Planner V3 instructions', planner, ['exactly 12 valid, unique', 'exactly the best 8']],
  ['Planner V3 workflow', workflow, ['exactly 12 unique camera candidates', 'exactly the best 8']]
]){
  for(const token of tokens){
    if(!text.includes(token))throw new Error(`${label} is missing required invariant: ${token}`);
  }
}

console.log('Planner V3 camera composition checks OK: 12 candidates → 8 final shots.');
