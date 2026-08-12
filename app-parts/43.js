      // Optional Photo-mode architecture boundaries. These are diagnostic guides for
      // GPT Image: they remain attached to the authored geometry, carry into the
      // camera-layout PNG, and are always removed from the paired depth pass.

      const photoBoundaryMeshesV85 = new Set();

      function ensurePhotoBoundarySettingsV85() {
        project.settings = project.settings || {};
        if (typeof project.settings.photoBoundaryLines !== 'boolean') {
          project.settings.photoBoundaryLines = false;
        }
        return project.settings.photoBoundaryLines;
      }

      function isPhotoBoundaryGuideV85(object) {
        return object?.userData?.photoBoundaryGuide === true;
      }

      function removePhotoBoundaryGuideV85(mesh) {
        const guides = mesh.children.filter(isPhotoBoundaryGuideV85);
        guides.forEach(guide => {
          mesh.remove(guide);
          guide.geometry?.dispose?.();
          const materials = Array.isArray(guide.material) ? guide.material : [guide.material];
          materials.filter(Boolean).forEach(material => material.dispose?.());
        });
      }

      function addPhotoBoundaryGuideV85(mesh) {
        if (!mesh?.isMesh || !mesh.geometry || isPhotoBoundaryGuideV85(mesh)) return;
        removePhotoBoundaryGuideV85(mesh);
        const geometry = new THREE.EdgesGeometry(mesh.geometry, 24);
        if (!geometry.getAttribute('position')?.count) {
          geometry.dispose();
          return;
        }
        const material = new THREE.LineBasicMaterial({
          color: 0x58616a,
          transparent: true,
          opacity: 0.48,
          depthTest: true,
          depthWrite: false,
          blending: THREE.NormalBlending
        });
        const guide = new THREE.LineSegments(geometry, material);
        guide.name = 'Photo boundary guide';
        guide.renderOrder = 910;
        guide.frustumCulled = mesh.frustumCulled;
        guide.userData = { photoBoundaryGuide: true };
        // Boundary guides are display-only and must never become selectable.
        guide.raycast = () => {};
        guide.visible = false;
        mesh.add(guide);
        photoBoundaryMeshesV85.add(mesh);
      }

      function photoBoundarySourceMeshesV85() {
        const meshes = [];
        [shellGroup, ceilingGroup].forEach(root => {
          root?.traverse(object => {
            if (object.isMesh && !isPhotoBoundaryGuideV85(object)) meshes.push(object);
          });
        });
        furnitureGroup?.children.forEach(object => {
          const item = (project.furniture || []).find(candidate => candidate.id === object.userData?.id);
          const fixedDivider = item?.model === 'glass-blocks' || item?.includeInArchitectureDepth === true;
          if (!fixedDivider) return;
          object.traverse(child => {
            if (child.isMesh && !isPhotoBoundaryGuideV85(child)) meshes.push(child);
          });
        });
        return [...new Set(meshes)];
      }

      function rebuildPhotoBoundaryGuidesV85() {
        photoBoundaryMeshesV85.forEach(mesh => removePhotoBoundaryGuideV85(mesh));
        photoBoundaryMeshesV85.clear();
        photoBoundarySourceMeshesV85().forEach(addPhotoBoundaryGuideV85);
        syncPhotoBoundaryVisibilityV85();
      }

      function setPhotoBoundaryVisibilityV85(visible) {
        photoBoundaryMeshesV85.forEach(mesh => {
          mesh.children.filter(isPhotoBoundaryGuideV85).forEach(guide => {
            guide.visible = !!visible;
          });
        });
      }

      function syncPhotoBoundaryVisibilityV85() {
        setPhotoBoundaryVisibilityV85(
          !!photoModeActiveV31 && ensurePhotoBoundarySettingsV85()
        );
        syncPhotoBoundaryToggleV85();
      }

      function syncPhotoBoundaryToggleV85() {
        const button = $('photoBoundaryLines');
        if (!button) return;
        const enabled = ensurePhotoBoundarySettingsV85();
        button.textContent = `Boundary lines: ${enabled ? 'on' : 'off'}`;
        button.classList.toggle('active', enabled);
        button.setAttribute('aria-pressed', String(enabled));
      }

      if (!$('photoBoundaryLines')) {
        const style = document.createElement('style');
        style.id = 'photoBoundaryStylesV85';
        style.textContent = `
          #photoBoundaryLines{display:none}
          .app.photo-mode #photoBoundaryLines{display:inline-block}
          #photoBoundaryLines.active{background:var(--sage-dark);border-color:var(--sage)}
        `;
        document.head.appendChild(style);

        const button = document.createElement('button');
        button.id = 'photoBoundaryLines';
        button.type = 'button';
        button.setAttribute('aria-pressed', 'false');
        button.title = 'Show faint architecture boundaries in Photo mode and camera-layout exports. The depth map stays clean.';
        const captureButton = $('capture');
        captureButton?.parentNode?.insertBefore(button, captureButton);
        button.addEventListener('click', () => {
          pushHistory('toggle photo boundary lines');
          project.settings.photoBoundaryLines = !ensurePhotoBoundarySettingsV85();
          syncPhotoBoundaryVisibilityV85();
        });
      }

      const buildSceneBeforePhotoBoundariesV85 = buildScene;
      buildScene = function () {
        const result = buildSceneBeforePhotoBoundariesV85();
        rebuildPhotoBoundaryGuidesV85();
        return result;
      };

      // Shell-only edits do not run buildScene, so refresh guides after the
      // architecture refresh path replaces floor or wall meshes.
      const refreshArchitectureVisualsBeforePhotoBoundariesV85 = refreshArchitectureVisuals;
      refreshArchitectureVisuals = function (...args) {
        const result = refreshArchitectureVisualsBeforePhotoBoundariesV85(...args);
        rebuildPhotoBoundaryGuidesV85();
        return result;
      };

      // Ceiling height has its own lightweight rebuild path in the header.
      const buildCeilingBeforePhotoBoundariesV85 = buildCeiling;
      buildCeiling = function () {
        const result = buildCeilingBeforePhotoBoundariesV85();
        rebuildPhotoBoundaryGuidesV85();
        return result;
      };

      const normalizeProjectBeforePhotoBoundariesV85 = normalizeProject;
      normalizeProject = function () {
        normalizeProjectBeforePhotoBoundariesV85();
        ensurePhotoBoundarySettingsV85();
      };
      if (typeof normalizeProjectV27 === 'function') {
        const normalizeProjectV27BeforePhotoBoundariesV85 = normalizeProjectV27;
        normalizeProjectV27 = function () {
          normalizeProjectV27BeforePhotoBoundariesV85();
          ensurePhotoBoundarySettingsV85();
        };
      }

      const enterPhotoModeBeforeBoundariesV85 = enterPhotoModeV31;
      enterPhotoModeV31 = function () {
        enterPhotoModeBeforeBoundariesV85();
        syncPhotoBoundaryVisibilityV85();
      };
      const exitPhotoModeBeforeBoundariesV85 = exitPhotoModeV31;
      exitPhotoModeV31 = function () {
        exitPhotoModeBeforeBoundariesV85();
        syncPhotoBoundaryVisibilityV85();
      };

      // Extend the export snapshot so the nested camera/depth passes restore the
      // viewport overlay exactly, even when a camera-layout capture enables it.
      const snapshotRenderPassBeforeBoundariesV85 = snapshotRenderPassV81;
      snapshotRenderPassV81 = function () {
        const snapshot = snapshotRenderPassBeforeBoundariesV85();
        snapshot.photoBoundaryVisibilityV85 = [...photoBoundaryMeshesV85].map(mesh => [
          mesh,
          mesh.children.filter(isPhotoBoundaryGuideV85).map(guide => [guide, guide.visible])
        ]);
        return snapshot;
      };
      const restoreRenderPassBeforeBoundariesV85 = restoreRenderPassV81;
      restoreRenderPassV81 = function (snapshot) {
        restoreRenderPassBeforeBoundariesV85(snapshot);
        (snapshot.photoBoundaryVisibilityV85 || []).forEach(([, guides]) => {
          guides.forEach(([guide, visible]) => { guide.visible = visible; });
        });
      };

      const prepareCameraLayoutPassBeforeBoundariesV85 = prepareCameraLayoutPassV81;
      prepareCameraLayoutPassV81 = function (background) {
        prepareCameraLayoutPassBeforeBoundariesV85(background);
        // The saved setting controls the camera reference independently of whether
        // the export modal was opened before or after leaving Photo mode.
        setPhotoBoundaryVisibilityV85(ensurePhotoBoundarySettingsV85());
      };

      const prepareArchitectureDepthPassBeforeBoundariesV85 = prepareArchitectureDepthPassV81;
      prepareArchitectureDepthPassV81 = function () {
        prepareArchitectureDepthPassBeforeBoundariesV85();
        setPhotoBoundaryVisibilityV85(false);
      };

      ensurePhotoBoundarySettingsV85();
      syncPhotoBoundaryToggleV85();
