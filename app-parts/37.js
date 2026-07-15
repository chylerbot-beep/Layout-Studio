// Neutral photo-reference surfaces: muted brown doors and a plain light-grey floor.
// Loads after app-parts/36.js and before app-parts/08.js.

const layoutPhotoReferenceVersionV71 = '20260715-brown-door-neutral-floor-v71';
const photoReferenceMaterialStateV71 = new WeakMap();

const PHOTO_DOOR_BROWN_V71 = 0x876247;
const PHOTO_FLOOR_GREY_V71 = 0xe1dfda;

function rememberPhotoReferenceMaterialV71(material) {
  if (!material || photoReferenceMaterialStateV71.has(material)) return;
  photoReferenceMaterialStateV71.set(material, {
    color: material.color?.getHex?.(),
    opacity: material.opacity,
    transparent: material.transparent,
    depthWrite: material.depthWrite,
    roughness: material.roughness,
    metalness: material.metalness
  });
}

function restorePhotoReferenceMaterialV71(material) {
  const state = material && photoReferenceMaterialStateV71.get(material);
  if (!state) return;

  if (material.color && Number.isFinite(state.color)) material.color.setHex(state.color);
  material.opacity = state.opacity;
  material.transparent = state.transparent;
  material.depthWrite = state.depthWrite;
  if ('roughness' in material && state.roughness !== undefined) material.roughness = state.roughness;
  if ('metalness' in material && state.metalness !== undefined) material.metalness = state.metalness;
  material.needsUpdate = true;
}

function photoFloorMeshV71() {
  if (!shellGroup) return null;
  return shellGroup.children.find(mesh => (
    mesh?.geometry?.type === 'PlaneGeometry' &&
    !mesh.userData?.wall &&
    !mesh.userData?.fixed &&
    Math.abs(Number(mesh.position?.y) || 0) < 0.06
  )) || null;
}

function applyNeutralPhotoFloorV71() {
  if (!photoModeActiveV31) return;
  const floor = photoFloorMeshV71();
  if (!floor) return;

  const materials = Array.isArray(floor.material) ? floor.material : [floor.material];
  materials.filter(Boolean).forEach(material => {
    rememberPhotoReferenceMaterialV71(material);
    if (material.color) material.color.setHex(PHOTO_FLOOR_GREY_V71);
    material.transparent = false;
    material.opacity = 1;
    material.depthWrite = true;
    if ('roughness' in material) material.roughness = 1;
    if ('metalness' in material) material.metalness = 0;
    material.needsUpdate = true;
  });
}

function applyBrownPhotoDoorsV71() {
  if (!photoModeActiveV31 || !openingGroup) return;

  openingGroup.children.forEach(mesh => {
    if (!mesh.userData?.doorDragProxyV67) return;
    const opening = (project.openings || []).find(item => item.id === mesh.userData?.id);
    if (opening?.type !== 'door') return;

    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.filter(Boolean).forEach(material => {
      rememberPhotoReferenceMaterialV71(material);
      if (material.color) material.color.setHex(PHOTO_DOOR_BROWN_V71);
      material.transparent = false;
      material.opacity = 1;
      material.depthWrite = true;
      if ('roughness' in material) material.roughness = .92;
      if ('metalness' in material) material.metalness = 0;
      material.needsUpdate = true;
    });
  });
}

function applyPhotoReferenceSurfacesV71() {
  if (!photoModeActiveV31) return;
  applyNeutralPhotoFloorV71();
  applyBrownPhotoDoorsV71();
}

function restorePhotoReferenceSurfacesV71() {
  const floor = photoFloorMeshV71();
  if (floor) {
    const materials = Array.isArray(floor.material) ? floor.material : [floor.material];
    materials.filter(Boolean).forEach(restorePhotoReferenceMaterialV71);
  }

  if (openingGroup) {
    openingGroup.children.forEach(mesh => {
      if (!mesh.userData?.doorDragProxyV67) return;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.filter(Boolean).forEach(restorePhotoReferenceMaterialV71);
    });
  }
}

queueMicrotask(() => {
  // v70 owns door opacity. Reapply the neutral reference colours after it runs.
  if (typeof applyOpaquePhotoDoorsV70 === 'function') {
    const applyOpaquePhotoDoorsBeforeV71 = applyOpaquePhotoDoorsV70;
    applyOpaquePhotoDoorsV70 = function() {
      const result = applyOpaquePhotoDoorsBeforeV71();
      applyPhotoReferenceSurfacesV71();
      return result;
    };
  }

  if (typeof applyPhotoVisibilityV31 === 'function') {
    const applyPhotoVisibilityBeforeV71 = applyPhotoVisibilityV31;
    applyPhotoVisibilityV31 = function() {
      const result = applyPhotoVisibilityBeforeV71();
      applyPhotoReferenceSurfacesV71();
      return result;
    };
  }

  const enterPhotoModeBeforeV71 = enterPhotoModeV31;
  enterPhotoModeV31 = function() {
    const result = enterPhotoModeBeforeV71();
    applyPhotoReferenceSurfacesV71();
    return result;
  };

  const exitPhotoModeBeforeV71 = exitPhotoModeV31;
  exitPhotoModeV31 = function() {
    restorePhotoReferenceSurfacesV71();
    return exitPhotoModeBeforeV71();
  };

  const buildSceneBeforeV71 = buildScene;
  buildScene = function() {
    const result = buildSceneBeforeV71();
    applyPhotoReferenceSurfacesV71();
    return result;
  };

  if (typeof buildDoorDragProxiesV67 === 'function') {
    const buildDoorDragProxiesBeforeV71 = buildDoorDragProxiesV67;
    buildDoorDragProxiesV67 = function() {
      const result = buildDoorDragProxiesBeforeV71();
      applyPhotoReferenceSurfacesV71();
      return result;
    };
  }

  if (photoModeActiveV31) applyPhotoReferenceSurfacesV71();
});
