// Architecture-review selection assistance, draggable wall openings and eye-level minimap.
// Loads after app-parts/32.js and before app-parts/08.js.

const layoutNavigationVersionV66 = '20260715-review-door-minimap-v66';

// -----------------------------------------------------------------------------
// Doors and windows can be dragged along their host wall.
// -----------------------------------------------------------------------------

beginOpeningDragV45 = function(opening, event) {
  if (!opening || !['door', 'window'].includes(opening.type)) return false;
  openingDrag = {
    pointerId: event.pointerId,
    openingId: opening.id,
    originalOffset: +opening.offset || 0,
    startX: event.clientX,
    startY: event.clientY,
    history: false,
    lastRender: 0
  };
  orbit.enabled = false;
  renderer.domElement.setPointerCapture?.(event.pointerId);
  const type = opening.type === 'door' ? 'Door' : 'Window';
  $('toolHint').hidden = false;
  $('toolHint').textContent = `${type} selected. Drag along the wall to reposition it.`;
  return true;
};

updateOpeningDragV45 = function(event) {
  if (!openingDrag || event.pointerId !== openingDrag.pointerId) return;
  const opening = (project.openings || []).find(item => item.id === openingDrag.openingId);
  const wall = opening && (project.walls || []).find(item => item.id === opening.wallId);
  const point = planPoint(event, 25);
  if (!opening || !wall || !point) return;

  if (!openingDrag.history && Math.hypot(event.clientX - openingDrag.startX, event.clientY - openingDrag.startY) < 3) return;
  if (!openingDrag.history) {
    pushHistory(`move ${opening.type || 'opening'} along wall`);
    openingDrag.history = true;
  }

  const metrics = wallMetrics(wall);
  const minimum = (+opening.width || 300) / 2 + 25;
  const maximum = Math.max(minimum, metrics.length - minimum);
  const raw = (point.x - metrics.x1) * metrics.ux + (point.y - metrics.y1) * metrics.uy;
  opening.offset = Math.round(Math.max(minimum, Math.min(maximum, raw)) / 25) * 25;

  const now = performance.now();
  if (now - openingDrag.lastRender > 32) {
    openingDrag.lastRender = now;
    refreshArchitectureVisuals(false);
    populateArchitectureFields('opening', opening);
    $('toolHint').hidden = false;
    $('toolHint').textContent = `${opening.type === 'door' ? 'Door' : 'Window'} follows the wall. Release to finish.`;
  }
};

endOpeningDragV45 = function(event, cancel = false) {
  if (!openingDrag || (event.pointerId !== undefined && event.pointerId !== openingDrag.pointerId)) return;
  const id = openingDrag.openingId;
  const opening = (project.openings || []).find(item => item.id === id);
  const moved = openingDrag.history;
  renderer.domElement.releasePointerCapture?.(openingDrag.pointerId);
  openingDrag = null;
  orbit.enabled = true;

  if (moved) {
    refreshArchitectureVisuals(true);
    selectArchitecture('opening', id);
    $('toolHint').hidden = false;
    $('toolHint').textContent = `${opening?.type === 'door' ? 'Door' : 'Window'} repositioned. Drag it again or use Opening offset for an exact position.`;
  } else if (cancel) {
    $('toolHint').hidden = false;
    $('toolHint').textContent = 'Opening drag ended.';
  }
};

// -----------------------------------------------------------------------------
// Shift labels also cover doors/windows and remain above the architecture review.
// -----------------------------------------------------------------------------

function openingSelectionAssistEntriesV66() {
  if (!openingGroup || openingGroup.visible === false) return [];
  const entries = [];
  const seen = new Set();

  (project.openings || []).forEach(opening => {
    if (!opening?.id || seen.has(opening.id)) return;
    const wall = (project.walls || []).find(candidate => candidate.id === opening.wallId);
    const object = openingGroup.children.find(candidate => candidate.userData?.id === opening.id);
    if (!wall || !object || !visibleThroughParentsV65(object)) return;

    const metrics = wallMetrics(wall);
    const centreX = metrics.x1 + metrics.ux * (+opening.offset || 0);
    const centreY = metrics.y1 + metrics.uy * (+opening.offset || 0);
    const worldY = opening.type === 'window'
      ? mm((+opening.sill || 0) + (+opening.height || 1200) / 2)
      : .22;
    const point = new THREE.Vector3(mm(centreX), worldY, mm(centreY));
    const halfWidth = mm(Math.max(300, +opening.width || 750)) / 2;
    const halfHeight = opening.type === 'window'
      ? mm(Math.max(300, +opening.height || 1200)) / 2
      : .24;
    const box = new THREE.Box3(
      new THREE.Vector3(point.x - halfWidth, Math.max(0, point.y - halfHeight), point.z - .12),
      new THREE.Vector3(point.x + halfWidth, point.y + halfHeight, point.z + .12)
    );

    if (!selectionAssistEntryVisibleV65(object, box, point)) return;
    seen.add(opening.id);
    entries.push({
      kind: 'opening',
      id: opening.id,
      name: opening.name || (opening.type === 'door' ? 'Door' : 'Window'),
      category: opening.type || 'opening',
      point
    });
  });

  return entries;
}

function refreshSelectionAssistNamesV66(entries) {
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

const collectSelectionAssistEntriesBeforeV66 = collectSelectionAssistEntriesV65;
collectSelectionAssistEntriesV65 = function() {
  const entries = collectSelectionAssistEntriesBeforeV66();
  const existing = new Set(entries.map(entry => `${entry.kind}:${entry.id}`));
  openingSelectionAssistEntriesV66().forEach(entry => {
    if (!existing.has(`${entry.kind}:${entry.id}`)) entries.push(entry);
  });
  return refreshSelectionAssistNamesV66(entries);
};

selectFromAssistLabelV65 = function(entry) {
  if (typeof photoModeActiveV31 !== 'undefined' && photoModeActiveV31 && typeof exitPhotoModeV31 === 'function') {
    exitPhotoModeV31();
  }

  if (entry.kind === 'wall') {
    selectArchitecture('wall', entry.id);
  } else if (entry.kind === 'opening') {
    selectArchitecture('opening', entry.id);
  } else {
    const object = furnitureGroup.children.find(candidate => candidate.userData?.id === entry.id);
    if (object) select(object);
  }

  selectionAssistSuppressedUntilShiftUpV65 = true;
  hideSelectionAssistV65();
};

const showSelectionAssistBeforeV66 = showSelectionAssistV65;
showSelectionAssistV65 = function() {
  showSelectionAssistBeforeV66();
  if (!selectionAssistOverlayV65) return;
  selectionAssistOverlayV65.classList.toggle(
    'architecture-review-selection-v66',
    document.body.classList.contains('architecture-review-mode')
  );
};

// -----------------------------------------------------------------------------
// Eye-level top-down minimap. Click or drag to relocate the camera on plan.
// -----------------------------------------------------------------------------

let eyeMiniMapV66 = null;
let eyeMiniMapCanvasV66 = null;
let eyeMiniMapContextV66 = null;
let eyeMiniMapTransformV66 = null;
let eyeMiniMapDraggingV66 = false;
let eyeMiniMapLastDrawV66 = 0;

function eyeLevelModeActiveV66() {
  return !!$('viewEye')?.classList.contains('active');
}

function eyeMiniMapPlanExtentV66() {
  const xs = [];
  const ys = [];
  const add = (x, y) => {
    if (Number.isFinite(+x)) xs.push(+x);
    if (Number.isFinite(+y)) ys.push(+y);
  };

  const basemap = project.basemap;
  if (basemap) {
    const x = +basemap.offsetX || 0;
    const y = +basemap.offsetY || 0;
    add(x, y);
    add(x + (+basemap.width || PLAN_W), y + (+basemap.depth || PLAN_H));
  }

  (project.rooms || []).forEach(room => {
    add(room.x, room.y);
    add((+room.x || 0) + (+room.w || 0), (+room.y || 0) + (+room.d || 0));
  });
  (project.walls || []).forEach(wall => {
    const metrics = wallMetrics(wall);
    add(metrics.x1, metrics.y1);
    add(metrics.x2, metrics.y2);
  });
  (project.furniture || []).forEach(item => {
    add(item.x, item.y);
    add((+item.x || 0) + (+item.w || 0), (+item.y || 0) + (+item.d || 0));
  });

  if (!xs.length || !ys.length) {
    xs.push(0, PLAN_W);
    ys.push(0, PLAN_H);
  }

  let minX = Math.min(...xs);
  let maxX = Math.max(...xs);
  let minY = Math.min(...ys);
  let maxY = Math.max(...ys);
  const spanX = Math.max(1000, maxX - minX);
  const spanY = Math.max(1000, maxY - minY);
  const padding = Math.max(350, Math.min(900, Math.max(spanX, spanY) * .045));
  minX -= padding;
  maxX += padding;
  minY -= padding;
  maxY += padding;
  return { minX, maxX, minY, maxY, spanX: maxX - minX, spanY: maxY - minY };
}

function eyeMiniMapCanvasSizeV66() {
  if (!eyeMiniMapCanvasV66) return null;
  const rect = eyeMiniMapCanvasV66.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  const ratio = Math.max(1, Math.min(2.5, window.devicePixelRatio || 1));
  const width = Math.round(rect.width * ratio);
  const height = Math.round(rect.height * ratio);
  if (eyeMiniMapCanvasV66.width !== width || eyeMiniMapCanvasV66.height !== height) {
    eyeMiniMapCanvasV66.width = width;
    eyeMiniMapCanvasV66.height = height;
  }
  return { rect, ratio, width, height };
}

function eyeMiniMapBuildTransformV66(size, extent) {
  const pad = 12 * size.ratio;
  const usableW = Math.max(1, size.width - pad * 2);
  const usableH = Math.max(1, size.height - pad * 2);
  const scale = Math.min(usableW / extent.spanX, usableH / extent.spanY);
  const drawW = extent.spanX * scale;
  const drawH = extent.spanY * scale;
  return {
    ...extent,
    scale,
    left: (size.width - drawW) / 2,
    top: (size.height - drawH) / 2,
    drawW,
    drawH,
    ratio: size.ratio,
    rect: size.rect
  };
}

function eyeMiniMapToCanvasV66(x, y) {
  const t = eyeMiniMapTransformV66;
  return {
    x: t.left + (x - t.minX) * t.scale,
    y: t.top + (y - t.minY) * t.scale
  };
}

function eyeMiniMapFromPointerV66(event) {
  const t = eyeMiniMapTransformV66;
  if (!t) return null;
  const px = (event.clientX - t.rect.left) * t.ratio;
  const py = (event.clientY - t.rect.top) * t.ratio;
  return {
    x: Math.max(t.minX, Math.min(t.maxX, t.minX + (px - t.left) / t.scale)),
    y: Math.max(t.minY, Math.min(t.maxY, t.minY + (py - t.top) / t.scale))
  };
}

function drawEyeMiniMapV66(force = false) {
  if (!eyeMiniMapV66 || !eyeMiniMapCanvasV66 || !eyeLevelModeActiveV66()) return;
  const now = performance.now();
  if (!force && now - eyeMiniMapLastDrawV66 < 70) return;
  eyeMiniMapLastDrawV66 = now;

  const size = eyeMiniMapCanvasSizeV66();
  if (!size) return;
  const context = eyeMiniMapContextV66;
  const extent = eyeMiniMapPlanExtentV66();
  eyeMiniMapTransformV66 = eyeMiniMapBuildTransformV66(size, extent);
  const t = eyeMiniMapTransformV66;

  context.clearRect(0, 0, size.width, size.height);
  context.fillStyle = '#ecebe6';
  context.fillRect(0, 0, size.width, size.height);

  // Rooms provide a light spatial guide.
  context.lineWidth = Math.max(1, size.ratio);
  (project.rooms || []).forEach(room => {
    const a = eyeMiniMapToCanvasV66(+room.x || 0, +room.y || 0);
    const b = eyeMiniMapToCanvasV66((+room.x || 0) + (+room.w || 0), (+room.y || 0) + (+room.d || 0));
    context.fillStyle = 'rgba(153,156,148,.10)';
    context.strokeStyle = 'rgba(112,115,108,.22)';
    context.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
    context.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
  });

  // Furniture and other placed objects.
  (project.furniture || []).forEach(item => {
    const a = eyeMiniMapToCanvasV66(+item.x || 0, +item.y || 0);
    const b = eyeMiniMapToCanvasV66((+item.x || 0) + (+item.w || 0), (+item.y || 0) + (+item.d || 0));
    context.fillStyle = 'rgba(105,111,102,.28)';
    context.fillRect(a.x, a.y, Math.max(1, b.x - a.x), Math.max(1, b.y - a.y));
  });

  // Walls.
  context.lineCap = 'square';
  (project.walls || []).forEach(wall => {
    const metrics = wallMetrics(wall);
    const a = eyeMiniMapToCanvasV66(metrics.x1, metrics.y1);
    const b = eyeMiniMapToCanvasV66(metrics.x2, metrics.y2);
    context.strokeStyle = '#4f514d';
    context.lineWidth = Math.max(2 * size.ratio, Math.min(6 * size.ratio, metrics.thickness * t.scale));
    context.beginPath();
    context.moveTo(a.x, a.y);
    context.lineTo(b.x, b.y);
    context.stroke();
  });

  // Doors and windows sit on top of their wall line.
  (project.openings || []).forEach(opening => {
    const wall = (project.walls || []).find(candidate => candidate.id === opening.wallId);
    if (!wall) return;
    const metrics = wallMetrics(wall);
    const half = (+opening.width || 750) / 2;
    const start = eyeMiniMapToCanvasV66(
      metrics.x1 + metrics.ux * ((+opening.offset || 0) - half),
      metrics.y1 + metrics.uy * ((+opening.offset || 0) - half)
    );
    const end = eyeMiniMapToCanvasV66(
      metrics.x1 + metrics.ux * ((+opening.offset || 0) + half),
      metrics.y1 + metrics.uy * ((+opening.offset || 0) + half)
    );
    context.strokeStyle = opening.type === 'window' ? '#6a9fb7' : '#c49357';
    context.lineWidth = Math.max(2, 2.2 * size.ratio);
    context.beginPath();
    context.moveTo(start.x, start.y);
    context.lineTo(end.x, end.y);
    context.stroke();
  });

  // Current eye-level camera position and heading.
  const cameraPoint = eyeMiniMapToCanvasV66(camera.position.x / MM, camera.position.z / MM);
  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  forward.y = 0;
  if (forward.lengthSq() < .0001) forward.set(0, 0, -1);
  forward.normalize();
  const arrowLength = 20 * size.ratio;

  context.strokeStyle = '#2f8f48';
  context.fillStyle = '#55bd6a';
  context.lineWidth = 2.2 * size.ratio;
  context.beginPath();
  context.moveTo(cameraPoint.x, cameraPoint.y);
  context.lineTo(cameraPoint.x + forward.x * arrowLength, cameraPoint.y + forward.z * arrowLength);
  context.stroke();
  context.beginPath();
  context.arc(cameraPoint.x, cameraPoint.y, 5.5 * size.ratio, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = '#ffffff';
  context.lineWidth = 1.5 * size.ratio;
  context.stroke();
}

function moveEyeCameraFromMiniMapV66(event) {
  if (!eyeLevelModeActiveV66()) return;
  const planPoint = eyeMiniMapFromPointerV66(event);
  if (!planPoint) return;

  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  forward.y = 0;
  if (forward.lengthSq() < .0001) {
    forward.copy(orbit.target).sub(camera.position);
    forward.y = 0;
  }
  if (forward.lengthSq() < .0001) forward.set(0, 0, -1);
  forward.normalize();

  const currentLookDistance = Math.max(
    1.8,
    Math.hypot(orbit.target.x - camera.position.x, orbit.target.z - camera.position.z)
  );
  const worldX = mm(planPoint.x);
  const worldZ = mm(planPoint.y);
  camera.position.x = worldX;
  camera.position.z = worldZ;
  orbit.target.set(
    worldX + forward.x * currentLookDistance,
    camera.position.y,
    worldZ + forward.z * currentLookDistance
  );
  if (typeof applyEyeHorizontalLockV62 === 'function') applyEyeHorizontalLockV62();
  orbit.update();

  if (typeof scheduleCameraCutaway === 'function') scheduleCameraCutaway();
  if (typeof scheduleCameraFurnitureVisibilityV42 === 'function') scheduleCameraFurnitureVisibilityV42();
  if (typeof scheduleEyeLabelCleanup === 'function') scheduleEyeLabelCleanup();
  drawEyeMiniMapV66(true);
}

function syncEyeMiniMapVisibilityV66() {
  if (!eyeMiniMapV66) return;
  const visible = eyeLevelModeActiveV66();
  eyeMiniMapV66.classList.toggle('visible', visible);
  eyeMiniMapV66.setAttribute('aria-hidden', visible ? 'false' : 'true');
  if (visible) requestAnimationFrame(() => drawEyeMiniMapV66(true));
}

function createEyeMiniMapV66() {
  if (eyeMiniMapV66) return;
  const viewport = $('viewport');
  if (!viewport) return;

  eyeMiniMapV66 = document.createElement('section');
  eyeMiniMapV66.id = 'eyeMiniMapV66';
  eyeMiniMapV66.setAttribute('aria-label', 'Eye-level top-down navigation map');
  eyeMiniMapV66.setAttribute('aria-hidden', 'true');
  eyeMiniMapV66.innerHTML = `
    <div class="eye-minimap-heading-v66">
      <strong>Top view</strong><span>click or drag to move</span>
    </div>
    <canvas id="eyeMiniMapCanvasV66"></canvas>`;
  viewport.appendChild(eyeMiniMapV66);
  eyeMiniMapCanvasV66 = $('eyeMiniMapCanvasV66');
  eyeMiniMapContextV66 = eyeMiniMapCanvasV66.getContext('2d');

  eyeMiniMapCanvasV66.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    eyeMiniMapDraggingV66 = true;
    eyeMiniMapCanvasV66.setPointerCapture?.(event.pointerId);
    moveEyeCameraFromMiniMapV66(event);
    event.preventDefault();
    event.stopPropagation();
  });
  eyeMiniMapCanvasV66.addEventListener('pointermove', event => {
    if (!eyeMiniMapDraggingV66) return;
    moveEyeCameraFromMiniMapV66(event);
    event.preventDefault();
    event.stopPropagation();
  });
  const finish = event => {
    if (!eyeMiniMapDraggingV66) return;
    eyeMiniMapDraggingV66 = false;
    eyeMiniMapCanvasV66.releasePointerCapture?.(event.pointerId);
    event.preventDefault();
    event.stopPropagation();
  };
  eyeMiniMapCanvasV66.addEventListener('pointerup', finish);
  eyeMiniMapCanvasV66.addEventListener('pointercancel', finish);
  eyeMiniMapCanvasV66.addEventListener('contextmenu', event => event.preventDefault());
}

if (!document.getElementById('layoutNavigationStylesV66')) {
  const style = document.createElement('style');
  style.id = 'layoutNavigationStylesV66';
  style.textContent = `
    #selectionAssistOverlayV65{z-index:120!important}
    body.architecture-review-mode #selectionAssistOverlayV65.active{display:block!important}
    #selectionAssistOverlayV65 .selection-assist-label-v65:hover,
    #selectionAssistOverlayV65 .selection-assist-label-v65:focus-visible{
      background:#58ad63!important;
      border-color:#d9ffde!important;
      color:#102114!important;
      box-shadow:0 0 0 3px rgba(101,205,116,.28),0 7px 22px rgba(0,0,0,.42)!important;
      transform:translate(-50%,-50%) scale(1.08)!important;
    }
    #selectionAssistOverlayV65 .selection-assist-opening-v65{
      border-color:rgba(216,173,99,.98);
      background:rgba(72,53,29,.95);
    }
    #selectionAssistOverlayV65.architecture-review-selection-v66 .selection-assist-hint-v65::after{
      content:' · architecture labels enabled';
    }
    #eyeMiniMapV66{
      position:absolute;
      top:14px;
      right:14px;
      z-index:56;
      width:min(246px,calc(100% - 28px));
      padding:8px;
      display:none;
      border:1px solid rgba(65,66,59,.9);
      border-radius:11px;
      background:rgba(30,31,28,.94);
      box-shadow:0 12px 36px rgba(0,0,0,.28);
      user-select:none;
    }
    #eyeMiniMapV66.visible{display:block}
    .eye-minimap-heading-v66{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:8px;
      margin:0 2px 7px;
      color:#f2efe9;
      font-size:10px;
      line-height:1.2;
    }
    .eye-minimap-heading-v66 strong{
      font-size:11px;
      letter-spacing:.02em;
    }
    .eye-minimap-heading-v66 span{color:#b9b8af}
    #eyeMiniMapCanvasV66{
      display:block;
      width:100%;
      height:168px;
      border:1px solid rgba(65,66,59,.9);
      border-radius:8px;
      background:#ecebe6;
      cursor:crosshair;
      touch-action:none;
    }
    #eyeMiniMapCanvasV66:active{cursor:grabbing}
    @media(max-width:700px){
      #eyeMiniMapV66{top:8px;right:8px;width:200px;padding:6px}
      #eyeMiniMapCanvasV66{height:138px}
      .eye-minimap-heading-v66 span{display:none}
    }
  `;
  document.head.appendChild(style);
}

queueMicrotask(() => {
  createEyeMiniMapV66();

  const help = $('help');
  if (help && !help.textContent.includes('drag doors')) {
    help.textContent += ' · drag doors/windows along their wall';
  }

  const viewEyeButton = $('viewEye');
  if (viewEyeButton) {
    new MutationObserver(syncEyeMiniMapVisibilityV66).observe(viewEyeButton, {
      attributes: true,
      attributeFilter: ['class']
    });
  }

  const buildSceneBeforeV66 = buildScene;
  buildScene = function() {
    const result = buildSceneBeforeV66();
    if (selectionAssistActiveV65) renderSelectionAssistV65(true);
    drawEyeMiniMapV66(true);
    return result;
  };

  orbit.addEventListener('change', () => drawEyeMiniMapV66());
  window.addEventListener('resize', () => drawEyeMiniMapV66(true));

  // Re-check periodically because project loads and view presets can rebuild the scene
  // without changing the Eye-level button class in the same frame.
  setInterval(() => {
    if (document.hidden) return;
    syncEyeMiniMapVisibilityV66();
    if (selectionAssistActiveV65) renderSelectionAssistV65();
    drawEyeMiniMapV66();
  }, 180);

  syncEyeMiniMapVisibilityV66();
});
