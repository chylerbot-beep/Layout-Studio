import fs from 'node:fs';
import vm from 'node:vm';

const loader = fs.readFileSync('app-loader.js', 'utf8');
const match = loader.match(/const parts\s*=\s*(\[[\s\S]*?\]);/);
if(!match)throw new Error('Could not find the app part list in app-loader.js');

const parts = [...match[1].matchAll(/['"]([^'"]+\.js)['"]/g)].map(item => item[1]);
if(!parts.length)throw new Error('No app parts were found in app-loader.js');

const missing = parts.filter(path => !fs.existsSync(path));
if(missing.length)throw new Error(`Missing app parts: ${missing.join(', ')}`);

const boundaryPart = 'app-parts/43.js';
const boundaryIndex = parts.indexOf(boundaryPart);
const exportIndex = parts.indexOf('app-parts/42.js');
const startupIndex = parts.indexOf('app-parts/08.js');
if(boundaryIndex < 0 || boundaryIndex <= exportIndex || boundaryIndex >= startupIndex){
  throw new Error(`${boundaryPart} must load after camera/depth export and before startup`);
}

const source = parts.map(path => fs.readFileSync(path, 'utf8')).join('\n');
new vm.Script(source, {filename:'layout-studio.bundle.js'});

const markup = fs.readFileSync('index.html', 'utf8');
const retiredImageHandoffTokens = [
  'headerRenderHandoff',
  'workflowRenderHandoff',
  'Image handoff'
];
for(const token of retiredImageHandoffTokens){
  if(markup.includes(token) || loader.includes(token) || source.includes(token)){
    throw new Error(`Retired image handoff control is still bundled: ${token}`);
  }
}

const boundarySource = fs.readFileSync(boundaryPart, 'utf8');
for(const token of [
  "project.settings.photoBoundaryLines = false",
  "setPhotoBoundaryVisibilityV85(ensurePhotoBoundarySettingsV85())",
  "setPhotoBoundaryVisibilityV85(false)"
]){
  if(!boundarySource.includes(token)){
    throw new Error(`Photo boundary export invariant is missing: ${token}`);
  }
}

console.log(`Bundle syntax OK: ${parts.length} parts, ${source.length} characters.`);
