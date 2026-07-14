import fs from 'node:fs';
import vm from 'node:vm';

function assert(condition, message){
  if(!condition)throw new Error(message);
}

const loader = fs.readFileSync('app-loader.js', 'utf8');
const source = fs.readFileSync('app-parts/29.js', 'utf8');

new vm.Script(source, {filename:'app-parts/29.js'});

const moduleIndex = loader.indexOf("'app-parts/29.js'");
const startupIndex = loader.indexOf("'app-parts/08.js'");
assert(moduleIndex >= 0, 'app-parts/29.js is missing from app-loader.js');
assert(startupIndex >= 0, 'app-parts/08.js is missing from app-loader.js');
assert(moduleIndex < startupIndex, 'app-parts/29.js must load before app-parts/08.js');

[
  'basemapRegistrationV50',
  'detectWalls = function',
  'detectDoorsV32 = function',
  'Keep JSON',
  'Apply suggestion',
  'applyHighConfidenceArchitectureSuggestionsV50',
  'scaleCalibrationRequired',
  'basemapReviewMode',
  'remain unreviewed',
  'JSON geometry: authoritative'
].forEach(token => {
  assert(source.includes(token), `Required architecture-review token is missing: ${token}`);
});

assert(
  source.includes('collectWallSuggestionsV50') &&
  source.includes('collectDoorSuggestionsV50'),
  'Detection must populate suggestions rather than apply geometry directly'
);
assert(
  source.includes("suggestion.status = 'applied'"),
  'Suggestion application must be explicit and stateful'
);
assert(
  source.includes("suggestion.status = 'kept'"),
  'The Keep JSON action is missing'
);

console.log('Non-destructive architecture review checks OK.');
