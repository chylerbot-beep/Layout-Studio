// Non-destructive calibrated-basemap review.
//
// This module loads after app-parts/28.js and before app-parts/08.js.
// JSON wall/opening geometry remains authoritative. The calibrated basemap scan
// produces review suggestions only; geometry changes require an explicit user action.

let architectureSuggestionsV50 = [];
let architectureSuggestionIndexV50 = 0;
let architectureSuggestionMetaV50 = {
  unmatchedWalls: 0,
  skippedDoorPairs: 0,
  rejectedMarks: 0
};

const architectureSuggestionOverlayV50 = new THREE.Group();
architectureSuggestionOverlayV50.name = 'architecture-suggestion-overlay-v50';
scene.add(architectureSuggestionOverlayV50);

function hasAuthoredArchitectureV50(){
  return !!(
    (project.walls || []).length ||
    (project.openings || []).length ||
    (project.rooms || []).length ||
    (project.shell || []).some(item => item.fixed !== false)
  );
}

function basemapRegistrationV50(){
  if(project.settings?.basemapReviewMode === 'json-only'){
    return {registered:false, mode:'json-only', message:'JSON-only mode · basemap comparison disabled'};
  }
  const basemap = project.basemap;
  const crop = basemap?.crop;
  const calibration = basemap?.scaleCalibration;
  const validCrop = !!(
    crop &&
    Number.isFinite(+crop.left) &&
    Number.isFinite(+crop.top) &&
    Number.isFinite(+crop.right) &&
    Number.isFinite(+crop.bottom) &&
    +crop.right > +crop.left &&
    +crop.bottom > +crop.top
  );
  const validCalibration = !!(
    basemap &&
    +basemap.scaleMmPerPixel > 0 &&
    calibration &&
    +calibration.knownMm >= 100 &&
    calibration.a &&
    calibration.b
  );
  if(project.settings?.scaleCalibrationRequired || !validCrop || !validCalibration){
    return {
      registered:false,
      mode:'unregistered',
      message:'Basemap unregistered · set scale before scanning'
    };
  }
  const fullImage = (
    Math.abs(+crop.left) < .001 &&
    Math.abs(+crop.top) < .001 &&
    Math.abs(+crop.right - 1) < .001 &&
    Math.abs(+crop.bottom - 1) < .001
  );
  return {
    registered:true,
    mode:fullImage ? 'registered-warning' : 'registered',
    message:fullImage
      ? 'Basemap calibrated · full source image crop; verify page margins'
      : 'Basemap calibrated and cropped · JSON geometry remains authoritative'
  };
}

function confidenceRankV50(value){
  return value === 'high' ? 3 : value === 'medium' ? 2 : 1;
}

function wallCandidateGeometryV50(wall, line){
  const current = wallMetrics(wall);
  if(current.horizontal){
    return {
      x1:current.x1,
      y1:line.p,
      x2:current.x2,
      y2:line.p,
      thickness:current.thickness,
      h:wall.h
    };
  }
  return {
    x1:line.p,
    y1:current.y1,
    x2:line.p,
    y2:current.y2,
    thickness:current.thickness,
    h:wall.h
  };
}

function wallDifferenceV50(current, candidate){
  return Math.round(Math.max(
    Math.hypot(current.x1 - candidate.x1, current.y1 - candidate.y1),
    Math.hypot(current.x2 - candidate.x2, current.y2 - candidate.y2)
  ));
}

function makeWallMoveSuggestionV50(wall, line, match, source){
  const currentMetrics = wallMetrics(wall);
  const current = {
    x1:currentMetrics.x1,
    y1:currentMetrics.y1,
    x2:currentMetrics.x2,
    y2:currentMetrics.y2,
    thickness:currentMetrics.thickness,
    h:wall.h
  };
  const candidate = wallCandidateGeometryV50(wall, line);
  const differenceMm = wallDifferenceV50(current, candidate);
  if(differenceMm < 20)return null;
  const currentLength = Math.max(1, currentMetrics.length);
  const overlapRatio = Math.max(0, Math.min(1, (+match?.overlap || 0) / currentLength));
  const confidence = (
    overlapRatio >= .62 && differenceMm <= 300
      ? 'high'
      : overlapRatio >= .35 && differenceMm <= 650
        ? 'medium'
        : 'low'
  );
  return {
    id:`suggestion-wall-${wall.id}`,
    kind:'wall',
    action:'move',
    targetId:wall.id,
    label:wall.name || wall.id,
    source,
    current,
    candidate,
    differenceMm,
    confidence,
    status:'suggested'
  };
}

function makeMissingWallSuggestionV50(line, index){
  const horizontal = !!line.horizontal;
  const candidate = horizontal
    ? {
        x1:line.a,
        y1:line.p,
        x2:line.b,
        y2:line.p,
        thickness:line.thickness || Math.max(80, +$('wallThickness').value || 120),
        h:+$('wallHeight').value || 2600
      }
    : {
        x1:line.p,
        y1:line.a,
        x2:line.p,
        y2:line.b,
        thickness:line.thickness || Math.max(80, +$('wallThickness').value || 120),
        h:+$('wallHeight').value || 2600
      };
  const length = Math.hypot(candidate.x2 - candidate.x1, candidate.y2 - candidate.y1);
  return {
    id:`suggestion-wall-missing-${index}`,
    kind:'wall',
    action:'add',
    targetId:null,
    label:`Possible missing wall ${index + 1}`,
    source:'calibrated wall band',
    current:null,
    candidate,
    differenceMm:Math.round(length),
    confidence:length >= 2500 && candidate.thickness >= 90 ? 'high' : 'medium',
    status:'suggested'
  };
}

function collectWallSuggestionsV50(){
  architectureSuggestionsV50 = [];
  architectureSuggestionIndexV50 = 0;
  architectureSuggestionMetaV50 = {
    unmatchedWalls:0,
    skippedDoorPairs:0,
    rejectedMarks:0
  };

  const registration = basemapRegistrationV50();
  if(!registration.registered){
    setWallReviewStatusV32(registration.message);
    renderArchitectureSuggestionUiV50();
    return;
  }
  if(!basemapImage){
    setWallReviewStatusV32('No basemap image available · JSON geometry kept');
    renderArchitectureSuggestionUiV50();
    return;
  }

  const lines = getDetectedWallSegments(true);
  if(!lines.length){
    setWallReviewStatusV32('No reliable wall bands found · JSON geometry kept');
    architectureSuggestionMetaV50.unmatchedWalls = (project.walls || []).length;
    renderArchitectureSuggestionUiV50();
    return;
  }

  const candidates = [...(project.walls || [])];
  const usedWalls = new Set();
  const usedLines = new Set();

  lines.slice(0, 60).forEach((line, lineIndex) => {
    let best = null;
    candidates.forEach(wall => {
      if(usedWalls.has(wall.id))return;
      const match = wallLineMatchV32(wall, line);
      if(match && (!best || match.score < best.score)){
        best = {wall, ...match};
      }
    });
    if(best){
      usedWalls.add(best.wall.id);
      usedLines.add(lineIndex);
      const suggestion = makeWallMoveSuggestionV50(
        best.wall,
        line,
        best,
        'calibrated wall band'
      );
      if(suggestion)architectureSuggestionsV50.push(suggestion);
    }
  });

  // A nearby local strip is useful when the broad scan did not assign a band.
  // It remains a suggestion and never moves the wall automatically.
  candidates.forEach(wall => {
    if(usedWalls.has(wall.id))return;
    const match = typeof localStripMatch === 'function' ? localStripMatch(wall) : null;
    if(match && match.score <= 720 && match.segment){
      const current = wallMetrics(wall);
      const alongA = current.horizontal ? current.x1 : current.y1;
      const alongB = current.horizontal ? current.x2 : current.y2;
      const overlap = Math.max(
        0,
        Math.min(Math.max(alongA, alongB), match.segment.b) -
        Math.max(Math.min(alongA, alongB), match.segment.a)
      );
      const suggestion = makeWallMoveSuggestionV50(
        wall,
        match.segment,
        {overlap},
        'nearby calibrated strip'
      );
      if(suggestion){
        suggestion.confidence = confidenceRankV50(suggestion.confidence) > 2
          ? 'medium'
          : suggestion.confidence;
        architectureSuggestionsV50.push(suggestion);
        usedWalls.add(wall.id);
      }
    }
  });

  lines.slice(0, 60).forEach((line, lineIndex) => {
    if(usedLines.has(lineIndex))return;
    if(!credibleMissingWallLineV42(line, lines)){
      architectureSuggestionMetaV50.rejectedMarks++;
      return;
    }
    architectureSuggestionsV50.push(makeMissingWallSuggestionV50(line, lineIndex));
  });

  architectureSuggestionMetaV50.unmatchedWalls = candidates.filter(
    wall => !usedWalls.has(wall.id)
  ).length;

  setWallReviewStatusV32(
    `${architectureSuggestionsV50.filter(item => item.kind === 'wall').length} wall suggestions · ` +
    `${architectureSuggestionMetaV50.unmatchedWalls} authored walls need manual comparison · ` +
    'no geometry changed'
  );
  renderArchitectureSuggestionUiV50();
}

function collectDoorSuggestionsV50(){
  const registration = basemapRegistrationV50();
  if(!registration.registered || !basemapImage?.complete || !project.basemap){
    renderArchitectureSuggestionUiV50();
    return;
  }

  const analysis = makeBasemapAnalysis(true, 1400);
  const mask = analysis && makeWallMask(analysis, 195);
  if(!analysis || !mask){
    renderArchitectureSuggestionUiV50();
    return;
  }

  const detected = doorGapPairsV32(analysis, mask.gray);
  (project.walls || []).forEach(wall => {
    detected.push(...sampleDoorGapsForWallV32(wall, analysis, mask.gray));
  });

  const unique = [];
  detected
    .sort((a, b) => Number(b.pair) - Number(a.pair) || b.score - a.score)
    .forEach(candidate => {
      const centre = doorCandidateCentreV32(candidate);
      if(!centre)return;
      const duplicate = unique.some(item => {
        const other = doorCandidateCentreV32(item);
        return other && Math.hypot(other.x - centre.x, other.y - centre.y) < 450;
      });
      if(!duplicate)unique.push(candidate);
    });

  const doors = (project.openings || []).filter(item => item.type === 'door');
  const usedDoors = new Set();

  unique.forEach((candidate, index) => {
    // Joining split wall pairs changes authoritative topology. Keep those for
    // manual review rather than creating an automatic apply action.
    if(candidate.pair){
      architectureSuggestionMetaV50.skippedDoorPairs++;
      return;
    }
    const wall = (project.walls || []).find(item => item.id === candidate.wallId);
    if(!wall)return;
    const metrics = wallMetrics(wall);
    const candidateCentre = {
      x:metrics.x1 + metrics.ux * candidate.offset,
      y:metrics.y1 + metrics.uy * candidate.offset
    };
    const width = Math.round(candidate.width);
    const offset = Math.max(
      width / 2 + 25,
      Math.min(metrics.length - width / 2 - 25, candidate.offset)
    );

    let best = null;
    doors.forEach(door => {
      if(usedDoors.has(door.id))return;
      const currentCentre = doorWorldCentreV32(door);
      if(!currentCentre)return;
      const distance = Math.hypot(
        currentCentre.x - candidateCentre.x,
        currentCentre.y - candidateCentre.y
      );
      if(distance < 1500 && (!best || distance < best.distance)){
        best = {door, distance};
      }
    });

    if(best){
      usedDoors.add(best.door.id);
      const current = {
        wallId:best.door.wallId,
        offset:+best.door.offset || 0,
        width:+best.door.width || 750,
        height:+best.door.height || 2100,
        sill:+best.door.sill || 0,
        swing:best.door.swing || 'left'
      };
      const next = {
        wallId:wall.id,
        offset,
        width,
        height:current.height,
        sill:0,
        swing:current.swing
      };
      const changed = (
        current.wallId !== next.wallId ||
        Math.abs(current.offset - next.offset) >= 25 ||
        Math.abs(current.width - next.width) >= 50
      );
      if(changed){
        architectureSuggestionsV50.push({
          id:`suggestion-door-${best.door.id}`,
          kind:'door',
          action:'move',
          targetId:best.door.id,
          label:best.door.name || best.door.id,
          source:'calibrated door symbol',
          current,
          candidate:next,
          differenceMm:Math.round(best.distance),
          confidence:best.distance <= 300 ? 'high' : best.distance <= 750 ? 'medium' : 'low',
          status:'suggested'
        });
      }
      return;
    }

    architectureSuggestionsV50.push({
      id:`suggestion-door-missing-${index}`,
      kind:'door',
      action:'add',
      targetId:null,
      label:`Possible missing door ${index + 1}`,
      source:'calibrated door symbol',
      current:null,
      candidate:{
        wallId:wall.id,
        offset,
        width,
        height:2100,
        sill:0,
        swing:'left'
      },
      differenceMm:width,
      confidence:candidate.score >= .04 ? 'high' : 'medium',
      status:'suggested'
    });
  });

  setWallReviewStatusV32(
    `${architectureSuggestionsV50.length} non-destructive suggestions · ` +
    `${architectureSuggestionMetaV50.skippedDoorPairs} split-wall door candidates require manual review · ` +
    'JSON geometry unchanged'
  );
  renderArchitectureSuggestionUiV50();
}

// Replace destructive detection with suggestion generation.
detectWalls = function(){
  collectWallSuggestionsV50();
};
detectDoorsV32 = function(){
  collectDoorSuggestionsV50();
};
if($('autoTrace'))$('autoTrace').onclick = detectWalls;
if($('autoDoors'))$('autoDoors').onclick = detectDoorsV32;

function clearArchitectureSuggestionOverlayV50(){
  while(architectureSuggestionOverlayV50.children.length){
    const child = architectureSuggestionOverlayV50.children[0];
    architectureSuggestionOverlayV50.remove(child);
    child.geometry?.dispose?.();
    child.material?.dispose?.();
  }
}

function addSuggestionLineV50(geometry, color, y = .035){
  if(!geometry)return;
  const points = [
    new THREE.Vector3(geometry.x1 * MM, y, geometry.y1 * MM),
    new THREE.Vector3(geometry.x2 * MM, y, geometry.y2 * MM)
  ];
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({color, depthTest:false, transparent:true, opacity:.95})
  );
  line.renderOrder = 1000;
  architectureSuggestionOverlayV50.add(line);
}

function addDoorSuggestionLineV50(candidate, color){
  const wall = (project.walls || []).find(item => item.id === candidate?.wallId);
  if(!wall)return;
  const metrics = wallMetrics(wall);
  const half = (+candidate.width || 750) / 2;
  const a = Math.max(0, (+candidate.offset || 0) - half);
  const b = Math.min(metrics.length, (+candidate.offset || 0) + half);
  addSuggestionLineV50({
    x1:metrics.x1 + metrics.ux * a,
    y1:metrics.y1 + metrics.uy * a,
    x2:metrics.x1 + metrics.ux * b,
    y2:metrics.y1 + metrics.uy * b
  }, color, .05);
}

function focusArchitectureSuggestionV50(suggestion){
  clearArchitectureSuggestionOverlayV50();
  if(!suggestion)return;
  if(suggestion.kind === 'wall'){
    if(suggestion.current)addSuggestionLineV50(suggestion.current, 0xdf7468);
    addSuggestionLineV50(suggestion.candidate, 0xd8ad63, .055);
    if(suggestion.targetId)selectArchitecture('wall', suggestion.targetId);
  }else if(suggestion.kind === 'door'){
    addDoorSuggestionLineV50(suggestion.candidate, 0xd8ad63);
  }
}

function formatWallGeometryV50(value){
  if(!value)return 'Not present in JSON';
  return `${Math.round(value.x1)}, ${Math.round(value.y1)} → ` +
    `${Math.round(value.x2)}, ${Math.round(value.y2)} mm`;
}

function formatOpeningGeometryV50(value){
  if(!value)return 'Not present in JSON';
  return `${value.wallId} · offset ${Math.round(value.offset)} mm · ` +
    `width ${Math.round(value.width)} mm`;
}

function currentPendingSuggestionIndexV50(from = architectureSuggestionIndexV50){
  if(!architectureSuggestionsV50.length)return 0;
  for(let step = 0; step < architectureSuggestionsV50.length; step++){
    const index = (from + step + architectureSuggestionsV50.length) %
      architectureSuggestionsV50.length;
    if(architectureSuggestionsV50[index].status === 'suggested')return index;
  }
  return Math.max(0, Math.min(
    architectureSuggestionsV50.length - 1,
    architectureSuggestionIndexV50
  ));
}

function renderArchitectureAuthorityStatusV50(){
  const registration = basemapRegistrationV50();
  const status = $('architectureAuthorityStatusV50');
  const basemapStatus = $('basemapRegistrationStatusV50');
  [status, basemapStatus].forEach(node => {
    if(!node)return;
    node.className = `architecture-authority-status-v50 ${registration.mode}`;
    node.textContent = `JSON geometry: authoritative · ${registration.message}`;
  });
}

function renderArchitectureSuggestionUiV50(){
  renderArchitectureAuthorityStatusV50();
  const countNode = $('reviewSuggestionCounts');
  const panel = $('architectureSuggestionCardV50');
  if(!countNode || !panel)return;

  const pending = architectureSuggestionsV50.filter(item => item.status === 'suggested');
  const applied = architectureSuggestionsV50.filter(item => item.status === 'applied');
  const kept = architectureSuggestionsV50.filter(item => item.status === 'kept');
  countNode.textContent = [
    `${pending.length} unreviewed suggestion${pending.length === 1 ? '' : 's'}`,
    `${applied.length} applied`,
    `${kept.length} kept as JSON`,
    `${architectureSuggestionMetaV50.unmatchedWalls} unmatched authored wall${architectureSuggestionMetaV50.unmatchedWalls === 1 ? '' : 's'}`
  ].join(' · ');

  if(!architectureSuggestionsV50.length){
    panel.hidden = false;
    $('architectureSuggestionNameV50').textContent = 'No automatic geometry changes';
    $('architectureSuggestionMetaV50').textContent =
      basemapRegistrationV50().registered
        ? 'No reliable mismatch suggestion was generated. Compare remaining authored walls manually.'
        : 'Register the basemap to enable comparison, or continue with JSON only.';
    $('architectureSuggestionCurrentV50').textContent = 'JSON geometry retained';
    $('architectureSuggestionCandidateV50').textContent = 'No candidate';
    $('architectureSuggestionDifferenceV50').textContent = '—';
    ['architectureSuggestionPreviousV50','architectureSuggestionNextV50',
      'architectureSuggestionKeepV50','architectureSuggestionApplyV50',
      'architectureSuggestionApplyHighV50'].forEach(id => {
        if($(id))$(id).disabled = true;
      });
    clearArchitectureSuggestionOverlayV50();
    return;
  }

  architectureSuggestionIndexV50 = Math.max(
    0,
    Math.min(architectureSuggestionsV50.length - 1, architectureSuggestionIndexV50)
  );
  const suggestion = architectureSuggestionsV50[architectureSuggestionIndexV50];
  panel.hidden = false;
  $('architectureSuggestionNameV50').textContent =
    `${architectureSuggestionIndexV50 + 1} / ${architectureSuggestionsV50.length} · ${suggestion.label}`;
  $('architectureSuggestionMetaV50').textContent =
    `${suggestion.kind} · ${suggestion.action} · ${suggestion.confidence} confidence · ` +
    `${suggestion.status} · ${suggestion.source}`;
  $('architectureSuggestionCurrentV50').textContent = suggestion.kind === 'wall'
    ? formatWallGeometryV50(suggestion.current)
    : formatOpeningGeometryV50(suggestion.current);
  $('architectureSuggestionCandidateV50').textContent = suggestion.kind === 'wall'
    ? formatWallGeometryV50(suggestion.candidate)
    : formatOpeningGeometryV50(suggestion.candidate);
  $('architectureSuggestionDifferenceV50').textContent =
    Number.isFinite(suggestion.differenceMm)
      ? `${Math.round(suggestion.differenceMm)} mm`
      : 'Manual comparison';

  $('architectureSuggestionPreviousV50').disabled = architectureSuggestionsV50.length < 2;
  $('architectureSuggestionNextV50').disabled = architectureSuggestionsV50.length < 2;
  $('architectureSuggestionKeepV50').disabled = suggestion.status !== 'suggested';
  $('architectureSuggestionApplyV50').disabled = suggestion.status !== 'suggested';
  $('architectureSuggestionApplyHighV50').disabled = !pending.some(
    item => item.confidence === 'high'
  );

  focusArchitectureSuggestionV50(suggestion);
}

function uniqueArchitectureIdV50(prefix){
  const existing = new Set([
    ...(project.walls || []).map(item => item.id),
    ...(project.openings || []).map(item => item.id)
  ]);
  let index = 1;
  let id = `${prefix}-${Date.now()}`;
  while(existing.has(id))id = `${prefix}-${Date.now()}-${index++}`;
  return id;
}

function applyArchitectureSuggestionV50(suggestion, rebuild = true){
  if(!suggestion || suggestion.status !== 'suggested')return false;

  if(suggestion.kind === 'wall' && suggestion.action === 'move'){
    const wall = (project.walls || []).find(item => item.id === suggestion.targetId);
    if(!wall)return false;
    const oldWall = {...wall};
    setWallFromEndpoints(
      wall,
      suggestion.candidate.x1,
      suggestion.candidate.y1,
      suggestion.candidate.x2,
      suggestion.candidate.y2,
      suggestion.candidate.thickness || wall.thickness || 120
    );
    wall.h = suggestion.candidate.h || wall.h || 2600;
    (project.openings || [])
      .filter(opening => opening.wallId === wall.id)
      .forEach(opening => remapOpeningToWallV32(opening, oldWall, wall));
  }else if(suggestion.kind === 'wall' && suggestion.action === 'add'){
    const wall = {
      id:uniqueArchitectureIdV50('review-wall'),
      name:suggestion.label,
      h:suggestion.candidate.h || 2600,
      thickness:suggestion.candidate.thickness || 120
    };
    setWallFromEndpoints(
      wall,
      suggestion.candidate.x1,
      suggestion.candidate.y1,
      suggestion.candidate.x2,
      suggestion.candidate.y2,
      wall.thickness
    );
    project.walls.push(wall);
    suggestion.targetId = wall.id;
  }else if(suggestion.kind === 'door' && suggestion.action === 'move'){
    const door = (project.openings || []).find(item => item.id === suggestion.targetId);
    if(!door)return false;
    Object.assign(door, suggestion.candidate);
  }else if(suggestion.kind === 'door' && suggestion.action === 'add'){
    const door = {
      id:uniqueArchitectureIdV50('review-door'),
      name:suggestion.label,
      type:'door',
      ...suggestion.candidate
    };
    project.openings.push(door);
    suggestion.targetId = door.id;
  }else{
    return false;
  }

  suggestion.status = 'applied';
  if(rebuild){
    buildScene();
    if(suggestion.kind === 'wall')selectArchitecture('wall', suggestion.targetId);
  }
  return true;
}

function keepCurrentArchitectureSuggestionV50(){
  const suggestion = architectureSuggestionsV50[architectureSuggestionIndexV50];
  if(!suggestion || suggestion.status !== 'suggested')return;
  suggestion.status = 'kept';
  architectureSuggestionIndexV50 = currentPendingSuggestionIndexV50(
    architectureSuggestionIndexV50 + 1
  );
  renderArchitectureSuggestionUiV50();
}

function applyCurrentArchitectureSuggestionV50(){
  const suggestion = architectureSuggestionsV50[architectureSuggestionIndexV50];
  if(!suggestion || suggestion.status !== 'suggested')return;
  pushHistory(`apply architecture suggestion: ${suggestion.label}`);
  if(!applyArchitectureSuggestionV50(suggestion, true))return;
  architectureSuggestionIndexV50 = currentPendingSuggestionIndexV50(
    architectureSuggestionIndexV50 + 1
  );
  renderArchitectureSuggestionUiV50();
}

function applyHighConfidenceArchitectureSuggestionsV50(){
  const suggestions = architectureSuggestionsV50.filter(
    item => item.status === 'suggested' && item.confidence === 'high'
  );
  if(!suggestions.length)return;
  if(!confirm(
    `Apply ${suggestions.length} high-confidence architecture suggestion` +
    `${suggestions.length === 1 ? '' : 's'}? JSON geometry will be changed only for these items.`
  ))return;
  pushHistory('apply high-confidence architecture suggestions');
  suggestions.forEach(item => applyArchitectureSuggestionV50(item, false));
  buildScene();
  architectureSuggestionIndexV50 = currentPendingSuggestionIndexV50(0);
  renderArchitectureSuggestionUiV50();
}

function injectArchitectureSuggestionUiV50(){
  const countNode = $('reviewSuggestionCounts');
  if(countNode && !$('architectureSuggestionCardV50')){
    const authority = document.createElement('div');
    authority.id = 'architectureAuthorityStatusV50';
    countNode.parentNode.insertBefore(authority, countNode);

    const card = document.createElement('div');
    card.id = 'architectureSuggestionCardV50';
    card.className = 'architecture-suggestion-card-v50';
    card.innerHTML = `
      <div class="architecture-suggestion-heading-v50">
        <strong id="architectureSuggestionNameV50">No suggestions</strong>
        <span id="architectureSuggestionMetaV50"></span>
      </div>
      <div class="architecture-suggestion-comparison-v50">
        <div><span>Current JSON</span><strong id="architectureSuggestionCurrentV50">—</strong></div>
        <div><span>Basemap candidate</span><strong id="architectureSuggestionCandidateV50">—</strong></div>
        <div><span>Difference</span><strong id="architectureSuggestionDifferenceV50">—</strong></div>
      </div>
      <div class="button-row architecture-suggestion-navigation-v50">
        <button id="architectureSuggestionPreviousV50" type="button">Previous</button>
        <button id="architectureSuggestionNextV50" type="button">Next</button>
        <button id="architectureSuggestionKeepV50" type="button">Keep JSON</button>
        <button id="architectureSuggestionApplyV50" type="button" class="primary">Apply suggestion</button>
      </div>
      <button id="architectureSuggestionApplyHighV50" type="button" class="wide">
        Apply all high-confidence suggestions
      </button>
      <p class="small">Red line: current JSON. Amber line: candidate. Detection never changes geometry by itself.</p>
    `;
    countNode.insertAdjacentElement('afterend', card);

    $('architectureSuggestionPreviousV50').onclick = () => {
      architectureSuggestionIndexV50 = (
        architectureSuggestionIndexV50 - 1 + architectureSuggestionsV50.length
      ) % architectureSuggestionsV50.length;
      renderArchitectureSuggestionUiV50();
    };
    $('architectureSuggestionNextV50').onclick = () => {
      architectureSuggestionIndexV50 = (
        architectureSuggestionIndexV50 + 1
      ) % architectureSuggestionsV50.length;
      renderArchitectureSuggestionUiV50();
    };
    $('architectureSuggestionKeepV50').onclick = keepCurrentArchitectureSuggestionV50;
    $('architectureSuggestionApplyV50').onclick = applyCurrentArchitectureSuggestionV50;
    $('architectureSuggestionApplyHighV50').onclick =
      applyHighConfidenceArchitectureSuggestionsV50;
  }

  const basemapStatus = $('basemapStatus');
  if(basemapStatus && !$('basemapRegistrationStatusV50')){
    const registration = document.createElement('div');
    registration.id = 'basemapRegistrationStatusV50';
    basemapStatus.insertAdjacentElement('afterend', registration);
  }

  const scaleApply = $('scaleApply');
  if(scaleApply && !$('scaleUseJsonOnlyV50')){
    const button = document.createElement('button');
    button.id = 'scaleUseJsonOnlyV50';
    button.type = 'button';
    button.textContent = 'Use JSON only';
    button.title = 'Skip basemap registration and keep the project JSON geometry unchanged.';
    scaleApply.parentNode.insertBefore(button, scaleApply);
    button.onclick = useJsonOnlyV50;
  }

  const style = document.createElement('style');
  style.id = 'architectureSuggestionStylesV50';
  style.textContent = `
    .architecture-authority-status-v50{
      margin:0 0 10px;padding:8px 9px;border:1px solid var(--line);
      border-radius:8px;background:rgba(0,0,0,.1);font-size:10px;line-height:1.4;
    }
    .architecture-authority-status-v50.registered{
      color:#c8e0c1;border-color:rgba(146,165,139,.55);
    }
    .architecture-authority-status-v50.registered-warning{
      color:#f0d49b;border-color:rgba(216,173,99,.55);
    }
    .architecture-authority-status-v50.unregistered,
    .architecture-authority-status-v50.json-only{
      color:#f0d49b;border-color:rgba(216,173,99,.5);
    }
    .architecture-suggestion-card-v50{
      margin:0 0 12px;padding:10px;border:1px solid var(--line);
      border-radius:9px;background:rgba(0,0,0,.12);
    }
    .architecture-suggestion-heading-v50{display:grid;gap:3px;margin-bottom:9px}
    .architecture-suggestion-heading-v50 strong{font-size:11px}
    .architecture-suggestion-heading-v50 span{color:var(--muted);font-size:9px;line-height:1.35}
    .architecture-suggestion-comparison-v50{display:grid;gap:6px;margin-bottom:9px}
    .architecture-suggestion-comparison-v50 div{
      display:grid;grid-template-columns:88px 1fr;gap:8px;padding:6px;
      border-radius:7px;background:rgba(255,255,255,.025);
    }
    .architecture-suggestion-comparison-v50 span{color:var(--muted);font-size:9px}
    .architecture-suggestion-comparison-v50 strong{
      min-width:0;color:var(--text);font-size:9px;font-weight:550;word-break:break-word
    }
    .architecture-suggestion-navigation-v50 button{flex:1 1 110px}
    #architectureSuggestionApplyHighV50{width:100%;margin-top:7px}
    #basemapRegistrationStatusV50{margin-top:8px}
  `;
  document.head.appendChild(style);
}

function activateJsonOnlyV50(confirmUser = true){
  if(!hasAuthoredArchitectureV50()){
    if(confirmUser)alert('JSON-only mode requires existing project walls, rooms or fixed architecture.');
    return false;
  }
  if(confirmUser && !confirm(
    'Continue with the project JSON only? Basemap detection will stay disabled until scale is set again.'
  ))return false;
  project.settings = project.settings || {};
  project.settings.basemapReviewMode = 'json-only';
  project.settings.scaleCalibrationRequired = false;
  project.settings.architectureReviewConfirmed = true;
  scaleLaunchRequestV41++;
  closeScaleCalibrationV33();
  wallReviewActiveV32 = false;
  wallReviewStartKeyV32 = '';
  reviewWorkflowV36.hidden = true;
  document.body.classList.remove('architecture-review-mode');
  setFurnitureReviewVisibilityV32(true);
  architectureSuggestionsV50 = [];
  clearArchitectureSuggestionOverlayV50();
  viewBird();
  buildScene();
  renderArchitectureAuthorityStatusV50();
  $('basemapStatus').textContent =
    'Using authoritative JSON geometry. Basemap detection is disabled.';
  if(typeof setPackageStatus === 'function'){
    setPackageStatus('Project opened in JSON-only mode.','ok');
  }
  return true;
}
function useJsonOnlyV50(){
  activateJsonOnlyV50(true);
}

const startImportedProjectReviewBeforeV50 = startImportedProjectReviewV41;
startImportedProjectReviewV41 = function(){
  if(project.settings?.basemapReviewMode === 'json-only'){
    activateJsonOnlyV50(false);
    return;
  }
  startImportedProjectReviewBeforeV50();
};

const loadBasemapBeforeV50 = loadBasemap;
loadBasemap = function(file){
  project.settings = project.settings || {};
  delete project.settings.basemapReviewMode;
  return loadBasemapBeforeV50(file);
};

const setScaleClickBeforeV50 = $('setScaleBasemap')?.onclick;
if($('setScaleBasemap')){
  $('setScaleBasemap').onclick = event => {
    project.settings = project.settings || {};
    delete project.settings.basemapReviewMode;
    project.settings.scaleCalibrationRequired = true;
    renderArchitectureAuthorityStatusV50();
    return setScaleClickBeforeV50?.call($('setScaleBasemap'), event);
  };
}

// For an authored project, ruler calibration registers the image but does not
// replace the authoritative project.plan extents. Blank-image workflows may
// still initialise plan extents from calibration.
const applyCalibratedBasemapSizeBeforeV50 = applyCalibratedBasemapSizeV33;
applyCalibratedBasemapSizeV33 = function(){
  const preservePlan = hasAuthoredArchitectureV50() && project.plan
    ? JSON.parse(JSON.stringify(project.plan))
    : null;
  applyCalibratedBasemapSizeBeforeV50();
  if(preservePlan){
    project.plan = preservePlan;
  }
  renderArchitectureAuthorityStatusV50();
};

// Existing review UI count calls now describe the separate suggestion state.
syncReviewCountsV36 = function(){
  renderArchitectureSuggestionUiV50();
};

// Warn before confirming unresolved suggestions. The original confirmation
// handler still performs the actual confirmation after this capture listener.
$('confirmWallReview')?.addEventListener('click', event => {
  const pending = architectureSuggestionsV50.filter(item => item.status === 'suggested');
  if(!pending.length)return;
  const proceed = confirm(
    `${pending.length} architecture suggestion${pending.length === 1 ? '' : 's'} remain unreviewed.\n\n` +
    'Confirm architecture while keeping the current JSON geometry for all of them?'
  );
  if(!proceed){
    event.preventDefault();
    event.stopImmediatePropagation();
    return;
  }
  pending.forEach(item => { item.status = 'kept'; });
  renderArchitectureSuggestionUiV50();
}, true);

$('confirmWallReview')?.addEventListener('click', () => {
  clearArchitectureSuggestionOverlayV50();
});

injectArchitectureSuggestionUiV50();
renderArchitectureAuthorityStatusV50();
renderArchitectureSuggestionUiV50();
