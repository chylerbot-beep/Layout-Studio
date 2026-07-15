// Dedicated Photo-mode reference floor and door meshes.
// These render immediately before every frame so later visibility/cutaway refreshes
// cannot overwrite the intended neutral floor or brown door colours.
// Loads after app-parts/37.js and before app-parts/08.js.

const layoutDedicatedPhotoSurfaceVersionV72 = '20260715-dedicated-photo-surfaces-v72';
const photoReferenceGroupV72 = new THREE.Group();
photoReferenceGroupV72.name = 'photo-reference-surfaces-v72';
photoReferenceGroupV72.renderOrder = 1800;
photoReferenceGroupV72.visible = false;
scene.add(photoReferenceGroupV72);

const PHOTO_DOOR_BROWN_V72 = 0x79563f;
const PHOTO_FLOOR_NEUTRAL_V72 = 0xd4d3cf;

let photoReferenceSignatureV72 = '';

function photoReferenceDoorOpeningForMeshV72(mesh) {
  const id = mesh?.userData?.id;
  if (!id) return null;
  const opening = (project.openings || []).find(item => item.id === id);
  return opening?.type === 'door' ? opening : null;
}

function photoReferenceFloorSourceV72() {
  if (!shellGroup) return null;
  return shellGroup.children.find(mesh => (
    mesh?.geometry?.type === 'PlaneGeometry' &&
    !mesh.userData?.wall &&
    !mesh.userData?.fixed &&
    Math.abs(Number(mesh.position?.y) || 0) < 0.08
  )) || null;
}

function photoReferenceSignatureForProjectV72() {
  const floor = photoReferenceFloorSourceV72();
  const floorKey = floor
    ? [
        floor.geometry?.uuid,
        floor.position.x,
        floor.position.y,
        floor.position.z,
        floor.rotation.x,
        floor.rotation.y,
        floor.rotation.z
      ].join(':')
    : [
        project.plan?.width || PLAN_W,
        project.plan?.depth || PLAN_H
      ].join(':');

  const doors = (project.openings || [])
    .filter(opening => opening.type === 'door')
    .map(opening => {
      const wall = (project.walls || []).find(item => item.id === opening.wallId);
      if (!wall) return `${opening.id}:missing`;
      const e = wallMetrics(wall);
      return [
        opening.id,
        opening.wallId,
        opening.offset,
        opening.width,
        opening.height,
        e.x1,
        e.y1,
        e.x2,
        e.y2,
        e.thickness
      ].join(':');
    })
    .join('|');

  return `${floorKey}::${doors}`;
}

function rebuildPhotoReferenceSurfacesV72() {
  clearGroup(photoReferenceGroupV72);

  const floorSource = photoReferenceFloorSourceV72();
  let floorGeometry;
  let floorPosition;
  let floorRotation;

  if (floorSource) {
    floorGeometry = floorSource.geometry.clone();
    floorPosition = floorSource.position.clone();
    floorRotation = floorSource.rotation.clone();
    floorPosition.y += 0.004;
  } else {
    const width = Number(project.plan?.width || project.basemap?.width || PLAN_W);
    const depth = Number(project.plan?.depth || project.basemap?.depth || PLAN_H);
    const offsetX = Number(project.basemap?.offsetX || 0);
    const offsetY = Number(project.basemap?.offsetY || 0);
    floorGeometry = new THREE.PlaneGeometry(mm(width), mm(depth));
    floorPosition = new THREE.Vector3(
      mm(offsetX + width / 2),
      -0.011,
      mm(offsetY + depth / 2)
    );
    floorRotation = new THREE.Euler(-Math.PI / 2, 0, 0);
  }

  const floor = new THREE.Mesh(
    floorGeometry,
    new THREE.MeshBasicMaterial({
      color: PHOTO_FLOOR_NEUTRAL_V72,
      side: THREE.DoubleSide,
      depthTest: true,
      depthWrite: true,
      toneMapped: false
    })
  );
  floor.name = 'neutral-photo-floor-v72';
  floor.position.copy(floorPosition);
  floor.rotation.copy(floorRotation);
  floor.renderOrder = 1700;
  floor.userData.photoReferenceFloorV72 = true;
  photoReferenceGroupV72.add(floor);

  (project.openings || [])
    .filter(opening => opening.type === 'door')
    .forEach(opening => {
      const wall = (project.walls || []).find(item => item.id === opening.wallId);
      if (!wall) return;

      const e = wallMetrics(wall);
      const width = Math.max(300, Number(opening.width) || 750);
      const height = Math.max(1200, Number(opening.height) || 2100);
      const sill = Math.max(0, Number(opening.sill) || 0);
      const centreX = e.x1 + e.ux * (Number(opening.offset) || 0);
      const centreY = e.y1 + e.uy * (Number(opening.offset) || 0);
      const depth = Math.max(38, Math.min(90, e.thickness * 0.55));

      const door = new THREE.Mesh(
        new THREE.BoxGeometry(mm(width), mm(height), mm(depth)),
        new THREE.MeshBasicMaterial({
          color: PHOTO_DOOR_BROWN_V72,
          transparent: false,
          opacity: 1,
          depthTest: true,
          depthWrite: true,
          toneMapped: false
        })
      );
      door.name = `brown-photo-door-v72-${opening.id}`;
      door.position.set(
        mm(centreX),
        mm(sill + height / 2),
        mm(centreY)
      );
      door.rotation.y = -e.angle;
      door.renderOrder = 1800;
      door.userData = {
        photoReferenceDoorV72: true,
        openingId: opening.id,
        wallId: opening.wallId
      };
      photoReferenceGroupV72.add(door);
    });

  photoReferenceSignatureV72 = photoReferenceSignatureForProjectV72();
}

function hiddenPhotoDoorWallIdsV72() {
  const hidden = new Set();
  if (typeof cameraCutawayWallIds !== 'undefined') {
    cameraCutawayWallIds.forEach(id => hidden.add(id));
  }
  try {
    const settings = ensureCameraCutawaySettings();
    (settings.hiddenWallIds || []).forEach(id => hidden.add(id));
  } catch {}
  return hidden;
}

function syncDedicatedPhotoSurfacesV72() {
  const active = !!photoModeActiveV31;
  photoReferenceGroupV72.visible = active;
  if (!active) return;

  const signature = photoReferenceSignatureForProjectV72();
  if (signature !== photoReferenceSignatureV72 || !photoReferenceGroupV72.children.length) {
    rebuildPhotoReferenceSurfacesV72();
  }

  const hiddenWalls = hiddenPhotoDoorWallIdsV72();

  // Hide every normal door representation. The dedicated brown panel is the only
  // door rendered in Photo mode, preventing later proxy/material resets from flashing white.
  openingGroup.children.forEach(mesh => {
    const opening = photoReferenceDoorOpeningForMeshV72(mesh);
    if (opening) mesh.visible = false;
  });

  photoReferenceGroupV72.children.forEach(mesh => {
    if (!mesh.userData?.photoReferenceDoorV72) return;
    mesh.visible = !hiddenWalls.has(mesh.userData.wallId);
    if (mesh.material?.color) mesh.material.color.setHex(PHOTO_DOOR_BROWN_V72);
  });

  const floor = photoReferenceGroupV72.children.find(
    mesh => mesh.userData?.photoReferenceFloorV72
  );
  if (floor) {
    floor.visible = true;
    if (floor.material?.color) floor.material.color.setHex(PHOTO_FLOOR_NEUTRAL_V72);
  }
}

queueMicrotask(() => {
  rebuildPhotoReferenceSurfacesV72();

  // Synchronise immediately before every screen render and PNG export. This is the
  // final rendering hook, after all camera-cutaway and Photo-mode visibility updates.
  const rendererRenderBeforeV72 = renderer.render.bind(renderer);
  renderer.render = function(...args) {
    syncDedicatedPhotoSurfacesV72();
    return rendererRenderBeforeV72(...args);
  };

  const buildSceneBeforeV72 = buildScene;
  buildScene = function() {
    const result = buildSceneBeforeV72();
    photoReferenceSignatureV72 = '';
    syncDedicatedPhotoSurfacesV72();
    return result;
  };

  if (typeof refreshArchitectureVisuals === 'function') {
    const refreshArchitectureVisualsBeforeV72 = refreshArchitectureVisuals;
    refreshArchitectureVisuals = function(...args) {
      const result = refreshArchitectureVisualsBeforeV72(...args);
      photoReferenceSignatureV72 = '';
      syncDedicatedPhotoSurfacesV72();
      return result;
    };
  }

  const enterPhotoModeBeforeV72 = enterPhotoModeV31;
  enterPhotoModeV31 = function() {
    const result = enterPhotoModeBeforeV72();
    photoReferenceSignatureV72 = '';
    syncDedicatedPhotoSurfacesV72();
    return result;
  };

  const exitPhotoModeBeforeV72 = exitPhotoModeV31;
  exitPhotoModeV31 = function() {
    photoReferenceGroupV72.visible = false;
    const result = exitPhotoModeBeforeV72();
    return result;
  };

  syncDedicatedPhotoSurfacesV72();
});
