import fs from 'node:fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const source = fs.readFileSync('app-parts/26.js', 'utf8');
const start = source.indexOf('function applyScaleCalibrationV33()');
const end = source.indexOf('function startScaleDragV33', start);

assert(start >= 0 && end > start, 'Could not inspect ruler scale application');

const applyScaleSource = source.slice(start, end);
assert(
  !applyScaleSource.includes('project.basemap.crop ='),
  'Applying ruler scale must preserve the current basemap crop'
);
assert(
  applyScaleSource.includes('applyCalibratedBasemapSizeV33()'),
  'Applying ruler scale must still update the calibrated basemap size'
);

console.log('Basemap ruler calibration preserves the visible crop.');
