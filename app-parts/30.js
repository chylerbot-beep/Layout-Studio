// Guided basemap registration, label-follow, photo-label and camera-preset refinements.
//
// Loads after app-parts/29.js and before app-parts/08.js.
// - Changes the guided import workflow to:
//     Step 1 — Set scale
//     Step 2 — Adjust basemap
//     Step 3 — Correct architecture
// - Lets the user drag or best-fit the basemap without moving authored walls.
// - Removes Adjust basemap from the normal Floor-plan basemap section.
// - Keeps labels visible in Photo mode.
// - Keeps furniture labels attached to their objects and hides them with hidden furniture.
// - Preserves the current plan focus when switching Top, Bird's-eye and Eye-level views.

const layoutRefinementVersionV61 = '20260714-guided-basemap-v61';

// -----------------------------------------------------------------------------
// Step 2 of 3 — Adjust basemap
// -----------------------------------------------------------------------------

let basemapAdjustActiveV61 = false;
let basemapAdjustSessionV61 = null;
let basemapAdjustDragV61 = null;
const basemapAdjustRaycasterV61 = new THREE.Raycaster();
const basemapAdjustPointerV61 = new THREE.Vector2();
const basemapAdjustPlaneV61 = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

function cloneBasemapRegistrationV61() {
  if (!project.basemap) return null;
  return {
    offsetX: Number(project.basemap.offsetX) || 0,
    offsetY: Number(project.basemap.offsetY) || 0,
    width: Number(project.basemap.width) || PLAN_W,
    depth: Number(project.basemap.depth) || PLAN_H
  };
}

function syncBasemapAdjustReadoutV61() {
  if (!project.basemap) return;
  if ($('basemapOffsetX')) {
    $('basemapOffsetX').value = Math.round(Number(project.basemap.offsetX) || 0);
  }
  if ($('basemapOffsetY')) {
    $('basemapOffsetY').value = Math.round(Number(project.basemap.offsetY) || 0);
  }
  if ($('planWidth')) {
    $('planWidth').value = Math.round(Number(project.basemap.width) || PLAN_W);
  }
  if ($('planDepth')) {
    $('planDepth').value = Math.round(Number(project.basemap.depth) || PLAN_H);
  }

  const readout = $('reviewBasemapReadoutV61');
  if (readout) {
    readout.textContent =
      `Offset X ${Math.round(Number(project.basemap.offsetX) || 0).toLocaleString()} mm · ` +
      `Offset Y ${Math.round(Number(project.basemap.offsetY) || 0).toLocaleString()} mm`;
  }
}

function invalidateBasemapComparisonV61(rebuild = true) {
  wallDetectionCache = null;
  basemapRenderSignature = '';

  if (typeof architectureSuggestionsV50 !== 'undefined') {
    architectureSuggestionsV50 = [];
    architectureSuggestionIndexV50 = 0;
  }

  if (rebuild) {
    if (typeof buildBasemap === 'function') buildBasemap(true);
    if (typeof renderArchitectureHighlight === 'function') renderArchitectureHighlight();
  }

  syncBasemapAdjustReadoutV61();

  if (typeof renderArchitectureAuthorityStatusV50 === 'function') {
    renderArchitectureAuthorityStatusV50();
  }
  if (typeof renderArchitectureSuggestionUiV50 === 'function') {
    renderArchitectureSuggestionUiV50();
  }
}

function ensureBasemapAdjustHistoryV61() {
  if (!basemapAdjustSessionV61 || basemapAdjustSessionV61.historyPushed) return;
  pushHistory('adjust basemap position');
  basemapAdjustSessionV61.historyPushed = true;
}

function basemapAdjustPlanPointV61(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;

  basemapAdjustPointerV61.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  basemapAdjustPointerV61.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  basemapAdjustRaycasterV61.setFromCamera(basemapAdjustPointerV61, camera);

  const point = new THREE.Vector3();
  if (!basemapAdjustRaycasterV61.ray.intersectPlane(basemapAdjustPlaneV61, point)) return null;
  return { x: point.x / MM, y: point.z / MM };
}

function setBasemapOffsetV61(x, y, rebuild = true) {
  if (!project.basemap) return;
  project.basemap.offsetX = Math.round(x);
  project.basemap.offsetY = Math.round(y);
  invalidateBasemapComparisonV61(rebuild);
}

function weightedMedianV61(entries) {
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

function bestFitBasemapDeltaV61() {
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

      if (!best || score < best.score) {
        best = { delta, overlap, overlapRatio, score };
      }
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
    dx: weightedMedianV61(xDeltas),
    dy: weightedMedianV61(yDeltas),
    matchesX: xDeltas.length,
    matchesY: yDeltas.length
  };
}

function bestFitBasemapPositionV61() {
  if (!project.basemap) return;

  let totalDx = 0;
  let totalDy = 0;
  let last = null;
  let changed = false;

  // Translation only. Re-evaluate after each pass because detected wall
  // coordinates move with the basemap offset.
  for (let pass = 0; pass < 3; pass += 1) {
    last = bestFitBasemapDeltaV61();
    const dx = Number.isFinite(last.dx) ? Math.round(last.dx) : 0;
    const dy = Number.isFinite(last.dy) ? Math.round(last.dy) : 0;
    if (!dx && !dy) break;

    if (!changed) ensureBasemapAdjustHistoryV61();
    changed = true;
    project.basemap.offsetX = Math.round((Number(project.basemap.offsetX) || 0) + dx);
    project.basemap.offsetY = Math.round((Number(project.basemap.offsetY) || 0) + dy);
    totalDx += dx;
    totalDy += dy;
    wallDetectionCache = null;
  }

  invalidateBasemapComparisonV61(true);

  const status = $('reviewBasemapStatusV61');
  if (!last || (!last.matchesX && !last.matchesY)) {
    if (status) {
      status.textContent =
        'No reliable translation was found. Drag the basemap manually or use the arrow buttons.';
    }
    return;
  }

  if (status) {
    status.textContent =
      `Best fit moved the basemap ${totalDx.toLocaleString()} mm in X and ` +
      `${totalDy.toLocaleString()} mm in Y using ${last.matchesX + last.matchesY} wall matches. ` +
      'Check several outer and internal walls before continuing.';
  }

  if ($('basemapStatus')) {
    $('basemapStatus').hidden = false;
    $('basemapStatus').textContent =
      'Basemap position adjusted. Authored walls and calibrated image size were not changed.';
  }
}

function nudgeBasemapV61(dx, dy) {
  if (!project.basemap) return;
  ensureBasemapAdjustHistoryV61();
  setBasemapOffsetV61(
    (Number(project.basemap.offsetX) || 0) + dx,
    (Number(project.basemap.offsetY) || 0) + dy,
    true
  );

  const status = $('reviewBasemapStatusV61');
  if (status) status.textContent = `Nudged ${Math.abs(dx || dy).toLocaleString()} mm.`;
}

function deactivateBasemapAdjustV61() {
  basemapAdjustActiveV61 = false;
  basemapAdjustDragV61 = null;
  orbit.enabled = true;
  renderer.domElement.classList.remove('basemap-adjust-cursor-v61');
}

function activateBasemapAdjustV61() {
  if (!project.basemap || !basemapImage?.complete || !basemapImage.naturalWidth) return;

  basemapAdjustSessionV61 = {
    basemap: cloneBasemapRegistrationV61(),
    historyPushed: false
  };
  basemapAdjustActiveV61 = true;
  basemapGroup.visible = true;

  if ($('toggleBasemap')) $('toggleBasemap').classList.add('active');

  renderer.domElement.classList.add('basemap-adjust-cursor-v61');
  transform.detach();
  select(null);
  selectedArchitecture = null;
  updateArchitecturePanel();
  renderArchitectureList();
  setTool('select');

  if (typeof detectedWallHighlightGroupV28 !== 'undefined') {
    detectedWallHighlightGroupV28.visible = false;
  }
  if (typeof validationOverlayGroupV28 !== 'undefined') {
    validationOverlayGroupV28.visible = false;
  }

  // A top view makes direct basemap dragging predictable.
  viewTop();
  syncBasemapAdjustReadoutV61();

  const status = $('reviewBasemapStatusV61');
  if (status) {
    status.textContent =
      'Drag the floor plan to line it up with the authored walls, or use Best fit to walls. ' +
      'Only Offset X/Y will change.';
  }
}

function beginBasemapDragV61(event) {
  if (!basemapAdjustActiveV61 || event.button !== 0 || !project.basemap) return;

  const point = basemapAdjustPlanPointV61(event);
  if (!point) return;

  ensureBasemapAdjustHistoryV61();
  basemapAdjustDragV61 = {
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

function updateBasemapDragV61(event) {
  if (
    !basemapAdjustActiveV61 ||
    !basemapAdjustDragV61 ||
    event.pointerId !== basemapAdjustDragV61.pointerId
  ) return;

  const point = basemapAdjustPlanPointV61(event);
  if (!point) return;

  const dx = point.x - basemapAdjustDragV61.startPoint.x;
  const dy = point.y - basemapAdjustDragV61.startPoint.y;

  setBasemapOffsetV61(
    basemapAdjustDragV61.startOffsetX + dx,
    basemapAdjustDragV61.startOffsetY + dy,
    true
  );

  event.preventDefault();
  event.stopImmediatePropagation();
}

function endBasemapDragV61(event) {
  if (
    !basemapAdjustDragV61 ||
    (event.pointerId !== undefined && event.pointerId !== basemapAdjustDragV61.pointerId)
  ) return;

  renderer.domElement.releasePointerCapture?.(basemapAdjustDragV61.pointerId);
  basemapAdjustDragV61 = null;
  orbit.enabled = true;
  event.preventDefault?.();
  event.stopImmediatePropagation?.();
}

function setGuidedReviewStepV61(step) {
  reviewStepV36 = Math.max(1, Math.min(2, Number(step) || 1));

  reviewWorkflowV36.querySelectorAll('[data-review-step]').forEach(page => {
    page.hidden = Number(page.dataset.reviewStep) !== reviewStepV36;
  });

  $('reviewStepLabel').textContent = `Step ${reviewStepV36 + 1} of 3`;
  $('reviewProgressBar').style.width = `${(reviewStepV36 + 1) / 3 * 100}%`;

  if ($('reviewGuideTitle')) {
    $('reviewGuideTitle').textContent =
      reviewStepV36 === 1 ? 'Adjust basemap' : 'Correct architecture';
  }

  if (reviewStepV36 === 1) {
    activateBasemapAdjustV61();
  } else {
    deactivateBasemapAdjustV61();
  }
}

function continueToArchitectureReviewV61() {
  if (!reviewIsActiveV36()) return;

  deactivateBasemapAdjustV61();
  setGuidedReviewStepV61(2);
  reviewHighlightsVisibleV36 = true;

  setWallReviewStatusV32('Checking walls and openings against the adjusted basemap…');
  setReviewInstructionV36(
    'Add missing architecture, or select an incorrect wall, door or window to align or delete it. ' +
    'Double-click aligned overlapping walls to merge them.'
  );

  wallDetectionCache = null;
  detectWalls();
  detectDoorsV32();
  setFurnitureReviewVisibilityV32(false);

  if (typeof syncReviewCountsV36 === 'function') syncReviewCountsV36();
  if (typeof syncArchitectureReviewUiV36 === 'function') syncArchitectureReviewUiV36();
  if (typeof updateDetectedWallHighlightsV28 === 'function') {
    updateDetectedWallHighlightsV28(true);
  }
}

function installGuidedBasemapStepV61() {
  // Remove the old normal-panel button and floating panel from the previous build.
  $('adjustBasemap')?.remove();
  $('basemapAdjustPanelV60')?.remove();

  const workflow = $('wallReviewWorkflow');
  const architecturePage = workflow?.querySelector(
    '.review-guide-page[data-review-step="1"], .review-guide-page[data-review-step="2"]'
  );
  if (!workflow || !architecturePage) return;

  architecturePage.dataset.reviewStep = '2';

  if (!$('reviewBasemapPageV61')) {
    const adjustPage = document.createElement('div');
    adjustPage.id = 'reviewBasemapPageV61';
    adjustPage.className = 'review-guide-page';
    adjustPage.dataset.reviewStep = '1';
    adjustPage.innerHTML = `
      <h4>Match the floor plan to the walls</h4>
      <p>
        Drag the basemap itself until the printed wall bands line up with the authored walls.
        This changes only the basemap Offset X/Y; wall coordinates, scale, width, depth and crop stay unchanged.
      </p>
      <div class="review-navigation-help">
        <strong>Move the basemap</strong>
        <span>
          Left-drag the floor plan. Scroll to zoom and right-drag to pan.
          Use Best fit to walls for an automatic translation, then fine-tune manually.
        </span>
      </div>
      <div class="review-basemap-readout-v61" id="reviewBasemapReadoutV61"></div>
      <div class="button-row review-basemap-tools-v61">
        <button id="reviewBasemapBestFitV61" class="primary">Best fit to walls</button>
        <button id="reviewBasemapLeftV61" title="Nudge left">←</button>
        <button id="reviewBasemapUpV61" title="Nudge up">↑</button>
        <button id="reviewBasemapDownV61" title="Nudge down">↓</button>
        <button id="reviewBasemapRightV61" title="Nudge right">→</button>
      </div>
      <p class="wall-review-instruction" id="reviewBasemapStatusV61"></p>
      <div class="review-confirm-section">
        <button id="reviewBasemapContinueV61" class="primary review-confirm-button">
          Continue to correct architecture
        </button>
      </div>
    `;
    architecturePage.before(adjustPage);
  }

  $('reviewBasemapBestFitV61').onclick = bestFitBasemapPositionV61;
  $('reviewBasemapLeftV61').onclick = () => nudgeBasemapV61(-10, 0);
  $('reviewBasemapRightV61').onclick = () => nudgeBasemapV61(10, 0);
  $('reviewBasemapUpV61').onclick = () => nudgeBasemapV61(0, -10);
  $('reviewBasemapDownV61').onclick = () => nudgeBasemapV61(0, 10);
  $('reviewBasemapContinueV61').onclick = continueToArchitectureReviewV61;

  setReviewStepV36 = setGuidedReviewStepV61;
}

if (!document.getElementById('layoutRefinementStylesV61')) {
  const style = document.createElement('style');
  style.id = 'layoutRefinementStylesV61';
  style.textContent = `
    .basemap-adjust-cursor-v61 {
      cursor: move !important;
    }
    .review-basemap-readout-v61 {
      margin-top: 10px;
      color: var(--muted);
      font-size: 10px;
      line-height: 1.4;
    }
    .review-basemap-tools-v61 {
      display: grid;
      grid-template-columns: minmax(130px, 1fr) repeat(4, 36px);
      gap: 6px;
      margin-top: 10px;
    }
    .review-basemap-tools-v61 button {
      min-width: 0;
      padding-left: 7px;
      padding-right: 7px;
    }
    @media (max-width: 420px) {
      .review-basemap-tools-v61 {
        grid-template-columns: repeat(4, 1fr);
      }
      .review-basemap-tools-v61 button:first-child {
        grid-column: 1 / -1;
      }
    }
  `;
  document.head.appendChild(style);
}

installGuidedBasemapStepV61();

renderer.domElement.addEventListener('pointerdown', beginBasemapDragV61, true);
renderer.domElement.addEventListener('pointermove', updateBasemapDragV61, true);
renderer.domElement.addEventListener('pointerup', endBasemapDragV61, true);
renderer.domElement.addEventListener('pointercancel', endBasemapDragV61, true);

window.addEventListener('keydown', event => {
  if (!basemapAdjustActiveV61) return;

  const amount = event.shiftKey ? 100 : 10;
  const deltas = {
    ArrowLeft: [-amount, 0],
    ArrowRight: [amount, 0],
    ArrowUp: [0, -amount],
    ArrowDown: [0, amount]
  };

  if (!deltas[event.key]) return;

  event.preventDefault();
  event.stopImmediatePropagation();
  nudgeBasemapV61(...deltas[event.key]);
}, true);

// Preserve the existing review-session capture and all normal review UI setup,
// but suppress automatic basemap fitting and wall detection until Step 2 is done.
const beginWallReviewBeforeV61 = beginWallReviewV32;
beginWallReviewV32 = function(force = false) {
  const autoFitBefore = autoFitBasemap;
  const detectWallsBefore = detectWalls;
  const detectDoorsBefore = detectDoorsV32;

  autoFitBasemap = () => {};
  detectWalls = () => {};
  detectDoorsV32 = () => {};

  try {
    beginWallReviewBeforeV61(force);
  } finally {
    autoFitBasemap = autoFitBefore;
    detectWalls = detectWallsBefore;
    detectDoorsV32 = detectDoorsBefore;
  }

  if (!reviewIsActiveV36()) return;

  basemapAdjustSessionV61 = null;
  setGuidedReviewStepV61(1);
  setWallReviewStatusV32('Move the calibrated basemap to match the authored walls');
  setFurnitureReviewVisibilityV32(false);

  if (typeof syncArchitectureReviewUiV36 === 'function') {
    syncArchitectureReviewUiV36();
  }
};

// Exiting and discarding restores the review snapshot, including the original
// basemap offset. Also leave drag mode cleanly.
const restoreReviewSessionBeforeV61 = restoreReviewSessionV36;
restoreReviewSessionV36 = function(snapshot) {
  deactivateBasemapAdjustV61();
  basemapAdjustSessionV61 = null;
  return restoreReviewSessionBeforeV61(snapshot);
};

$('confirmWallReview')?.addEventListener('click', () => {
  deactivateBasemapAdjustV61();
  basemapAdjustSessionV61 = null;
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
