// Opaque photo-mode doors, non-selectable camera-hidden items and a stable eye-level minimap.
// Loads after app-parts/35.js and before app-parts/08.js.

const layoutPhotoSelectionMapVersionV70 = '20260715-photo-door-hidden-selection-minimap-v70';
const photoDoorMeshStateV70 = new WeakMap();
const photoDoorMaterialStateV70 = new WeakMap();
let eyeMiniMapReadyV70 = false;

function eyeLevelInteractionActiveV70() {
  return !!$('viewEye')?.classList.contains('active');
}

function doorOpeningForMeshV70(mesh) {
  const id = mesh?.userData?.id;
  if (!id) return null;
  const opening = (project.openings || []).find(item => item.id === id);
  return opening?.type === 'door' ? opening : null;
}

function rememberPhotoDoorStateV70(mesh) {
  if (!photoDoorMeshStateV70.has(mesh)) {
    photoDoorMeshStateV70.set(mesh, { visible: mesh.visible });
  }
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  materials.filter(Boolean).forEach(material => {
    if (photoDoorMaterialStateV70.has(material)) return;
    photoDoorMaterialStateV70.set(material, {
      opacity: material.opacity,
      transparent: material.transparent,
      depthWrite: material.depthWrite
    });
  });
}

function applyOpaquePhotoDoorsV70() {
  if (!openingGroup || !photoModeActiveV31) return;
  openingGroup.children.forEach(mesh => {
    const door = doorOpeningForMeshV70(mesh);
    if (!door) return;
    rememberPhotoDoorStateV70(mesh);

    // The original door object is a flat editing/swing indicator. Hide it in Photo
    // mode and use the vertical door proxy as the clean, opaque door panel.
    if (!mesh.userData?.doorDragProxyV67) {
      mesh.visible = false;
      return;
    }

    // Respect camera cutaway: an opening on a hidden wall remains hidden.
    const hostWallHidden = typeof cameraCutawayWallIds !== 'undefined' &&
      cameraCutawayWallIds.has(door.wallId);
    if (hostWallHidden) {
      mesh.visible = false;
      return;
    }

    mesh.visible = true;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.filter(Boolean).forEach(material => {
      material.transparent = false;
      material.opacity = 1;
      material.depthWrite = true;
      material.needsUpdate = true;
    });
  });
}

function restorePhotoDoorsV70() {
  if (!openingGroup) return;
  openingGroup.children.forEach(mesh => {
    const door = doorOpeningForMeshV70(mesh);
    if (!door) return;
    const meshState = photoDoorMeshStateV70.get(mesh);
    if (meshState) mesh.visible = meshState.visible;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.filter(Boolean).forEach(material => {
      const state = photoDoorMaterialStateV70.get(material);
      if (!state) return;
      material.opacity = state.opacity;
      material.transparent = state.transparent;
      material.depthWrite = state.depthWrite;
      material.needsUpdate = true;
    });
  });
}

function currentCameraHiddenWallIdsV70() {
  const ids = new Set();
  if (typeof cameraCutawayWallIds !== 'undefined') {
    cameraCutawayWallIds.forEach(id => ids.add(id));
  }
  try {
    const settings = ensureCameraCutawaySettings();
    (settings.hiddenWallIds || []).forEach(id => ids.add(id));
    automaticBlockingWallIds(settings).forEach(id => ids.add(id));
  } catch {}
  return ids;
}

function currentCameraHiddenFurnitureIdsV70() {
  try {
    return typeof hiddenFurnitureIdsV42 === 'function' ? hiddenFurnitureIdsV42() : new Set();
  } catch {
    return new Set();
  }
}

function furnitureSelectionBlockedV70(mesh) {
  if (!eyeLevelInteractionActiveV70() || !mesh) return false;
  const id = mesh.userData?.id;
  if (!id) return mesh.visible === false;
  return mesh.visible === false || currentCameraHiddenFurnitureIdsV70().has(id);
}

function architectureSelectionBlockedV70(kind, id) {
  if (!eyeLevelInteractionActiveV70() || !id) return false;
  let wallId = id;
  if (kind !== 'wall') {
    const opening = (project.openings || []).find(item => item.id === id);
    wallId = opening?.wallId;
  }
  return !!wallId && currentCameraHiddenWallIdsV70().has(wallId);
}

function clearCameraHiddenSelectionV70() {
  if (!eyeLevelInteractionActiveV70()) return;

  if (selected && furnitureSelectionBlockedV70(selected)) {
    transform.detach();
    select(null);
  }

  if (selectedArchitecture && architectureSelectionBlockedV70(
    selectedArchitecture.kind,
    selectedArchitecture.id
  )) {
    selectedArchitecture = null;
    if (typeof renderArchitectureHighlight === 'function') renderArchitectureHighlight();
    if (typeof updateArchitecturePanel === 'function') updateArchitecturePanel();
    if (typeof renderArchitectureList === 'function') renderArchitectureList();
    if ($('selectionStatus')) $('selectionStatus').textContent = 'Nothing selected';
  }
}

function positionEyeMiniMapStableV70() {
  if (!eyeMiniMapV66) return;
  const viewport = $('viewport');
  if (!viewport) return;

  const photoInset = photoModeActiveV31 && viewport.clientWidth > 720 ? 326 : 12;
  eyeMiniMapV66.style.setProperty('position', 'absolute', 'important');
  eyeMiniMapV66.style.setProperty('top', '12px', 'important');
  eyeMiniMapV66.style.setProperty('right', `${photoInset}px`, 'important');
  eyeMiniMapV66.style.setProperty('left', 'auto', 'important');
  eyeMiniMapV66.style.setProperty('width', '230px', 'important');
  eyeMiniMapV66.style.setProperty('max-width', `calc(100% - ${photoInset + 12}px)`, 'important');
  eyeMiniMapV66.style.setProperty('z-index', '1400', 'important');
  eyeMiniMapV66.style.setProperty('transition', 'none', 'important');
  eyeMiniMapV66.style.setProperty('animation', 'none', 'important');
  eyeMiniMapV66.style.setProperty('transform', 'none', 'important');
  eyeMiniMapV66.style.pointerEvents = 'auto';
}

function ensureEyeMiniMapStableV70() {
  try {
    if (!eyeMiniMapV66 && typeof createEyeMiniMapV66 === 'function') createEyeMiniMapV66();
    if (!eyeMiniMapV66) return;

    const visible = eyeLevelInteractionActiveV70();
    eyeMiniMapV66.classList.toggle('visible', visible);
    eyeMiniMapV66.setAttribute('aria-hidden', visible ? 'false' : 'true');

    if (!visible) {
      eyeMiniMapReadyV70 = false;
      eyeMiniMapV66.style.setProperty('display', 'none', 'important');
      eyeMiniMapV66.style.setProperty('visibility', 'hidden', 'important');
      return;
    }

    positionEyeMiniMapStableV70();
    eyeMiniMapV66.style.setProperty('display', 'block', 'important');

    if (!eyeMiniMapReadyV70) {
      // Draw at its final fixed size before revealing it. This removes the visible
      // 190 px → 230 px growth caused by repeated viewport measurements settling.
      eyeMiniMapV66.style.setProperty('visibility', 'hidden', 'important');
      requestAnimationFrame(() => {
        positionEyeMiniMapStableV70();
        if (typeof drawEyeMiniMapV66 === 'function') drawEyeMiniMapV66(true);
        eyeMiniMapReadyV70 = true;
        eyeMiniMapV66.style.setProperty('visibility', 'visible', 'important');
      });
      return;
    }

    eyeMiniMapV66.style.setProperty('visibility', 'visible', 'important');
  } catch (error) {
    console.warn('Could not stabilise the eye-level navigation map.', error);
  }
}

if (!document.getElementById('layoutPhotoSelectionMapStylesV70')) {
  const style = document.createElement('style');
  style.id = 'layoutPhotoSelectionMapStylesV70';
  style.textContent = `
    #eyeMiniMapV66{
      width:230px!important;
      transition:none!important;
      animation:none!important;
      transform:none!important;
      contain:layout paint;
    }
    #eyeMiniMapCanvasV66{
      width:100%!important;
      transition:none!important;
      animation:none!important;
    }
  `;
  document.head.appendChild(style);
}

queueMicrotask(() => {
  // Block selection and dragging of items removed from the current Eye-level camera view.
  const selectBeforeV70 = select;
  select = function(mesh) {
    if (mesh && furnitureSelectionBlockedV70(mesh)) return;
    return selectBeforeV70(mesh);
  };

  const selectArchitectureBeforeV70 = selectArchitecture;
  selectArchitecture = function(kind, id) {
    if (id && architectureSelectionBlockedV70(kind, id)) return;
    return selectArchitectureBeforeV70(kind, id);
  };

  const beginWallDragBeforeV70 = beginWallDrag;
  beginWallDrag = function(control, event) {
    const wallId = selectedArchitecture?.kind === 'wall' ? selectedArchitecture.id : null;
    if (wallId && architectureSelectionBlockedV70('wall', wallId)) return false;
    return beginWallDragBeforeV70(control, event);
  };

  const beginOpeningDragBeforeV70 = beginOpeningDragV45;
  beginOpeningDragV45 = function(opening, event) {
    if (opening && architectureSelectionBlockedV70('opening', opening.id)) return false;
    return beginOpeningDragBeforeV70(opening, event);
  };

  if (typeof applyCameraCutaway === 'function') {
    const applyCameraCutawayBeforeV70 = applyCameraCutaway;
    applyCameraCutaway = function() {
      const result = applyCameraCutawayBeforeV70();
      clearCameraHiddenSelectionV70();
      if (photoModeActiveV31) applyOpaquePhotoDoorsV70();
      return result;
    };
  }

  if (typeof applyCameraFurnitureVisibilityV42 === 'function') {
    const applyCameraFurnitureVisibilityBeforeV70 = applyCameraFurnitureVisibilityV42;
    applyCameraFurnitureVisibilityV42 = function() {
      const result = applyCameraFurnitureVisibilityBeforeV70();
      clearCameraHiddenSelectionV70();
      return result;
    };
  }

  if (typeof applyPhotoVisibilityV31 === 'function') {
    const applyPhotoVisibilityBeforeV70 = applyPhotoVisibilityV31;
    applyPhotoVisibilityV31 = function() {
      const result = applyPhotoVisibilityBeforeV70();
      if (photoModeActiveV31) applyOpaquePhotoDoorsV70();
      return result;
    };
  }

  const enterPhotoModeBeforeV70 = enterPhotoModeV31;
  enterPhotoModeV31 = function() {
    const result = enterPhotoModeBeforeV70();
    applyOpaquePhotoDoorsV70();
    ensureEyeMiniMapStableV70();
    return result;
  };

  const exitPhotoModeBeforeV70 = exitPhotoModeV31;
  exitPhotoModeV31 = function() {
    restorePhotoDoorsV70();
    const result = exitPhotoModeBeforeV70();
    if (typeof applyCameraCutaway === 'function') applyCameraCutaway();
    ensureEyeMiniMapStableV70();
    return result;
  };

  if (typeof buildDoorDragProxiesV67 === 'function') {
    const buildDoorDragProxiesBeforeV70 = buildDoorDragProxiesV67;
    buildDoorDragProxiesV67 = function() {
      const result = buildDoorDragProxiesBeforeV70();
      if (photoModeActiveV31) applyOpaquePhotoDoorsV70();
      return result;
    };
  }

  const buildSceneBeforeV70 = buildScene;
  buildScene = function() {
    const result = buildSceneBeforeV70();
    if (photoModeActiveV31) applyOpaquePhotoDoorsV70();
    clearCameraHiddenSelectionV70();
    ensureEyeMiniMapStableV70();
    return result;
  };

  // Replace the repeatedly measured fixed-position minimap functions. The existing
  // v66/v67 timers call these names dynamically, so they now use the stable sizing.
  positionEyeMiniMapV67 = positionEyeMiniMapStableV70;
  ensureEyeMiniMapVisibleV67 = ensureEyeMiniMapStableV70;
  syncEyeMiniMapVisibilityV66 = ensureEyeMiniMapStableV70;

  ['viewEye', 'viewTop', 'viewBird'].forEach(id => {
    $(id)?.addEventListener('click', () => {
      eyeMiniMapReadyV70 = false;
      requestAnimationFrame(ensureEyeMiniMapStableV70);
    });
  });

  window.addEventListener('resize', () => {
    positionEyeMiniMapStableV70();
    if (eyeLevelInteractionActiveV70() && typeof drawEyeMiniMapV66 === 'function') {
      drawEyeMiniMapV66(true);
    }
  });

  orbit.addEventListener('change', () => {
    clearCameraHiddenSelectionV70();
    if (photoModeActiveV31) applyOpaquePhotoDoorsV70();
  });

  if (photoModeActiveV31) applyOpaquePhotoDoorsV70();
  clearCameraHiddenSelectionV70();
  ensureEyeMiniMapStableV70();
});
