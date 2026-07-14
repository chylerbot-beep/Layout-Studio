// Basemap registration, label-follow, photo-label and camera-preset refinements.
//
// Loads after app-parts/29.js and before app-parts/08.js.
// - Adds Adjust basemap between Set scale and Align furniture.
// - Moves the basemap only; authored wall geometry and calibrated size stay unchanged.
// - Keeps labels visible in Photo mode.
// - Keeps furniture labels attached to their objects and hides them with hidden furniture.
// - Preserves the current plan focus when switching Top, Bird's-eye and Eye-level views.

const layoutRefinementVersionV60 = '20260714-v60';

// -----------------------------------------------------------------------------
// Adjust basemap
// -----------------------------------------------------------------------------

let basemapAdjustActiveV60 = false;
let basemapAdjustSessionV60 = null;
let basemapAdjustDragV60 = null;
const basemapAdjustRaycasterV60 = new THREE.Raycaster();
const basemapAdjustPointerV60 = new THREE.Vector2();
const basemapAdjustPlaneV60 = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

function cloneBasemapRegistrationV60() {
  if (!project.basemap) return null;
  return {
    offsetX: Number(project.basemap.offsetX) || 0,
    offsetY: Number(project.basemap.offsetY) || 0,
    width: Number(project.basemap.width) || PLAN_W,
    depth: Number(project.basemap.depth) || PLAN_H
  };
}

function syncBasemapOffsetFieldsV60() {
  if (!project.basemap) return;
  if ($('basemapOffsetX')) $('basemapOffsetX').value = Math.round(Number(project.basemap.offsetX) || 0);
  if ($('basemapOffsetY')) $('basemapOffsetY').value = Math.round(Number(project.basemap.offsetY) || 0);
  if ($('planWidth')) $('planWidth').value = Math.round(Number(project.basemap.width) || PLAN_W);
  if ($('planDepth')) $('planDepth').value = Math.round(Number(project.basemap.depth) || PLAN_H);
  const readout = $('basemapAdjustReadoutV60');
  if (readout) {
    readout.textContent =
      `Offset X ${Math.round(Number(project.basemap.offsetX) || 0).toLocaleString()} mm · ` +
      `Offset Y ${Math.round(Number(project.basemap.offsetY) || 0).toLocaleString()} mm`;
  }
}

function invalidateBasemapComparisonV60(rebuild = true) {
  wallDetectionCache = null;
  basemapRenderSignature = '';
  if (typeof architectureSuggestionsV50 !== 'undefined') {
    architectureSuggestionsV50 = [];
    architectureSuggestionIndexV50 = 0;
  }
  if (rebuild) {
    buildBasemap(true);
    renderArchitectureHighlight();
  }
  syncBasemapOffsetFieldsV60();
  if (typeof renderArchitectureAuthorityStatusV50 === 'function') {
    renderArchitectureAuthorityStatusV50();
  }
  if (typeof renderArchitectureSuggestionUiV50 === 'function') {
    renderArchitectureSuggestionUiV50();
  }
}

function basemapAdjustPlanPointV60(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  basemapAdjustPointerV60.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  basemapAdjustPointerV60.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  basemapAdjustRaycasterV60.setFromCamera(basemapAdjustPointerV60, camera);
  const point = new THREE.Vector3();
  if (!basemapAdjustRaycasterV60.ray.intersectPlane(basemapAdjustPlaneV60, point)) return null;
  return { x: point.x / MM, y: point.z / MM };
}

function setBasemapOffsetV60(x, y, rebuild = true) {
  if (!project.basemap) return;
  project.basemap.offsetX = Math.round(x);
  project.basemap.offsetY = Math.round(y);
  invalidateBasemapComparisonV60(rebuild);
}

function weightedMedianV60(entries) {
  const values = entries
    .filter(entry => Number.isFinite(entry.value) && entry.weight > 0)
    .sort((a, b) => a.value - b.value);
  if (!values.length) return null;
  const total = values.reduce((sum, entry) => sum + entry.weight, 0);
  let running = 0;
  for (const entry of values) {
    running += entry.weight;
    if (running >= total / 2) return entry.value;
  }
  return values[values.length - 1].value;
}

function bestFitBasemapDeltaV60() {
  if (!project.basemap || typeof getDetectedWallSegments !== 'function') {
    return { dx: null, dy: null, matchesX: 0, matchesY: 0 };
  }

  wallDetectionCache = null;
  const lines = getDetectedWallSegments(true) || [];
  const horizontalLines = lines.filter(line => line.horizontal);
  const verticalLines = lines.filter(line => !line.horizontal);
  const xDeltas = [];
  const yDeltas = [];

  (project.walls || []).forEach(wall => {
    const metrics = wallMetrics(wall);
    const candidates = metrics.horizontal ? horizontalLines : verticalLines;
    let best = null;

    candidates.forEach(line => {
      const wallStart = metrics.horizontal
        ? Math.min(metrics.x1, metrics.x2)
        : Math.min(metrics.y1, metrics.y2);
      const wallEnd = metrics.horizontal
        ? Math.max(metrics.x1, metrics.x2)
        : Math.max(metrics.y1, metrics.y2);
      const overlap = Math.max(0, Math.min(wallEnd, line.b) - Math.max(wallStart, line.a));
      const overlapRatio = overlap / Math.max(1, metrics.length);
      if (overlap < 300 || overlapRatio < 0.12) return;

      const wallCross = metrics.horizontal ? metrics.cy : metrics.cx;
      const delta = wallCross - line.p;
      if (Math.abs(delta) > 2500) return;

      const score =
        Math.abs(delta) -
        Math.min(900, overlap) * 0.16 -
        Math.min(0.8, overlapRatio) * 180;

      if (!best || score < best.score) best = { delta, overlap, overlapRatio, score };
    });

    if (!best) return;
    const entry = {
      value: best.delta,
      weight: Math.max(1, Math.min(metrics.length, best.overlap)) * (0.5 + best.overlapRatio)
    };
    if (metrics.horizontal) yDeltas.push(entry);
    else xDeltas.push(entry);
  });

  return {
    dx: weightedMedianV60(xDeltas),
    dy: weightedMedianV60(yDeltas),
    matchesX: xDeltas.length,
    matchesY: yDeltas.length
  };
}

function bestFitBasemapPositionV60() {
  if (!project.basemap) return;
  let totalDx = 0;
  let totalDy = 0;
  let last = null;

  // Re-evaluate after each translation because detected line coordinates change
  // with the basemap offset. Translation only: width, depth, crop and scale remain.
  for (let pass = 0; pass < 3; pass += 1) {
    last = bestFitBasemapDeltaV60();
    const dx = Number.isFinite(last.dx) ? Math.round(last.dx) : 0;
    const dy = Number.isFinite(last.dy) ? Math.round(last.dy) : 0;
    if (!dx && !dy) break;
    project.basemap.offsetX = Math.round((Number(project.basemap.offsetX) || 0) + dx);
    project.basemap.offsetY = Math.round((Number(project.basemap.offsetY) || 0) + dy);
    totalDx += dx;
    totalDy += dy;
    wallDetectionCache = null;
  }

  invalidateBasemapComparisonV60(true);
  const status = $('basemapAdjustStatusV60');
  if (!last || (!last.matchesX && !last.matchesY)) {
    if (status) {
      status.textContent =
        'No reliable wall-band translation was found. Drag the basemap manually or use the arrow keys.';
    }
    return;
  }
  if (status) {
    status.textContent =
      `Best-fit moved the basemap ${totalDx.toLocaleString()} mm in X and ` +
      `${totalDy.toLocaleString()} mm in Y using ${last.matchesX + last.matchesY} wall matches. ` +
      'Check several outer and internal walls before pressing Done.';
  }
  if ($('basemapStatus')) {
    $('basemapStatus').textContent =
      'Basemap position adjusted against authored walls. Wall coordinates and calibrated image size were not changed.';
  }
}

function nudgeBasemapV60(dx, dy) {
  if (!project.basemap) return;
  setBasemapOffsetV60(
    (Number(project.basemap.offsetX) || 0) + dx,
    (Number(project.basemap.offsetY) || 0) + dy,
    true
  );
  const status = $('basemapAdjustStatusV60');
  if (status) status.textContent = `Nudged ${Math.abs(dx || dy).toLocaleString()} mm.`;
}

function finishBasemapAdjustV60(commit) {
  if (!basemapAdjustActiveV60 || !basemapAdjustSessionV60) return;
  const session = basemapAdjustSessionV60;

  if (!commit && project.basemap && session.basemap) {
    project.basemap.offsetX = session.basemap.offsetX;
    project.basemap.offsetY = session.basemap.offsetY;
    project.basemap.width = session.basemap.width;
    project.basemap.depth = session.basemap.depth;
    undoStack.splice(session.undoLength);
    redoStack.splice(0, redoStack.length, ...session.redo);
    $('undo').disabled = !undoStack.length;
    $('redo').disabled = !redoStack.length;
  }

  basemapAdjustActiveV60 = false;
  basemapAdjustDragV60 = null;
  basemapAdjustSessionV60 = null;
  orbit.enabled = true;
  renderer.domElement.classList.remove('basemap-adjust-cursor-v60');
  $('adjustBasemap')?.classList.remove('active');
  if ($('basemapAdjustPanelV60')) $('basemapAdjustPanelV60').hidden = true;
  invalidateBasemapComparisonV60(true);

  if ($('basemapStatus')) {
    $('basemapStatus').textContent = commit
      ? 'Basemap position saved. Wall geometry was not changed.'
      : 'Basemap adjustment cancelled; the previous position was restored.';
  }
}

function beginBasemapAdjustV60() {
  if (!project.basemap || !basemapImage?.complete) {
    alert('Upload and set the scale of a floor-plan basemap first.');
    return;
  }
  if (basemapAdjustActiveV60) {
    finishBasemapAdjustV60(true);
    return;
  }

  basemapAdjustSessionV60 = {
    basemap: cloneBasemapRegistrationV60(),
    undoLength: undoStack.length,
    redo: [...redoStack]
  };
  pushHistory('adjust basemap position');
  basemapAdjustActiveV60 = true;
  basemapGroup.visible = true;
  if ($('toggleBasemap')) $('toggleBasemap').classList.add('active');
  $('adjustBasemap')?.classList.add('active');
  if ($('basemapAdjustPanelV60')) $('basemapAdjustPanelV60').hidden = false;
  renderer.domElement.classList.add('basemap-adjust-cursor-v60');
  transform.detach();
  select(null);
  selectedArchitecture = null;
  updateArchitecturePanel();
  renderArchitectureList();
  setTool('select');
  syncBasemapOffsetFieldsV60();

  const status = $('basemapAdjustStatusV60');
  if (status) {
    status.textContent =
      'Drag the floor plan, use Best fit to walls, or nudge it. This mode changes Offset X/Y only.';
  }
}

function beginBasemapDragV60(event) {
  if (!basemapAdjustActiveV60 || event.button !== 0 || !project.basemap) return;
  const point = basemapAdjustPlanPointV60(event);
  if (!point) return;
  basemapAdjustDragV60 = {
    pointerId: event.pointerId,
    startPoint: point,
    startOffsetX: Number(project.basemap.offsetX) || 0,
    startOffsetY: Number(project.basemap.offsetY) || 0
  };
  orbit.enabled = false;
  renderer.domElement.setPointerCapture?.(event.pointerId);
  event.preventDefault();
  event.stopImmediatePropagation();
}

function updateBasemapDragV60(event) {
  if (!basemapAdjustActiveV60 || !basemapAdjustDragV60 ||
      event.pointerId !== basemapAdjustDragV60.pointerId) return;
  const point = basemapAdjustPlanPointV60(event);
  if (!point) return;
  const dx = point.x - basemapAdjustDragV60.startPoint.x;
  const dy = point.y - basemapAdjustDragV60.startPoint.y;
  setBasemapOffsetV60(
    basemapAdjustDragV60.startOffsetX + dx,
    basemapAdjustDragV60.startOffsetY + dy,
    true
  );
  event.preventDefault();
  event.stopImmediatePropagation();
}

function endBasemapDragV60(event) {
  if (!basemapAdjustDragV60 ||
      (event.pointerId !== undefined && event.pointerId !== basemapAdjustDragV60.pointerId)) return;
  renderer.domElement.releasePointerCapture?.(basemapAdjustDragV60.pointerId);
  basemapAdjustDragV60 = null;
  orbit.enabled = true;
  event.preventDefault?.();
  event.stopImmediatePropagation?.();
}

function installBasemapAdjustUiV60() {
  const setScale = $('setScaleBasemap');
  const alignFurniture = $('alignFurniture');
  if (!setScale || !alignFurniture || $('adjustBasemap')) return;

  const button = document.createElement('button');
  button.id = 'adjustBasemap';
  button.type = 'button';
  button.textContent = 'Adjust basemap';
  button.title =
    'Move the calibrated basemap to match the authored walls without moving or resizing the walls.';
  alignFurniture.parentNode.insertBefore(button, alignFurniture);
  button.onclick = beginBasemapAdjustV60;

  const panel = document.createElement('div');
  panel.id = 'basemapAdjustPanelV60';
  panel.hidden = true;
  panel.innerHTML = `
    <div class="basemap-adjust-heading-v60">
      <strong>Adjust basemap</strong>
      <span id="basemapAdjustReadoutV60"></span>
    </div>
    <div class="basemap-adjust-copy-v60">
      Drag the floor plan to match the walls. The calibrated width, depth and crop stay unchanged.
    </div>
    <div class="basemap-adjust-actions-v60">
      <button id="basemapBestFitV60" type="button">Best fit to walls</button>
      <button id="basemapAdjustLeftV60" type="button" title="Nudge left">←</button>
      <button id="basemapAdjustUpV60" type="button" title="Nudge up">↑</button>
      <button id="basemapAdjustDownV60" type="button" title="Nudge down">↓</button>
      <button id="basemapAdjustRightV60" type="button" title="Nudge right">→</button>
    </div>
    <div id="basemapAdjustStatusV60" class="basemap-adjust-status-v60"></div>
    <div class="basemap-adjust-footer-v60">
      <button id="basemapAdjustCancelV60" type="button">Cancel</button>
      <button id="basemapAdjustDoneV60" type="button">Done</button>
    </div>
  `;
  viewport.appendChild(panel);

  $('basemapBestFitV60').onclick = bestFitBasemapPositionV60;
  $('basemapAdjustLeftV60').onclick = () => nudgeBasemapV60(-10, 0);
  $('basemapAdjustRightV60').onclick = () => nudgeBasemapV60(10, 0);
  $('basemapAdjustUpV60').onclick = () => nudgeBasemapV60(0, -10);
  $('basemapAdjustDownV60').onclick = () => nudgeBasemapV60(0, 10);
  $('basemapAdjustCancelV60').onclick = () => finishBasemapAdjustV60(false);
  $('basemapAdjustDoneV60').onclick = () => finishBasemapAdjustV60(true);
}

if (!document.getElementById('layoutRefinementStylesV60')) {
  const style = document.createElement('style');
  style.id = 'layoutRefinementStylesV60';
  style.textContent = `
    #adjustBasemap.active {
      background: var(--sage-dark);
      border-color: var(--sage);
    }
    #viewport.basemap-adjust-mode-v60,
    .basemap-adjust-cursor-v60 {
      cursor: move !important;
    }
    #basemapAdjustPanelV60 {
      position: absolute;
      top: 12px;
      left: 50%;
      z-index: 70;
      width: min(560px, calc(100% - 24px));
      transform: translateX(-50%);
      padding: 12px;
      border: 1px solid var(--line);
      border-radius: 12px;
      background: rgba(34, 35, 31, .96);
      box-shadow: 0 18px 55px rgba(0, 0, 0, .38);
      color: var(--text);
    }
    #basemapAdjustPanelV60[hidden] { display: none !important; }
    .basemap-adjust-heading-v60 {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 5px;
    }
    .basemap-adjust-heading-v60 strong { font-size: 12px; }
    .basemap-adjust-heading-v60 span,
    .basemap-adjust-copy-v60,
    .basemap-adjust-status-v60 {
      color: var(--muted);
      font-size: 10px;
      line-height: 1.4;
    }
    .basemap-adjust-actions-v60,
    .basemap-adjust-footer-v60 {
      display: flex;
      flex-wrap: wrap;
      gap: 7px;
      margin-top: 10px;
    }
    .basemap-adjust-actions-v60 button:first-child { flex: 1 1 150px; }
    .basemap-adjust-actions-v60 button:not(:first-child) { min-width: 36px; }
    .basemap-adjust-status-v60 { min-height: 28px; margin-top: 8px; }
    .basemap-adjust-footer-v60 { justify-content: flex-end; }
    #basemapAdjustDoneV60 {
      background: var(--sage-dark);
      border-color: var(--sage);
    }
    @media (max-width: 700px) {
      #basemapAdjustPanelV60 { top: 8px; width: calc(100% - 16px); }
      .basemap-adjust-heading-v60 { display: grid; }
    }
  `;
  document.head.appendChild(style);
}

installBasemapAdjustUiV60();

renderer.domElement.addEventListener('pointerdown', beginBasemapDragV60, true);
renderer.domElement.addEventListener('pointermove', updateBasemapDragV60, true);
renderer.domElement.addEventListener('pointerup', endBasemapDragV60, true);
renderer.domElement.addEventListener('pointercancel', endBasemapDragV60, true);

window.addEventListener('keydown', event => {
  if (!basemapAdjustActiveV60) return;
  const amount = event.shiftKey ? 100 : 10;
  const deltas = {
    ArrowLeft: [-amount, 0],
    ArrowRight: [amount, 0],
    ArrowUp: [0, -amount],
    ArrowDown: [0, amount]
  };
  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopImmediatePropagation();
    finishBasemapAdjustV60(false);
    return;
  }
  if (!deltas[event.key]) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  nudgeBasemapV60(...deltas[event.key]);
}, true);

// -----------------------------------------------------------------------------
// Labels follow their objects, remain in Photo mode, and hide with furniture.
// -----------------------------------------------------------------------------

const makeObjectLabelBeforeV60 = makeObjectLabel;
makeObjectLabel = function(item, object) {
  const label = makeObjectLabelBeforeV60(item, object);
  label.userData = label.userData || {};
  label.userData.furnitureIdV60 = item.id;
  label.userData.hiddenByFurnitureV60 = false;
  return label;
};

function furnitureIdForLabelV60(label) {
  if (label.userData?.furnitureIdV60) return label.userData.furnitureIdV60;
  const ids = label.userData?.ignoreIds || [];
  const id = ids.find(candidate => (project.furniture || []).some(item => item.id === candidate));
  if (id) label.userData.furnitureIdV60 = id;
  return id || null;
}

function syncFurnitureLabelsV60() {
  const objects = new Map(
    furnitureGroup.children
      .filter(object => object.userData?.id)
      .map(object => [object.userData.id, object])
  );

  labelGroup.children.forEach(label => {
    const id = furnitureIdForLabelV60(label);
    if (!id) return;
    const object = objects.get(id);
    if (!object) {
      label.visible = false;
      label.userData.hiddenByFurnitureV60 = true;
      return;
    }

    const box = new THREE.Box3().setFromObject(object);
    if (!box.isEmpty()) {
      label.position.set(
        (box.min.x + box.max.x) / 2,
        box.max.y + 0.09,
        (box.min.z + box.max.z) / 2
      );
    }

    const furnitureHidden = !object.visible;
    if (furnitureHidden) {
      label.visible = false;
      label.userData.hiddenByFurnitureV60 = true;
    } else if (label.userData.hiddenByFurnitureV60) {
      label.visible = true;
      label.userData.hiddenByFurnitureV60 = false;
    }
  });
}

const applyCameraFurnitureVisibilityBeforeV60 = applyCameraFurnitureVisibilityV42;
applyCameraFurnitureVisibilityV42 = function() {
  applyCameraFurnitureVisibilityBeforeV60();
  syncFurnitureLabelsV60();
};

const updateLabelOcclusionBeforeV60 = updateLabelOcclusion;
updateLabelOcclusion = function() {
  syncFurnitureLabelsV60();
  updateLabelOcclusionBeforeV60();
};

const syncSelectedFromMeshBeforeV60 = syncSelectedFromMesh;
syncSelectedFromMesh = function() {
  const result = syncSelectedFromMeshBeforeV60();
  syncFurnitureLabelsV60();
  return result;
};

transform.addEventListener('objectChange', syncFurnitureLabelsV60);
transform.addEventListener('change', syncFurnitureLabelsV60);

const buildSceneBeforeV60 = buildScene;
buildScene = function() {
  buildSceneBeforeV60();
  syncFurnitureLabelsV60();
  if (photoModeActiveV31) {
    labelGroup.visible = labelVisible;
    architectureLabelGroup.visible = labelVisible;
  }
};

const photoVisibilityTargetsBeforeV60 = photoVisibilityTargetsV31;
photoVisibilityTargetsV31 = function() {
  return photoVisibilityTargetsBeforeV60().filter(
    ([key]) => key !== 'labels' && key !== 'architectureLabels'
  );
};

const applyPhotoVisibilityBeforeV60 = applyPhotoVisibilityV31;
applyPhotoVisibilityV31 = function() {
  applyPhotoVisibilityBeforeV60();
  if (!photoModeActiveV31) return;
  labelGroup.visible = labelVisible;
  architectureLabelGroup.visible = labelVisible;
  syncFurnitureLabelsV60();
};

const enterPhotoModeBeforeV60 = enterPhotoModeV31;
enterPhotoModeV31 = function() {
  enterPhotoModeBeforeV60();
  labelGroup.visible = labelVisible;
  architectureLabelGroup.visible = labelVisible;
  syncFurnitureLabelsV60();
};

if (photoModeButtonV31) {
  photoModeButtonV31.title =
    'Hide editor panels and guides while keeping visible object and architecture labels.';
}

// -----------------------------------------------------------------------------
// View presets preserve the current plan focus instead of teleporting.
// -----------------------------------------------------------------------------

let viewPresetInitialisedV60 = false;
const preservedViewHeadingV60 = new THREE.Vector3(0.72, 0, 0.69).normalize();

function projectViewExtentV60() {
  const basemap = project.basemap || {};
  return {
    width: Number(basemap.width || project.plan?.width || PLAN_W),
    depth: Number(basemap.depth || project.plan?.depth || PLAN_H),
    offsetX: Number(basemap.offsetX || 0),
    offsetY: Number(basemap.offsetY || 0)
  };
}

function currentViewFocusV60() {
  if (!viewPresetInitialisedV60 && camera.position.lengthSq() < 0.01) {
    const extent = projectViewExtentV60();
    return new THREE.Vector3(
      mm(extent.offsetX + extent.width / 2),
      0,
      mm(extent.offsetY + extent.depth / 2)
    );
  }
  return new THREE.Vector3(orbit.target.x, 0, orbit.target.z);
}

function rememberViewHeadingV60() {
  const dx = camera.position.x - orbit.target.x;
  const dz = camera.position.z - orbit.target.z;
  const length = Math.hypot(dx, dz);
  if (length > 0.25) preservedViewHeadingV60.set(dx / length, 0, dz / length);
  return length;
}

function finishViewPresetV60(buttonId) {
  orbit.update();
  setViewButton(buttonId);
  viewPresetInitialisedV60 = true;
  if (typeof scheduleCameraCutaway === 'function') scheduleCameraCutaway();
  if (typeof scheduleCameraFurnitureVisibilityV42 === 'function') {
    scheduleCameraFurnitureVisibilityV42();
  }
  if (typeof scheduleEyeLabelCleanup === 'function') scheduleEyeLabelCleanup();
  syncFurnitureLabelsV60();
}

viewTop = function() {
  const focus = currentViewFocusV60();
  rememberViewHeadingV60();
  const extent = projectViewExtentV60();
  const currentDistance = Math.max(1, camera.position.distanceTo(orbit.target));
  const initialDistance = mm(Math.max(extent.width, extent.depth)) * 1.05;
  const height = viewPresetInitialisedV60
    ? Math.max(2.5, currentDistance)
    : Math.max(8, initialDistance);

  camera.up.set(0, 0, -1);
  camera.fov = 35;
  camera.updateProjectionMatrix();
  orbit.target.set(focus.x, 0, focus.z);
  camera.position.set(focus.x, height, focus.z + 0.0001);
  orbit.enabled = true;
  orbit.enableRotate = false;
  orbit.enablePan = true;
  orbit.enableZoom = true;
  finishViewPresetV60('viewTop');
};

viewBird = function() {
  const focus = currentViewFocusV60();
  const horizontalBefore = rememberViewHeadingV60();
  const extent = projectViewExtentV60();
  const currentDistance = Math.max(1, camera.position.distanceTo(orbit.target));
  const span = mm(Math.max(extent.width, extent.depth));

  const height = viewPresetInitialisedV60
    ? Math.max(3.2, Math.min(Math.max(6, span * 1.15), currentDistance * 0.92))
    : Math.max(8, span * 1.02);
  const horizontal = viewPresetInitialisedV60
    ? Math.max(1.8, Math.min(6, horizontalBefore || currentDistance * 0.28))
    : Math.max(2.2, height * 0.18);

  camera.up.set(0, 1, 0);
  camera.fov = 52;
  camera.updateProjectionMatrix();
  orbit.target.set(focus.x, 0, focus.z);
  camera.position.set(
    focus.x + preservedViewHeadingV60.x * horizontal,
    height,
    focus.z + preservedViewHeadingV60.z * horizontal
  );
  orbit.enabled = true;
  orbit.enableRotate = true;
  orbit.enablePan = true;
  orbit.enableZoom = true;
  finishViewPresetV60('viewBird');
};

viewEye = function() {
  const focus = currentViewFocusV60();
  const horizontalBefore = rememberViewHeadingV60();
  const currentDistance = Math.max(1, camera.position.distanceTo(orbit.target));
  const horizontal = Math.max(
    1.8,
    Math.min(5.5, horizontalBefore > 0.25 ? horizontalBefore : currentDistance * 0.32)
  );
  const eyeHeight = Math.max(0.8, Math.min(2.4, (+$('cameraHeight')?.value || 1300) * MM));
  const targetHeight = Math.max(0.65, Math.min(eyeHeight - 0.12, 1.1));

  camera.up.set(0, 1, 0);
  camera.fov = 52;
  camera.updateProjectionMatrix();
  orbit.target.set(focus.x, targetHeight, focus.z);
  camera.position.set(
    focus.x + preservedViewHeadingV60.x * horizontal,
    eyeHeight,
    focus.z + preservedViewHeadingV60.z * horizontal
  );
  orbit.enabled = true;
  orbit.enableRotate = true;
  orbit.enablePan = true;
  orbit.enableZoom = true;
  finishViewPresetV60('viewEye');
};

syncFurnitureLabelsV60();
