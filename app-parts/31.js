// Basemap UI, eye-level camera defaults and clickable validation navigation.
// Loads after app-parts/30.js and before app-parts/08.js.

const layoutRefinementVersionV64 = '20260715-basemap-camera-validation-v64';

function hideBasemapPrecisionUiV64() {
  ['planWidth', 'planDepth', 'basemapOffsetX', 'basemapOffsetY', 'lockBasemapRatio']
    .forEach(id => {
      const control = $(id);
      const label = control?.closest('label');
      if (!label) return;
      label.hidden = true;
      label.style.display = 'none';
    });

  // Keep the registration status available to the review workflow, but remove the
  // duplicate authority bubble from the normal Floor-plan basemap section.
  const registration = $('basemapRegistrationStatusV50');
  if (registration) {
    registration.hidden = true;
    registration.style.display = 'none';
  }
}

function reorderCameraVisibilityUiV64() {
  const cameraSection = $('fovField')?.closest('.section');
  const body = cameraSection?.querySelector(':scope > .right-section-collapse-body') || cameraSection;
  const labels = $('eyeLabelCleanupControls');
  const blocking = $('cameraCutawayControls');
  const furniture = $('cameraFurnitureControls');
  if (!body || !labels || !blocking) return;

  // app-parts/17 originally nests Eye-level labels inside Blocking walls.
  // Move it out so the visible order is Camera fields → Eye-level labels →
  // Blocking walls → Furniture visibility.
  body.insertBefore(labels, blocking);
  if (furniture && furniture.parentElement !== body) body.appendChild(furniture);
}

function applyEyeVisibilityDefaultsV64() {
  project.settings = project.settings || {};
  if (project.settings.eyeVisibilityDefaultsV64 === true) return false;

  project.settings.cameraCutaway = project.settings.cameraCutaway || {};
  project.settings.cameraCutaway.enabled = true;
  project.settings.cameraCutaway.style = 'hide';
  project.settings.cameraCutaway.opacity = 0;
  project.settings.cameraCutaway.depth = 3000;
  project.settings.cameraCutaway.hiddenWallIds = Array.isArray(project.settings.cameraCutaway.hiddenWallIds)
    ? project.settings.cameraCutaway.hiddenWallIds
    : [];

  project.settings.cameraFurniture = project.settings.cameraFurniture || {};
  project.settings.cameraFurniture.enabled = true;
  project.settings.cameraFurniture.depth = 3000;
  project.settings.cameraFurniture.hiddenIds = Array.isArray(project.settings.cameraFurniture.hiddenIds)
    ? project.settings.cameraFurniture.hiddenIds
    : [];
  project.settings.cameraFurniture.shownIds = Array.isArray(project.settings.cameraFurniture.shownIds)
    ? project.settings.cameraFurniture.shownIds
    : [];

  project.settings.eyeVisibilityDefaultsV64 = true;
  return true;
}

function syncEyeVisibilityDefaultsV64() {
  if (typeof syncCameraCutawayControls === 'function') syncCameraCutawayControls();
  if (typeof syncCameraFurnitureControlsV42 === 'function') syncCameraFurnitureControlsV42();
  if (typeof applyCameraCutaway === 'function') applyCameraCutaway();
  if (typeof applyCameraFurnitureVisibilityV42 === 'function') applyCameraFurnitureVisibilityV42();
}

function validationFurnitureFromMessageV64(message) {
  const text = String(message || '').replace(/^\s*[•*-]\s*/, '').trim();
  return [...(project.furniture || [])]
    .filter(item => item?.id && item?.name)
    .sort((a, b) => String(b.name).length - String(a.name).length)
    .find(item => text === item.name || text.startsWith(`${item.name} `)) || null;
}

function focusValidationFurnitureV64(id) {
  const mesh = furnitureGroup.children.find(object => object.userData?.id === id);
  if (!mesh) return;

  if (typeof photoModeActiveV31 !== 'undefined' && photoModeActiveV31 && typeof exitPhotoModeV31 === 'function') {
    exitPhotoModeV31();
  }

  const box = new THREE.Box3().setFromObject(mesh);
  if (box.isEmpty()) return;
  const centre = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());

  // Seed the preserved-focus view system with the error object's plan position.
  orbit.target.set(centre.x, 0, centre.z);
  if (typeof viewBird === 'function') viewBird();

  const heading = camera.position.clone().sub(orbit.target);
  heading.y = 0;
  if (heading.lengthSq() < .001) heading.set(.72, 0, .69);
  heading.normalize();

  const span = Math.max(.8, size.x, size.z);
  const height = Math.max(3.5, Math.min(8, span * 2.2 + 2.2));
  const horizontal = Math.max(2.4, Math.min(6, span * 1.6 + 2));
  const targetY = Math.max(0, Math.min(1.6, centre.y));

  camera.up.set(0, 1, 0);
  camera.fov = 52;
  camera.updateProjectionMatrix();
  orbit.target.set(centre.x, targetY, centre.z);
  camera.position.set(
    centre.x + heading.x * horizontal,
    targetY + height,
    centre.z + heading.z * horizontal
  );
  orbit.enabled = true;
  orbit.enableRotate = true;
  orbit.enablePan = true;
  orbit.enableZoom = true;
  orbit.update();
  setViewButton('viewBird');

  // Bird's-eye distance normally restores automatically hidden furniture. Make
  // the selected object visible immediately as well, including the first frame.
  mesh.visible = true;
  selectById(id);

  if (typeof scheduleCameraCutaway === 'function') scheduleCameraCutaway();
  if (typeof scheduleCameraFurnitureVisibilityV42 === 'function') scheduleCameraFurnitureVisibilityV42();
  if (typeof scheduleEyeLabelCleanup === 'function') scheduleEyeLabelCleanup();
}

function decorateValidationWarningsV64() {
  const list = $('warningList');
  if (!list) return;

  list.querySelectorAll(':scope > li').forEach(item => {
    const furniture = validationFurnitureFromMessageV64(item.textContent);
    if (!furniture) return;

    item.classList.add('validation-focus-v64');
    item.dataset.objectId = furniture.id;
    item.tabIndex = 0;
    item.setAttribute('role', 'button');
    item.setAttribute('aria-label', `Select and focus ${furniture.name}`);
    item.title = `Select ${furniture.name} and centre it in Bird's-eye view`;

    const activate = event => {
      if (event.type === 'keydown' && !['Enter', ' '].includes(event.key)) return;
      event.preventDefault();
      event.stopPropagation();
      focusValidationFurnitureV64(furniture.id);
    };
    item.onclick = activate;
    item.onkeydown = activate;
  });
}

if (!document.getElementById('layoutRefinementStylesV64')) {
  const style = document.createElement('style');
  style.id = 'layoutRefinementStylesV64';
  style.textContent = `
    #basemapRegistrationStatusV50{display:none!important}
    #eyeLabelCleanupControls{margin-top:14px}
    #cameraCutawayControls{margin-top:14px}
    #warningList>li.validation-focus-v64{
      cursor:pointer;
      border-radius:7px;
      padding:7px 8px;
      margin:4px 0;
      transition:background .12s ease,border-color .12s ease;
      border:1px solid transparent;
    }
    #warningList>li.validation-focus-v64:hover{
      background:rgba(223,116,104,.12);
      border-color:rgba(223,116,104,.42);
    }
    #warningList>li.validation-focus-v64:focus-visible{
      outline:2px solid var(--sage);
      outline-offset:2px;
    }
  `;
  document.head.appendChild(style);
}

// app-parts/08 performs the final startup and event binding. Patch the completed
// application in a microtask so these refinements sit on top of every earlier
// override without duplicating base logic.
queueMicrotask(() => {
  hideBasemapPrecisionUiV64();
  reorderCameraVisibilityUiV64();

  const normalizeProjectBeforeV64 = normalizeProject;
  normalizeProject = function() {
    normalizeProjectBeforeV64();
    applyEyeVisibilityDefaultsV64();
  };

  if (typeof normalizeProjectV27 === 'function') {
    const normalizeProjectV27BeforeV64 = normalizeProjectV27;
    normalizeProjectV27 = function() {
      normalizeProjectV27BeforeV64();
      applyEyeVisibilityDefaultsV64();
    };
  }

  const renderArchitectureAuthorityStatusBeforeV64 = typeof renderArchitectureAuthorityStatusV50 === 'function'
    ? renderArchitectureAuthorityStatusV50
    : null;
  if (renderArchitectureAuthorityStatusBeforeV64) {
    renderArchitectureAuthorityStatusV50 = function() {
      renderArchitectureAuthorityStatusBeforeV64();
      hideBasemapPrecisionUiV64();
    };
  }

  const validateBeforeV64 = validate;
  validate = function() {
    const result = validateBeforeV64();
    decorateValidationWarningsV64();
    return result;
  };

  applyEyeVisibilityDefaultsV64();
  syncEyeVisibilityDefaultsV64();
  validate();
});
