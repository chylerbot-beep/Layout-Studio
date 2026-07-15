// Shift selection labels and resilient hidden-furniture label cleanup.
// Loads after app-parts/31.js and before app-parts/08.js.

const layoutSelectionAssistVersionV65 = '20260715-shift-selection-labels-v65';
let selectionAssistActiveV65 = false;
let selectionAssistSuppressedUntilShiftUpV65 = false;
let selectionAssistOverlayV65 = null;
let selectionAssistLastRenderV65 = 0;
const selectionAssistFrustumV65 = new THREE.Frustum();
const selectionAssistProjectionV65 = new THREE.Matrix4();

function activeTextEntryV65() {
  const active = document.activeElement;
  return !!active && (
    active.matches?.('input,textarea,select,[contenteditable="true"]') ||
    active.isContentEditable
  );
}

function visibleThroughParentsV65(object) {
  let current = object;
  while (current) {
    if (current.visible === false) return false;
    current = current.parent;
  }
  return true;
}

function furnitureIdForAnyLabelV65(label) {
  if (typeof furnitureIdForLabelV60 === 'function') {
    const id = furnitureIdForLabelV60(label);
    if (id) return id;
  }
  if (label.userData?.furnitureIdV60) return label.userData.furnitureIdV60;
  const candidates = [
    label.userData?.id,
    label.userData?.objectId,
    ...(Array.isArray(label.userData?.ignoreIds) ? label.userData.ignoreIds : [])
  ].filter(Boolean);
  return candidates.find(id => (project.furniture || []).some(item => item.id === id)) || null;
}

function hiddenFurnitureIdsForLabelsV65() {
  if (typeof hiddenFurnitureIdsV42 !== 'function') return new Set();
  try {
    return hiddenFurnitureIdsV42();
  } catch (error) {
    console.warn('Could not read hidden furniture IDs while cleaning labels.', error);
    return new Set();
  }
}

function enforceHiddenFurnitureLabelsV65() {
  if (!labelGroup || !furnitureGroup) return;
  const hiddenIds = hiddenFurnitureIdsForLabelsV65();
  const visibleById = new Map(
    furnitureGroup.children
      .filter(object => object.userData?.id)
      .map(object => [object.userData.id, visibleThroughParentsV65(object) && !hiddenIds.has(object.userData.id)])
  );

  labelGroup.children.forEach(label => {
    const id = furnitureIdForAnyLabelV65(label);
    if (!id) return;
    const hidden = hiddenIds.has(id) || visibleById.get(id) !== true;
    label.userData = label.userData || {};
    label.userData.hiddenByFurnitureV65 = hidden;
    if (hidden) {
      label.visible = false;
      label.userData.hiddenByFurnitureV60 = true;
    }
  });
}

function selectionAssistWorldPointV65(object, kind) {
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) return null;
  const point = box.getCenter(new THREE.Vector3());
  if (kind === 'object') point.y = box.max.y + Math.min(.18, Math.max(.05, (box.max.y - box.min.y) * .08));
  return { box, point };
}

function selectionAssistEntryVisibleV65(object, box, point) {
  if (!visibleThroughParentsV65(object)) return false;
  if (!selectionAssistFrustumV65.intersectsBox(box)) return false;
  const projected = point.clone().project(camera);
  return projected.z >= -1 && projected.z <= 1 && Math.abs(projected.x) <= 1.08 && Math.abs(projected.y) <= 1.08;
}

function collectSelectionAssistEntriesV65() {
  camera.updateMatrixWorld();
  selectionAssistProjectionV65.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  selectionAssistFrustumV65.setFromProjectionMatrix(selectionAssistProjectionV65);

  const entries = [];
  const hiddenFurniture = hiddenFurnitureIdsForLabelsV65();

  if (furnitureGroup?.visible !== false) {
    furnitureGroup.children.forEach(object => {
      const id = object.userData?.id;
      if (!id || hiddenFurniture.has(id) || !visibleThroughParentsV65(object)) return;
      const geometry = selectionAssistWorldPointV65(object, 'object');
      if (!geometry || !selectionAssistEntryVisibleV65(object, geometry.box, geometry.point)) return;
      const item = (project.furniture || []).find(candidate => candidate.id === id);
      entries.push({
        kind: 'object',
        id,
        name: item?.name || object.userData?.name || 'Object',
        category: item?.category || object.userData?.category || 'furniture',
        point: geometry.point
      });
    });
  }

  const seenWalls = new Set();
  if (shellGroup?.visible !== false) {
    shellGroup.children.forEach(object => {
      const id = object.userData?.id;
      if (!object.userData?.wall || !id || seenWalls.has(id) || !visibleThroughParentsV65(object)) return;
      const geometry = selectionAssistWorldPointV65(object, 'wall');
      if (!geometry || !selectionAssistEntryVisibleV65(object, geometry.box, geometry.point)) return;
      seenWalls.add(id);
      const wall = (project.walls || []).find(candidate => candidate.id === id);
      entries.push({
        kind: 'wall',
        id,
        name: wall?.name || object.userData?.name || 'Wall',
        category: 'wall',
        point: geometry.point
      });
    });
  }

  // Make repeated names distinguishable without permanently renaming project data.
  const totals = new Map();
  entries.forEach(entry => totals.set(entry.name, (totals.get(entry.name) || 0) + 1));
  const running = new Map();
  entries.forEach(entry => {
    const number = (running.get(entry.name) || 0) + 1;
    running.set(entry.name, number);
    entry.displayName = totals.get(entry.name) > 1 ? `${entry.name} ${number}` : entry.name;
  });

  return entries;
}

function selectionAssistCanvasMetricsV65() {
  const viewport = $('viewport');
  const canvas = renderer?.domElement;
  if (!viewport || !canvas) return null;
  const viewportRect = viewport.getBoundingClientRect();
  const canvasRect = canvas.getBoundingClientRect();
  if (!canvasRect.width || !canvasRect.height) return null;
  return { viewportRect, canvasRect };
}

function selectionAssistScreenPointV65(point, metrics) {
  const projected = point.clone().project(camera);
  return {
    x: metrics.canvasRect.left - metrics.viewportRect.left + (projected.x + 1) * .5 * metrics.canvasRect.width,
    y: metrics.canvasRect.top - metrics.viewportRect.top + (1 - projected.y) * .5 * metrics.canvasRect.height
  };
}

function rectanglesOverlapV65(a, b, gap = 5) {
  return !(
    a.right + gap < b.left ||
    a.left - gap > b.right ||
    a.bottom + gap < b.top ||
    a.top - gap > b.bottom
  );
}

function placeSelectionAssistLabelV65(anchor, text, occupied, bounds) {
  const width = Math.max(92, Math.min(260, 34 + text.length * 7.4));
  const height = 32;
  const offsets = [
    [0, -25], [0, 25], [0, -61], [0, 61],
    [72, -25], [-72, -25], [72, 25], [-72, 25],
    [0, -97], [0, 97], [144, -25], [-144, -25]
  ];

  let chosen = null;
  for (const [dx, dy] of offsets) {
    const centreX = Math.max(width / 2 + 6, Math.min(bounds.width - width / 2 - 6, anchor.x + dx));
    const centreY = Math.max(height / 2 + 8, Math.min(bounds.height - height / 2 - 8, anchor.y + dy));
    const rect = {
      left: centreX - width / 2,
      right: centreX + width / 2,
      top: centreY - height / 2,
      bottom: centreY + height / 2,
      centreX,
      centreY,
      width,
      height
    };
    if (!occupied.some(other => rectanglesOverlapV65(rect, other))) {
      chosen = rect;
      break;
    }
  }

  if (!chosen) {
    const centreX = Math.max(width / 2 + 6, Math.min(bounds.width - width / 2 - 6, anchor.x));
    const centreY = Math.max(height / 2 + 8, Math.min(bounds.height - height / 2 - 8, anchor.y));
    chosen = {
      left: centreX - width / 2,
      right: centreX + width / 2,
      top: centreY - height / 2,
      bottom: centreY + height / 2,
      centreX,
      centreY,
      width,
      height
    };
  }

  occupied.push(chosen);
  return chosen;
}

function addSelectionAssistLineV65(anchor, labelRect) {
  const dx = labelRect.centreX - anchor.x;
  const dy = labelRect.centreY - anchor.y;
  const length = Math.hypot(dx, dy);
  if (length < 16) return;
  const line = document.createElement('span');
  line.className = 'selection-assist-line-v65';
  line.style.left = `${anchor.x}px`;
  line.style.top = `${anchor.y}px`;
  line.style.width = `${length}px`;
  line.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
  selectionAssistOverlayV65.appendChild(line);
}

function selectFromAssistLabelV65(entry) {
  if (typeof photoModeActiveV31 !== 'undefined' && photoModeActiveV31 && typeof exitPhotoModeV31 === 'function') {
    exitPhotoModeV31();
  }

  if (entry.kind === 'wall') {
    selectArchitecture('wall', entry.id);
  } else {
    const object = furnitureGroup.children.find(candidate => candidate.userData?.id === entry.id);
    if (object) select(object);
  }

  selectionAssistSuppressedUntilShiftUpV65 = true;
  hideSelectionAssistV65();
}

function renderSelectionAssistV65(force = false) {
  if (!selectionAssistActiveV65 || !selectionAssistOverlayV65) return;
  const now = performance.now();
  if (!force && now - selectionAssistLastRenderV65 < 70) return;
  selectionAssistLastRenderV65 = now;

  enforceHiddenFurnitureLabelsV65();
  const metrics = selectionAssistCanvasMetricsV65();
  if (!metrics) return;
  const entries = collectSelectionAssistEntriesV65();
  selectionAssistOverlayV65.replaceChildren();

  const hint = document.createElement('div');
  hint.className = 'selection-assist-hint-v65';
  hint.textContent = 'Click a label to select · release Shift to close';
  selectionAssistOverlayV65.appendChild(hint);

  const occupied = [];
  const bounds = {
    width: metrics.viewportRect.width,
    height: metrics.viewportRect.height
  };

  entries
    .map(entry => ({ ...entry, anchor: selectionAssistScreenPointV65(entry.point, metrics) }))
    .sort((a, b) => a.anchor.y - b.anchor.y || a.anchor.x - b.anchor.x)
    .forEach(entry => {
      const rect = placeSelectionAssistLabelV65(entry.anchor, entry.displayName, occupied, bounds);
      addSelectionAssistLineV65(entry.anchor, rect);

      const button = document.createElement('button');
      button.type = 'button';
      button.className = `selection-assist-label-v65 selection-assist-${entry.kind}-v65`;
      button.textContent = entry.displayName;
      button.title = `Select ${entry.name}`;
      button.setAttribute('aria-label', `Select ${entry.name}`);
      button.style.left = `${rect.centreX}px`;
      button.style.top = `${rect.centreY}px`;
      button.style.width = `${rect.width}px`;
      button.onpointerdown = event => {
        event.preventDefault();
        event.stopPropagation();
      };
      button.onclick = event => {
        event.preventDefault();
        event.stopPropagation();
        selectFromAssistLabelV65(entry);
      };
      selectionAssistOverlayV65.appendChild(button);
    });
}

function showSelectionAssistV65() {
  if (selectionAssistSuppressedUntilShiftUpV65 || activeTextEntryV65()) return;
  selectionAssistActiveV65 = true;
  selectionAssistOverlayV65?.classList.add('active');
  renderSelectionAssistV65(true);
}

function hideSelectionAssistV65() {
  selectionAssistActiveV65 = false;
  if (selectionAssistOverlayV65) {
    selectionAssistOverlayV65.classList.remove('active');
    selectionAssistOverlayV65.replaceChildren();
  }
}

function createSelectionAssistOverlayV65() {
  if (selectionAssistOverlayV65) return;
  const viewport = $('viewport');
  if (!viewport) return;
  selectionAssistOverlayV65 = document.createElement('div');
  selectionAssistOverlayV65.id = 'selectionAssistOverlayV65';
  selectionAssistOverlayV65.setAttribute('aria-hidden', 'true');
  viewport.appendChild(selectionAssistOverlayV65);
}

if (!document.getElementById('layoutSelectionAssistStylesV65')) {
  const style = document.createElement('style');
  style.id = 'layoutSelectionAssistStylesV65';
  style.textContent = `
    #viewport{position:relative}
    #selectionAssistOverlayV65{
      position:absolute;
      inset:0;
      z-index:54;
      display:none;
      pointer-events:none;
      overflow:hidden;
    }
    #selectionAssistOverlayV65.active{display:block}
    .selection-assist-hint-v65{
      position:absolute;
      top:12px;
      left:50%;
      transform:translateX(-50%);
      padding:7px 12px;
      border:1px solid rgba(145,165,138,.72);
      border-radius:999px;
      background:rgba(25,28,24,.9);
      color:#f5f5ef;
      font-size:12px;
      font-weight:650;
      letter-spacing:.01em;
      white-space:nowrap;
      box-shadow:0 8px 26px rgba(0,0,0,.28);
    }
    .selection-assist-label-v65{
      position:absolute;
      transform:translate(-50%,-50%);
      min-height:32px;
      padding:6px 10px;
      pointer-events:auto;
      cursor:pointer;
      border:1px solid rgba(145,165,138,.95);
      border-radius:8px;
      background:rgba(27,31,26,.94);
      color:#f7f7f1;
      font:650 14px/1.15 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      overflow:hidden;
      text-overflow:ellipsis;
      white-space:nowrap;
      box-shadow:0 5px 18px rgba(0,0,0,.34);
    }
    .selection-assist-label-v65:hover,
    .selection-assist-label-v65:focus-visible{
      background:rgba(92,111,82,.98);
      border-color:#dce8d5;
      outline:none;
      transform:translate(-50%,-50%) scale(1.06);
    }
    .selection-assist-wall-v65{
      border-color:rgba(103,168,224,.95);
      background:rgba(28,48,64,.94);
    }
    .selection-assist-line-v65{
      position:absolute;
      height:1px;
      transform-origin:0 50%;
      background:rgba(225,232,220,.58);
      pointer-events:none;
    }
  `;
  document.head.appendChild(style);
}

queueMicrotask(() => {
  createSelectionAssistOverlayV65();

  const help = $('help');
  if (help && !help.textContent.includes('Hold Shift')) {
    help.textContent += ' · hold Shift to select by label';
  }

  const updateLabelOcclusionBeforeV65 = updateLabelOcclusion;
  updateLabelOcclusion = function() {
    const result = updateLabelOcclusionBeforeV65();
    enforceHiddenFurnitureLabelsV65();
    return result;
  };

  if (typeof applyCameraFurnitureVisibilityV42 === 'function') {
    const applyCameraFurnitureVisibilityBeforeV65 = applyCameraFurnitureVisibilityV42;
    applyCameraFurnitureVisibilityV42 = function() {
      const result = applyCameraFurnitureVisibilityBeforeV65();
      enforceHiddenFurnitureLabelsV65();
      if (selectionAssistActiveV65) renderSelectionAssistV65(true);
      return result;
    };
  }

  const buildSceneBeforeV65 = buildScene;
  buildScene = function() {
    const result = buildSceneBeforeV65();
    enforceHiddenFurnitureLabelsV65();
    if (selectionAssistActiveV65) renderSelectionAssistV65(true);
    return result;
  };

  window.addEventListener('keydown', event => {
    if (event.key !== 'Shift' || event.repeat) return;
    showSelectionAssistV65();
  }, true);

  window.addEventListener('keyup', event => {
    if (event.key !== 'Shift') return;
    selectionAssistSuppressedUntilShiftUpV65 = false;
    hideSelectionAssistV65();
  }, true);

  window.addEventListener('blur', () => {
    selectionAssistSuppressedUntilShiftUpV65 = false;
    hideSelectionAssistV65();
  });

  orbit.addEventListener('change', () => {
    enforceHiddenFurnitureLabelsV65();
    if (selectionAssistActiveV65) renderSelectionAssistV65();
  });
  transform.addEventListener('change', () => {
    if (selectionAssistActiveV65) renderSelectionAssistV65();
  });

  setInterval(() => {
    if (document.hidden) return;
    enforceHiddenFurnitureLabelsV65();
    if (selectionAssistActiveV65) renderSelectionAssistV65();
  }, 120);

  enforceHiddenFurnitureLabelsV65();
});
