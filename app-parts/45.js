      // -----------------------------------------------------------------------------
      // Supported automation surface for cloud agents and test harnesses.
      //
      // The API deliberately calls the same in-browser alignment, validation,
      // camera-ranking and render-control functions used by the visible UI. It does
      // not duplicate those algorithms or bypass the two approval gates.
      // -----------------------------------------------------------------------------

      const layoutStudioAutomationVersionV91 = '20260815-layout-studio-automation-v91';

      function cloneAutomationValueV91(value) {
        return JSON.parse(JSON.stringify(value));
      }

      function automationWarningsV91() {
        return [...document.querySelectorAll('#warningList li')]
          .map(item => item.textContent.trim())
          .filter(Boolean);
      }

      function automationFurnitureSnapshotV91(items = project.furniture || []) {
        return new Map(items.map(item => [item.id, {
          id: item.id,
          name: item.name || item.id,
          x: +item.x || 0,
          y: +item.y || 0,
          rotation: +item.rotation || 0,
          elevation: +item.elevation || 0,
          placement: cloneAutomationValueV91(item.placement || null)
        }]));
      }

      function automationFurnitureChangesV91(before, after) {
        const changes = [];
        after.forEach((item, id) => {
          const previous = before.get(id);
          if (!previous) {
            changes.push({ id, name: item.name, kind: 'added', after: item });
            return;
          }
          const moved = Math.hypot(item.x - previous.x, item.y - previous.y) > 0.5 ||
            Math.abs(item.elevation - previous.elevation) > 0.5;
          const rotated = Math.abs(item.rotation - previous.rotation) > 0.1;
          const placementChanged = JSON.stringify(item.placement) !== JSON.stringify(previous.placement);
          if (moved || rotated || placementChanged) {
            changes.push({
              id,
              name: item.name,
              kind: 'updated',
              moved,
              rotated,
              placementChanged,
              before: previous,
              after: item
            });
          }
        });
        return changes;
      }

      function automationLoadBasemapV91() {
        return new Promise(resolve => {
          basemapImage = null;
          if (!project.basemap?.dataUrl) {
            buildBasemap(true);
            resolve();
            return;
          }
          const image = new Image();
          image.onload = () => {
            basemapImage = image;
            buildBasemap(true);
            resolve();
          };
          image.onerror = () => {
            basemapImage = null;
            buildBasemap(true);
            resolve();
          };
          image.src = project.basemap.dataUrl;
        });
      }

      async function automationLoadProjectV91(source) {
        if (!source || typeof source !== 'object' || Array.isArray(source)) {
          throw new Error('A Layout Studio project object is required.');
        }
        project = cloneAutomationValueV91(source);
        normalizeProject();
        selected = null;
        selectedArchitecture = null;
        transform.detach();
        wallDetectionCache = null;
        basemapRenderSignature = '';
        buildScene();
        syncBasemapControls();
        await automationLoadBasemapV91();
        if (project.camera?.position?.length === 3 && project.camera?.target?.length === 3) {
          camera.position.fromArray(project.camera.position);
          orbit.target.fromArray(project.camera.target);
          camera.fov = Number.isFinite(+project.camera.fov) ? +project.camera.fov : camera.fov;
          camera.updateProjectionMatrix();
          orbit.update();
        }
        resize();
        renderer.render(scene, camera);
        validate();
        return {
          name: project.meta?.name || project.name || 'Untitled layout',
          furnitureCount: (project.furniture || []).length,
          cameraCandidateCount: project.cameraPlan?.candidates?.length || 0,
          warnings: automationWarningsV91()
        };
      }

      function automationProjectV91() {
        syncSelectedFromMesh();
        project.camera = {
          position: camera.position.toArray(),
          target: orbit.target.toArray(),
          fov: camera.fov
        };
        project.meta = project.meta || {};
        project.meta.updatedAt = new Date().toISOString();
        return cloneAutomationValueV91(project);
      }

      async function automationAlignAndValidateV91() {
        const before = automationFurnitureSnapshotV91();
        autoAlignFurniture();
        validate();
        const after = automationFurnitureSnapshotV91();
        const changes = automationFurnitureChangesV91(before, after);
        const status = $('furnitureAlignStatus')?.textContent?.trim() || '';
        return {
          status,
          changedCount: changes.length,
          movedCount: changes.filter(change => change.moved).length,
          rotatedCount: changes.filter(change => change.rotated).length,
          changes,
          warnings: automationWarningsV91(),
          project: automationProjectV91()
        };
      }

      async function automationRankCamerasV91() {
        const messages = [];
        const previousAlert = window.alert;
        window.alert = message => messages.push(String(message));
        try {
          await rankCameraPlanV90();
        } finally {
          window.alert = previousAlert;
        }
        const shots = project.cameraShots || [];
        if (project.cameraPlan?.status !== 'ranked' || shots.length !== cameraFinalShotCountV90) {
          const status = $('cameraCompositionStatusV90')?.textContent?.trim();
          throw new Error(messages[0] || status || 'Camera ranking did not produce eight shots.');
        }
        return {
          rankingVersion: project.cameraPlan.rankingVersion || cameraCompositionVersionV90,
          shots: cloneAutomationValueV91(shots),
          results: cloneAutomationValueV91(project.cameraPlan.results || []),
          warnings: automationWarningsV91(),
          project: automationProjectV91()
        };
      }

      function automationRenderSizeV91(options = {}) {
        const fallback = renderControlSizeV81();
        const width = Math.max(320, Math.min(4096, Math.round(+options.width || fallback.width)));
        const height = Math.max(320, Math.min(4096, Math.round(+options.height || fallback.height)));
        return { width, height };
      }

      async function automationExportCameraControlsV91(options = {}) {
        if (cameraShotBatchExportingV78 || renderControlExportingV81) {
          throw new Error('A camera export is already running.');
        }
        if (typeof JSZip !== 'function') throw new Error('JSZip is unavailable.');
        const shots = ensureCameraShotsV70();
        if (shots.length !== cameraFinalShotCountV90) {
          throw new Error(`Exactly ${cameraFinalShotCountV90} ranked camera shots are required; found ${shots.length}.`);
        }

        const { width, height } = automationRenderSizeV91(options);
        const background = ['light', 'dark', 'transparent'].includes(options.background)
          ? options.background
          : ($('captureBackground')?.value || 'light');
        const snapshot = snapshotRenderWorkspaceV81();
        const zip = new JSZip();
        const folder = zip.folder('render-controls');
        const manifest = {
          project: project.meta?.name || project.name || 'Layout Studio project',
          exportedAt: new Date().toISOString(),
          exportVersion: renderControlVersionV81,
          automationVersion: layoutStudioAutomationVersionV91,
          preset: `${width}x${height}`,
          background,
          cameraLayout: { boundaryLines: ensurePhotoBoundarySettingsV85() },
          cameraComposition: project.cameraPlan ? {
            version: project.cameraPlan.version || 3,
            candidateCount: project.cameraPlan.candidateCount || 12,
            finalShotCount: project.cameraPlan.finalShotCount || 8,
            profile: project.cameraPlan.compositionProfile || 'editorial-residential',
            rankingVersion: project.cameraPlan.rankingVersion || null
          } : null,
          depth: {
            scope: 'architecture-only',
            convention: 'near-white-far-dark',
            excludedPixels: 'black',
            includes: ['floor', 'visible walls', 'eye-view ceiling', 'fixed shell', 'glass-block spatial dividers', 'door and window apertures'],
            excludes: ['furniture', 'decor', 'labels', 'editor overlays', 'window glass', 'door-swing guides']
          },
          shots: []
        };

        cameraShotBatchExportingV78 = true;
        renderControlExportingV81 = true;
        try {
          renderer.setSize(width, height, false);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          for (let index = 0; index < shots.length; index += 1) {
            const shot = shots[index];
            applyCameraShotV70(shot);
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            await settleCameraVisibilityV82();
            prepareCameraLayoutPassV81(background);
            renderer.render(scene, camera);
            await waitCameraFramesV78(1);
            renderer.render(scene, camera);
            const cameraBlob = await rendererPngBlobV78();
            const depth = await renderArchitectureDepthBlobV81();
            const sequence = String(index + 1).padStart(2, '0');
            const base = `${sequence}-${safeShotSlugV70(shot.label || shot.id)}`;
            const cameraFilename = `${base}-camera-layout.png`;
            const depthFilename = `${base}-architecture-depth.png`;
            folder.file(cameraFilename, cameraBlob);
            folder.file(depthFilename, depth.blob);
            manifest.shots.push({
              id: shot.id,
              label: shot.label,
              roomId: shot.roomId || null,
              type: shot.type,
              role: shot.role || null,
              fov: shot.fov,
              compositionRank: shot.compositionRank || null,
              compositionScore: Number.isFinite(shot.compositionScore) ? shot.compositionScore : null,
              visibility: shot.visibility || null,
              cameraFilename,
              architectureDepthFilename: depthFilename,
              depthNearM: depth.nearM,
              depthFarM: depth.farM
            });
          }
          folder.file('camera-shots.json', JSON.stringify(manifest, null, 2));
          const zipBase64 = await zip.generateAsync({
            type: 'base64',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
          });
          return {
            filename: renderControlZipNameV81(),
            mimeType: 'application/zip',
            zipBase64,
            manifest,
            project: automationProjectV91()
          };
        } finally {
          restoreRenderWorkspaceV81(snapshot);
          cameraShotBatchExportingV78 = false;
          renderControlExportingV81 = false;
        }
      }

      window.LayoutStudioAutomation = Object.freeze({
        version: layoutStudioAutomationVersionV91,
        isReady: () => Boolean(renderer && camera && orbit && typeof buildScene === 'function'),
        loadProject: automationLoadProjectV91,
        getProject: automationProjectV91,
        alignAndValidate: automationAlignAndValidateV91,
        rankCameras: automationRankCamerasV91,
        exportCameraControls: automationExportCameraControlsV91
      });
