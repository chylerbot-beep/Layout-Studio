      // -----------------------------------------------------------------------------
      // Photoreal render controls: every camera export now pairs the clean camera
      // layout with an architecture-only, pixel-aligned depth PNG. The depth pass
      // contains the visible floor, walls, ceiling (eye views), fixed shell and
      // glass-block spatial dividers. Furniture, decor, labels, editor overlays,
      // window glass and door-swing guides are excluded.
      // -----------------------------------------------------------------------------

      const renderControlVersionV81 = '20260812-architecture-depth-v81';
      let renderControlExportingV81 = false;

      function renderControlSizeV81() {
        const preset = String($('capturePreset')?.value || '1600x1000');
        const [widthRaw, heightRaw] = preset.split('x').map(Number);
        return {
          width: Number.isFinite(widthRaw) && widthRaw > 0 ? widthRaw : 1600,
          height: Number.isFinite(heightRaw) && heightRaw > 0 ? heightRaw : 1000
        };
      }

      function renderControlBaseNameV81() {
        const pngName = typeof projectDownloadName === 'function'
          ? projectDownloadName('png')
          : `${safeShotSlugV70(project.meta?.name || project.name || 'layout-studio')}.png`;
        return String(pngName || 'layout-studio.png').replace(/\.png$/i, '');
      }

      function renderControlZipNameV81() {
        const name = project.meta?.name || project.name || 'layout-studio';
        return `${safeShotSlugV70(name)}-render-controls.zip`;
      }

      function trackedRenderGroupsV81() {
        return [
          basemapGroup,
          roomGroup,
          shellGroup,
          openingGroup,
          clearanceGroup,
          furnitureGroup,
          labelGroup,
          architectureLabelGroup,
          ceilingGroup,
          selectionOverlayGroup
        ].filter(Boolean);
      }

      function snapshotRenderPassV81() {
        return {
          background: scene.background,
          overrideMaterial: scene.overrideMaterial,
          outputEncoding: renderer.outputEncoding,
          groups: trackedRenderGroupsV81().map(group => [group, group.visible]),
          openingChildren: openingGroup.children.map(child => [child, child.visible]),
          furnitureChildren: furnitureGroup.children.map(child => [child, child.visible]),
          gridVisible: grid?.visible,
          transformVisible: transform.visible,
          resizeVisible: typeof carpentryResizeGroup !== 'undefined' ? carpentryResizeGroup.visible : null
        };
      }

      function restoreRenderPassV81(snapshot) {
        scene.background = snapshot.background;
        scene.overrideMaterial = snapshot.overrideMaterial;
        renderer.outputEncoding = snapshot.outputEncoding;
        snapshot.groups.forEach(([group, visible]) => { group.visible = visible; });
        snapshot.openingChildren.forEach(([child, visible]) => { child.visible = visible; });
        snapshot.furnitureChildren.forEach(([child, visible]) => { child.visible = visible; });
        if (grid && snapshot.gridVisible !== undefined) grid.visible = snapshot.gridVisible;
        transform.visible = snapshot.transformVisible;
        if (snapshot.resizeVisible !== null && typeof carpentryResizeGroup !== 'undefined') {
          carpentryResizeGroup.visible = snapshot.resizeVisible;
        }
      }

      function snapshotRenderWorkspaceV81() {
        return {
          camera: snapshotCameraStateV78(),
          pass: snapshotRenderPassV81()
        };
      }

      function restoreRenderWorkspaceV81(snapshot) {
        restoreCameraStateV78(snapshot.camera);
        restoreRenderPassV81(snapshot.pass);
        renderer.render(scene, camera);
      }

      function activeCameraTypeV81() {
        const active = (project.cameraShots || []).find(shot => shot.id === activeCameraShotIdV70);
        if (active) return active.type;
        if ($('viewTop')?.classList.contains('active')) return 'top';
        if ($('viewBird')?.classList.contains('active')) return 'bird';
        if ($('viewEye')?.classList.contains('active')) return 'eye';
        const direction = orbit.target.clone().sub(camera.position);
        const verticalRatio = Math.abs(direction.y) / Math.max(0.001, direction.length());
        return verticalRatio < 0.45 ? 'eye' : 'bird';
      }

      function includeCeilingInDepthV81() {
        return activeCameraTypeV81() === 'eye';
      }

      function isFixedSpatialDividerV81(item) {
        return item?.model === 'glass-blocks' || item?.includeInArchitectureDepth === true;
      }

      function hideEditorLayersV81() {
        basemapGroup.visible = false;
        roomGroup.visible = false;
        clearanceGroup.visible = false;
        labelGroup.visible = false;
        architectureLabelGroup.visible = false;
        selectionOverlayGroup.visible = false;
        if (grid) grid.visible = false;
        transform.visible = false;
        if (typeof carpentryResizeGroup !== 'undefined') carpentryResizeGroup.visible = false;
      }

      function prepareCameraLayoutPassV81(background) {
        hideEditorLayersV81();
        scene.overrideMaterial = null;
        renderer.outputEncoding = THREE.sRGBEncoding;
        scene.background = background === 'transparent' ? null : new THREE.Color(0xd9d5ce);
        shellGroup.visible = true;
        furnitureGroup.visible = true;
        openingGroup.visible = true;
        // Window panes are useful in the normal layout image. Door meshes are only
        // horizontal swing guides in Layout Studio and must not reach image generation.
        openingGroup.children.forEach(child => {
          child.visible = child.userData?.type === 'window';
        });
        ceilingGroup.visible = includeCeilingInDepthV81();
      }

      function prepareArchitectureDepthPassV81() {
        hideEditorLayersV81();
        scene.background = new THREE.Color(0x000000);
        openingGroup.visible = false;
        shellGroup.visible = true;
        ceilingGroup.visible = includeCeilingInDepthV81();
        furnitureGroup.visible = true;
        furnitureGroup.children.forEach(mesh => {
          const item = (project.furniture || []).find(candidate => candidate.id === mesh.userData?.id);
          mesh.visible = isFixedSpatialDividerV81(item);
        });
      }

      function visibleArchitectureBoundsV81() {
        scene.updateMatrixWorld(true);
        const bounds = new THREE.Box3();
        const objectBounds = new THREE.Box3();
        const roots = [shellGroup, ceilingGroup, furnitureGroup];
        roots.forEach(root => {
          if (!root.visible) return;
          root.traverseVisible(object => {
            if (!object.isMesh || !object.geometry) return;
            if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
            if (!object.geometry.boundingBox) return;
            objectBounds.copy(object.geometry.boundingBox).applyMatrix4(object.matrixWorld);
            bounds.union(objectBounds);
          });
        });
        return bounds;
      }

      function architectureDepthRangeV81() {
        const bounds = visibleArchitectureBoundsV81();
        if (bounds.isEmpty()) return { nearM: 0.1, farM: 25 };

        camera.updateMatrixWorld(true);
        const depths = [];
        const point = new THREE.Vector3();
        for (let xi = 0; xi < 2; xi += 1) {
          for (let yi = 0; yi < 2; yi += 1) {
            for (let zi = 0; zi < 2; zi += 1) {
              point.set(
                xi ? bounds.max.x : bounds.min.x,
                yi ? bounds.max.y : bounds.min.y,
                zi ? bounds.max.z : bounds.min.z
              ).applyMatrix4(camera.matrixWorldInverse);
              const depth = -point.z;
              if (Number.isFinite(depth) && depth > 0) depths.push(depth);
            }
          }
        }
        if (!depths.length) return { nearM: 0.1, farM: 25 };
        // The camera can sit inside the overall floor/shell bounds, so bounding-box
        // corners cannot reliably identify the nearest visible surface. A stable
        // interior near point keeps nearby walls and floor from collapsing to white.
        const nearM = Math.max(camera.near, 0.1);
        const farM = Math.min(camera.far, Math.max(nearM + 1, Math.max(...depths) + 0.5));
        return { nearM, farM };
      }

      function architectureDepthMaterialV81(range) {
        return new THREE.ShaderMaterial({
          uniforms: {
            cameraNear: { value: camera.near },
            cameraFar: { value: camera.far },
            controlNear: { value: range.nearM },
            controlFar: { value: range.farM }
          },
          vertexShader: `
            void main() {
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `,
          fragmentShader: `
            #include <packing>
            uniform float cameraNear;
            uniform float cameraFar;
            uniform float controlNear;
            uniform float controlFar;
            void main() {
              float viewZ = perspectiveDepthToViewZ(gl_FragCoord.z, cameraNear, cameraFar);
              float metres = -viewZ;
              float normalized = clamp((metres - controlNear) / max(0.001, controlFar - controlNear), 0.0, 1.0);
              // Reserve pure black for excluded/background pixels. Near architecture
              // is white; the farthest architecture remains visibly dark grey.
              float value = mix(1.0, 0.12, normalized);
              gl_FragColor = vec4(vec3(value), 1.0);
            }
          `,
          side: THREE.DoubleSide,
          depthTest: true,
          depthWrite: true,
          blending: THREE.NoBlending
        });
      }

      async function renderArchitectureDepthBlobV81() {
        const snapshot = snapshotRenderPassV81();
        let material = null;
        try {
          prepareArchitectureDepthPassV81();
          const range = architectureDepthRangeV81();
          material = architectureDepthMaterialV81(range);
          scene.overrideMaterial = material;
          renderer.outputEncoding = THREE.LinearEncoding;
          renderer.render(scene, camera);
          await waitCameraFramesV78(1);
          renderer.render(scene, camera);
          return {
            blob: await rendererPngBlobV78(),
            nearM: +range.nearM.toFixed(3),
            farM: +range.farM.toFixed(3)
          };
        } finally {
          if (material) material.dispose();
          restoreRenderPassV81(snapshot);
        }
      }

      async function captureRenderControlsV81() {
        if (renderControlExportingV81) return;
        if (typeof JSZip !== 'function') {
          alert('Camera and depth export is unavailable because JSZip did not load.');
          return;
        }

        const { width, height } = renderControlSizeV81();
        const background = $('captureBackground')?.value || 'light';
        const snapshot = snapshotRenderWorkspaceV81();
        const button = $('captureConfirm');
        const originalText = button?.textContent || 'Download camera + depth';
        renderControlExportingV81 = true;
        if (button) button.disabled = true;

        try {
          renderer.setSize(width, height, false);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          if (typeof applyCameraCutaway === 'function') applyCameraCutaway();
          if (typeof applyCameraFurnitureVisibilityV42 === 'function') applyCameraFurnitureVisibilityV42();
          await waitCameraFramesV78(3);

          prepareCameraLayoutPassV81(background);
          renderer.render(scene, camera);
          const cameraBlob = await rendererPngBlobV78();
          const depth = await renderArchitectureDepthBlobV81();
          const base = renderControlBaseNameV81();
          const zip = new JSZip();
          zip.file(`${base}-camera-layout.png`, cameraBlob);
          zip.file(`${base}-architecture-depth.png`, depth.blob);
          if (button) button.textContent = 'Building ZIP…';
          downloadBlob(await zip.generateAsync({ type: 'blob' }), `${base}-render-controls.zip`);
          $('captureModal')?.classList.remove('open');
        } catch (error) {
          console.error(error);
          alert(`Camera and depth export failed: ${error.message || error}`);
        } finally {
          restoreRenderWorkspaceV81(snapshot);
          renderControlExportingV81 = false;
          if (button) {
            button.disabled = false;
            button.textContent = originalText;
          }
        }
      }

      capturePng = captureRenderControlsV81;

      exportAllCameraShotsV78 = async function() {
        if (cameraShotBatchExportingV78 || renderControlExportingV81) return;
        const shots = ensureCameraShotsV70();
        if (!shots.length) {
          alert('This project has no named camera shots to export.');
          return;
        }
        if (typeof JSZip !== 'function') {
          alert('Camera and depth export is unavailable because JSZip did not load.');
          return;
        }

        const { width, height } = renderControlSizeV81();
        const background = $('captureBackground')?.value || 'light';
        const snapshot = snapshotRenderWorkspaceV81();
        const button = $('cameraShotExportAll');
        const originalText = button?.textContent || 'Export camera + depth';
        const zip = new JSZip();
        const folder = zip.folder('render-controls');
        const manifest = {
          project: project.meta?.name || project.name || 'Layout Studio project',
          exportedAt: new Date().toISOString(),
          exportVersion: renderControlVersionV81,
          preset: `${width}x${height}`,
          background,
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
        if (button) button.disabled = true;

        try {
          renderer.setSize(width, height, false);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();

          for (let index = 0; index < shots.length; index += 1) {
            const shot = shots[index];
            if (button) button.textContent = `Exporting ${index + 1}/${shots.length}…`;
            applyCameraShotV70(shot);
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            await waitCameraFramesV78(3);

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
              fov: shot.fov,
              cameraFilename,
              architectureDepthFilename: depthFilename,
              depthNearM: depth.nearM,
              depthFarM: depth.farM
            });
          }

          folder.file('camera-shots.json', JSON.stringify(manifest, null, 2));
          if (button) button.textContent = 'Building ZIP…';
          downloadBlob(await zip.generateAsync({ type: 'blob' }), renderControlZipNameV81());
          const note = $('cameraShotNote');
          if (note) {
            note.textContent = `${shots.length} camera-layout and architecture-depth pair${shots.length === 1 ? '' : 's'} exported at ${width}×${height}.`;
          }
        } catch (error) {
          console.error(error);
          alert(`Camera and depth export failed: ${error.message || error}`);
        } finally {
          restoreRenderWorkspaceV81(snapshot);
          cameraShotBatchExportingV78 = false;
          renderControlExportingV81 = false;
          if (button) {
            button.disabled = false;
            button.textContent = originalText;
          }
        }
      };

      if ($('capture')) {
        $('capture').textContent = 'Export camera + depth';
        $('capture').title = 'Export the clean camera layout and its pixel-aligned architecture-only depth PNG.';
      }
      if ($('captureConfirm')) $('captureConfirm').textContent = 'Download camera + depth ZIP';
      const captureDialogV81 = $('captureModal')?.querySelector('.dialog');
      if (captureDialogV81) {
        const title = captureDialogV81.querySelector('h3');
        const note = captureDialogV81.querySelector('p.small');
        if (title) title.textContent = 'Export camera and architecture depth';
        if (note) note.textContent = 'Downloads two aligned PNGs: the clean camera layout and an architecture-only depth map.';
      }

      queueMicrotask(() => {
        const button = $('cameraShotExportAll');
        if (!button) return;
        button.textContent = 'Export camera + depth';
        button.title = 'Export every named shot as a clean camera-layout PNG plus a pixel-aligned architecture-depth PNG.';
      });
