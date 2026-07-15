// Architecture-only Shift labels, linked hover highlighting, visible door drag targets,
// and a resilient eye-level navigation map.
// Loads after app-parts/33.js and before app-parts/08.js.

const layoutInteractionFixVersionV67 = '20260715-review-selection-minimap-fix-v67';

// -----------------------------------------------------------------------------
// Step 3 selection labels: walls, doors and windows only.
// -----------------------------------------------------------------------------

function architectureReviewActiveV67() {
  return document.body.classList.contains('architecture-review-mode');
}

function architectureEntryVisibleV67(box, point) {
  camera.updateMatrixWorld();
  selectionAssistProjectionV65.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  selectionAssistFrustumV65.setFromProjectionMatrix(selectionAssistProjectionV65);
  if (!selectionAssistFrustumV65.intersectsBox(box)) return false;
  const projected = point.clone().project(camera);
  return projected.z >= -1 && projected.z <= 1 && Math.abs(projected.x) <= 1.08 && Math.abs(projected.y) <= 1.08;
}

function uniqueArchitectureEntryNamesV67(entries) {
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

function architectureReviewEntriesV67() {
  const entries = [];

  (project.walls || []).forEach(wall => {
    if (!wall?.id) return;
    const metrics = wallMetrics(wall);
    const thickness = Math.max(50, metrics.thickness || 120);
    const height = Math.max(300, +wall.h || 2600);
    const pad = thickness / 2;
    const box = new THREE.Box3(
      new THREE.Vector3(
        mm(Math.min(metrics.x1, metrics.x2) - pad),
        0,
        mm(Math.min(metrics.y1, metrics.y2) - pad)
      ),
      new THREE.Vector3(
        mm(Math.max(metrics.x1, metrics.x2) + pad),
        mm(height),
        mm(Math.max(metrics.y1, metrics.y2) + pad)
      )
    );
    const point = new THREE.Vector3(mm(metrics.cx), mm(Math.min(height * .62, 1800)), mm(metrics.cy));
    if (!architectureEntryVisibleV67(box, point)) return;
    entries.push({
      kind: 'wall',
      id: wall.id,
      name: wall.name || 'Wall',
      category: 'wall',
      point
    });
  });

  (project.openings || []).forEach(opening => {
    if (!opening?.id || !['door', 'window'].includes(opening.type)) return;
    const wall = (project.walls || []).find(candidate => candidate.id === opening.wallId);
    if (!wall) return;
    const metrics = wallMetrics(wall);
    const centreX = metrics.x1 + metrics.ux * (+opening.offset || 0);
    const centreY = metrics.y1 + metrics.uy * (+opening.offset || 0);
    const width = Math.max(300, +opening.width || 750);
    const height = Math.max(300, +opening.height || (opening.type === 'door' ? 2100 : 1200));
    const sill = Math.max(0, +opening.sill || 0);
    const halfPlan = width / 2 + Math.max(60, metrics.thickness / 2);
    const point = new THREE.Vector3(mm(centreX), mm(sill + height * .55), mm(centreY));
    const box = new THREE.Box3(
      new THREE.Vector3(mm(centreX - halfPlan), mm(sill), mm(centreY - halfPlan)),
      new THREE.Vector3(mm(centreX + halfPlan), mm(sill + height), mm(centreY + halfPlan))
    );
    if (!architectureEntryVisibleV67(box, point)) return;
    entries.push({
      kind: 'opening',
      id: opening.id,
      name: opening.name || (opening.type === 'door' ? 'Door' : 'Window'),
      category: opening.type,
      point
    });
  });

  return uniqueArchitectureEntryNamesV67(entries);
}

const collectSelectionAssistEntriesBeforeV67 = collectSelectionAssistEntriesV65;
collectSelectionAssistEntriesV65 = function() {
  if (architectureReviewActiveV67()) return architectureReviewEntriesV67();
  return collectSelectionAssistEntriesBeforeV67();
};

let reviewLabelVisibilityBackupV67 = null;

function hideNormalLabelsForReviewAssistV67() {
  if (!architectureReviewActiveV67() || !selectionAssistActiveV65) return;
  if (!reviewLabelVisibilityBackupV67) {
    reviewLabelVisibilityBackupV67 = {
      furniture: labelGroup.visible,
      architecture: architectureLabelGroup.visible
    };
  }
  labelGroup.visible = false;
  architectureLabelGroup.visible = false;
}

function restoreNormalLabelsAfterReviewAssistV67() {
  if (!reviewLabelVisibilityBackupV67) return;
  labelGroup.visible = reviewLabelVisibilityBackupV67.furniture;
  architectureLabelGroup.visible = reviewLabelVisibilityBackupV67.architecture;
  reviewLabelVisibilityBackupV67 = null;
  if (typeof updateLabelOcclusion === 'function') updateLabelOcclusion();
}

const showSelectionAssistBeforeV67 = showSelectionAssistV65;
showSelectionAssistV65 = function() {
  const result = showSelectionAssistBeforeV67();
  hideNormalLabelsForReviewAssistV67();
  return result;
};

const hideSelectionAssistBeforeV67 = hideSelectionAssistV65;
hideSelectionAssistV65 = function() {
  const result = hideSelectionAssistBeforeV67();
  restoreNormalLabelsAfterReviewAssistV67();
  clearArchitectureHoverHighlightV67();
  return result;
};

// -----------------------------------------------------------------------------
// Hovering an architecture label highlights its exact wall, door or window.
// -----------------------------------------------------------------------------

const architectureHoverHighlightGroupV67 = new THREE.Group();
architectureHoverHighlightGroupV67.name = 'architecture-label-hover-highlight-v67';
scene.add(architectureHoverHighlightGroupV67);

function clearArchitectureHoverHighlightV67() {
  clearGroup(architectureHoverHighlightGroupV67);
}

function highlightArchitectureEntryV67(entry) {
  clearArchitectureHoverHighlightV67();
  if (!entry) return;

  const material = new THREE.MeshBasicMaterial({
    color: 0x63c174,
    transparent: true,
    opacity: .42,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide
  });

  if (entry.kind === 'wall') {
    const wall = (project.walls || []).find(candidate => candidate.id === entry.id);
    if (!wall) return;
    const mesh = makeWallPrism(wall, material, .018, Math.max(300, +wall.h || 2600));
    mesh.renderOrder = 1600;
    architectureHoverHighlightGroupV67.add(mesh);
    return;
  }

  if (entry.kind === 'opening') {
    const opening = (project.openings || []).find(candidate => candidate.id === entry.id);
    const wall = opening && (project.walls || []).find(candidate => candidate.id === opening.wallId);
    if (!opening || !wall) return;
    const metrics = wallMetrics(wall);
    const centreX = metrics.x1 + metrics.ux * (+opening.offset || 0);
    const centreY = metrics.y1 + metrics.uy * (+opening.offset || 0);
    const width = Math.max(300, +opening.width || 750);
    const height = Math.max(300, +opening.height || (opening.type === 'door' ? 2100 : 1200));
    const sill = Math.max(0, +opening.sill || 0);
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(mm(width), mm(height), mm(Math.max(90, metrics.thickness + 55))),
      material
    );
    mesh.position.set(mm(centreX), mm(sill + height / 2), mm(centreY));
    mesh.rotation.y = -metrics.angle;
    mesh.renderOrder = 1600;
    architectureHoverHighlightGroupV67.add(mesh);
  }
}

function bindSelectionAssistHoverV67() {
  if (!selectionAssistOverlayV65 || !selectionAssistActiveV65) return;
  const entries = collectSelectionAssistEntriesV65();
  const byName = new Map(entries.map(entry => [entry.displayName || entry.name, entry]));

  selectionAssistOverlayV65.querySelectorAll('.selection-assist-label-v65').forEach(button => {
    const entry = byName.get(button.textContent);
    if (!entry) return;
    button.dataset.selectionKindV67 = entry.kind;
    button.dataset.selectionIdV67 = entry.id;
    button.onpointerenter = () => highlightArchitectureEntryV67(entry);
    button.onpointerleave = clearArchitectureHoverHighlightV67;
    button.onfocus = () => highlightArchitectureEntryV67(entry);
    button.onblur = clearArchitectureHoverHighlightV67;
  });
}

const renderSelectionAssistBeforeV67 = renderSelectionAssistV65;
renderSelectionAssistV65 = function(force = false) {
  const result = renderSelectionAssistBeforeV67(force);
  hideNormalLabelsForReviewAssistV67();
  bindSelectionAssistHoverV67();
  return result;
};

// -----------------------------------------------------------------------------
// Give every door a visible, raycastable vertical target for click-dragging.
// -----------------------------------------------------------------------------

function removeDoorDragProxiesV67() {
  [...openingGroup.children].forEach(child => {
    if (!child.userData?.doorDragProxyV67) return;
    openingGroup.remove(child);
    child.geometry?.dispose?.();
    child.material?.dispose?.();
  });
}

function buildDoorDragProxiesV67() {
  if (!openingGroup) return;
  removeDoorDragProxiesV67();
  const review = architectureReviewActiveV67();

  (project.openings || []).filter(opening => opening.type === 'door').forEach(door => {
    const wall = (project.walls || []).find(candidate => candidate.id === door.wallId);
    if (!wall) return;
    const metrics = wallMetrics(wall);
    const centreX = metrics.x1 + metrics.ux * (+door.offset || 0);
    const centreY = metrics.y1 + metrics.uy * (+door.offset || 0);
    const width = Math.max(500, +door.width || 850);
    const height = Math.max(1700, +door.height || 2100);
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(mm(width), mm(height), mm(Math.max(80, metrics.thickness + 35))),
      new THREE.MeshBasicMaterial({
        color: 0xd8ad63,
        transparent: true,
        opacity: review ? .24 : .035,
        depthWrite: false,
        side: THREE.DoubleSide
      })
    );
    mesh.position.set(mm(centreX), mm(height / 2), mm(centreY));
    mesh.rotation.y = -metrics.angle;
    mesh.renderOrder = review ? 90 : 30;
    mesh.userData = {
      ...door,
      id: door.id,
      opening: true,
      doorDragProxyV67: true
    };
    openingGroup.add(mesh);
  });

  if (review) openingGroup.visible = true;
}

function updateDoorProxyReviewAppearanceV67() {
  const review = architectureReviewActiveV67();
  openingGroup.children.forEach(child => {
    if (!child.userData?.doorDragProxyV67 || !child.material) return;
    child.material.opacity = review ? .24 : .035;
    child.renderOrder = review ? 90 : 30;
  });
  if (review) openingGroup.visible = true;
}

// -----------------------------------------------------------------------------
// Make the v66 eye-level minimap visible above all panels and keep it positioned
// inside the current viewport even after panel or window resizing.
// -----------------------------------------------------------------------------

function positionEyeMiniMapV67() {
  if (!eyeMiniMapV66) return;
  const viewport = $('viewport');
  if (!viewport) return;
  const rect = viewport.getBoundingClientRect();
  const width = Math.max(190, Math.min(246, rect.width - 24));
  eyeMiniMapV66.style.position = 'fixed';
  eyeMiniMapV66.style.width = `${width}px`;
  eyeMiniMapV66.style.left = `${Math.max(rect.left + 12, rect.right - width - 12)}px`;
  eyeMiniMapV66.style.right = 'auto';
  eyeMiniMapV66.style.top = `${Math.max(rect.top + 12, 12)}px`;
  eyeMiniMapV66.style.zIndex = '1000';
  eyeMiniMapV66.style.pointerEvents = 'auto';
}

function ensureEyeMiniMapVisibleV67() {
  try {
    if (!eyeMiniMapV66 && typeof createEyeMiniMapV66 === 'function') createEyeMiniMapV66();
    if (!eyeMiniMapV66) return;
    const visible = !!$('viewEye')?.classList.contains('active');
    eyeMiniMapV66.classList.toggle('visible', visible);
    eyeMiniMapV66.style.setProperty('display', visible ? 'block' : 'none', 'important');
    eyeMiniMapV66.style.visibility = visible ? 'visible' : 'hidden';
    eyeMiniMapV66.setAttribute('aria-hidden', visible ? 'false' : 'true');
    if (!visible) return;
    positionEyeMiniMapV67();
    requestAnimationFrame(() => {
      positionEyeMiniMapV67();
      if (typeof drawEyeMiniMapV66 === 'function') drawEyeMiniMapV66(true);
    });
  } catch (error) {
    console.warn('Could not show the eye-level navigation map.', error);
  }
}

if (!document.getElementById('layoutInteractionFixStylesV67')) {
  const style = document.createElement('style');
  style.id = 'layoutInteractionFixStylesV67';
  style.textContent = `
    body.architecture-review-mode #selectionAssistOverlayV65.active{
      display:block!important;
      z-index:1300!important;
    }
    body.architecture-review-mode #selectionAssistOverlayV65 .selection-assist-label-v65{
      background:rgba(30,39,29,.97);
      border-color:rgba(99,193,116,.88);
    }
    #selectionAssistOverlayV65 .selection-assist-label-v65:hover,
    #selectionAssistOverlayV65 .selection-assist-label-v65:focus-visible{
      background:#63c174!important;
      border-color:#e5ffe9!important;
      color:#102114!important;
      box-shadow:0 0 0 4px rgba(99,193,116,.32),0 9px 26px rgba(0,0,0,.44)!important;
    }
    #eyeMiniMapV66{
      min-width:190px;
      visibility:hidden;
    }
    #eyeMiniMapV66.visible{
      visibility:visible!important;
      display:block!important;
    }
  `;
  document.head.appendChild(style);
}

queueMicrotask(() => {
  try {
    const buildSceneBeforeV67 = buildScene;
    buildScene = function() {
      const result = buildSceneBeforeV67();
      buildDoorDragProxiesV67();
      if (selectionAssistActiveV65) renderSelectionAssistV65(true);
      ensureEyeMiniMapVisibleV67();
      return result;
    };

    if (typeof refreshArchitectureVisuals === 'function') {
      const refreshArchitectureVisualsBeforeV67 = refreshArchitectureVisuals;
      refreshArchitectureVisuals = function(...args) {
        const result = refreshArchitectureVisualsBeforeV67(...args);
        buildDoorDragProxiesV67();
        if (selectionAssistActiveV65) renderSelectionAssistV65(true);
        return result;
      };
    }

    buildDoorDragProxiesV67();
  } catch (error) {
    console.warn('Could not install door drag targets.', error);
  }

  try {
    const bodyObserverV67 = new MutationObserver(() => {
      updateDoorProxyReviewAppearanceV67();
      if (selectionAssistActiveV65) {
        hideNormalLabelsForReviewAssistV67();
        renderSelectionAssistV65(true);
      } else {
        restoreNormalLabelsAfterReviewAssistV67();
      }
      ensureEyeMiniMapVisibleV67();
    });
    bodyObserverV67.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  } catch (error) {
    console.warn('Could not observe architecture review mode.', error);
  }

  try {
    ['viewEye', 'viewTop', 'viewBird'].forEach(id => {
      $(id)?.addEventListener('click', () => setTimeout(ensureEyeMiniMapVisibleV67, 0));
    });
    new MutationObserver(ensureEyeMiniMapVisibleV67).observe($('viewEye'), {
      attributes: true,
      attributeFilter: ['class']
    });
    window.addEventListener('resize', ensureEyeMiniMapVisibleV67);
    if (typeof orbit !== 'undefined') orbit.addEventListener('change', () => {
      if ($('viewEye')?.classList.contains('active')) {
        positionEyeMiniMapV67();
        drawEyeMiniMapV66(true);
      }
    });
    ensureEyeMiniMapVisibleV67();
  } catch (error) {
    console.warn('Could not install eye-level minimap visibility fixes.', error);
  }

  setInterval(() => {
    if (document.hidden) return;
    updateDoorProxyReviewAppearanceV67();
    if (selectionAssistActiveV65) {
      hideNormalLabelsForReviewAssistV67();
      bindSelectionAssistHoverV67();
    }
    ensureEyeMiniMapVisibleV67();
  }, 180);
});
