      // -----------------------------------------------------------------------------
      // Camera-shot workflow: after architecture confirmation jump directly to the
      // first authored hero view, and batch-export every named camera shot to one ZIP.
      // Additive only: projects without cameraShots keep the previous behaviour.
      // -----------------------------------------------------------------------------

      const layoutCameraBatchVersionV78 = '20260811-camera-batch-export-v78';
      let cameraShotBatchExportingV78 = false;

      function waitCameraFramesV78(count = 2) {
        return new Promise(resolve => {
          const step = () => {
            count -= 1;
            if (count <= 0) resolve();
            else requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        });
      }

      function rendererPngBlobV78() {
        return new Promise((resolve, reject) => {
          renderer.domElement.toBlob(blob => {
            if (blob) resolve(blob);
            else reject(new Error('The camera view could not be encoded as PNG.'));
          }, 'image/png');
        });
      }

      function cameraShotZipNameV78() {
        const name = project.meta?.name || project.name || 'layout-studio';
        return `${safeShotSlugV70(name)}-camera-shots.zip`;
      }

      function snapshotCameraStateV78() {
        const size = new THREE.Vector2();
        renderer.getSize(size);
        return {
          size,
          background: scene.background,
          gridVisible: grid.visible,
          clearanceVisible: clearanceGroup.visible,
          transformVisible: transform.visible,
          position: camera.position.clone(),
          target: orbit.target.clone(),
          up: camera.up.clone(),
          fov: camera.fov,
          activeShotId: activeCameraShotIdV70,
          activeView: ['viewTop', 'viewBird', 'viewEye'].find(id => $(id)?.classList.contains('active')) || null
        };
      }

      function restoreCameraStateV78(snapshot) {
        renderer.setSize(snapshot.size.x, snapshot.size.y, false);
        camera.aspect = snapshot.size.x / Math.max(1, snapshot.size.y);
        scene.background = snapshot.background;
        grid.visible = snapshot.gridVisible;
        clearanceGroup.visible = snapshot.clearanceVisible;
        transform.visible = snapshot.transformVisible;

        const activeShot = (project.cameraShots || []).find(shot => shot.id === snapshot.activeShotId);
        if (activeShot) {
          applyCameraShotV70(activeShot);
        } else {
          activeCameraShotIdV70 = null;
          camera.position.copy(snapshot.position);
          orbit.target.copy(snapshot.target);
          camera.up.copy(snapshot.up);
          camera.fov = snapshot.fov;
          camera.updateProjectionMatrix();
          orbit.enabled = true;
          orbit.enableRotate = true;
          orbit.enablePan = true;
          orbit.enableZoom = true;
          orbit.update();
          syncCameraShotControlsV70();
          if ($('fovField')) $('fovField').value = Math.round(camera.fov);
          if ($('depthField')) $('depthField').value = Math.round(camera.fov);
          if ($('cameraHeight')) $('cameraHeight').value = Math.round(camera.position.y / MM);
        }

        ['viewTop', 'viewBird', 'viewEye'].forEach(id => {
          $(id)?.classList.toggle('active', id === snapshot.activeView);
        });
        if (typeof scheduleCameraCutaway === 'function') scheduleCameraCutaway();
        if (typeof scheduleCameraFurnitureVisibilityV42 === 'function') scheduleCameraFurnitureVisibilityV42();
        if (typeof scheduleEyeLabelCleanup === 'function') scheduleEyeLabelCleanup();
        if (typeof syncFurnitureLabelsV60 === 'function') syncFurnitureLabelsV60();
      }

      async function exportAllCameraShotsV78() {
        if (cameraShotBatchExportingV78) return;
        const shots = ensureCameraShotsV70();
        if (!shots.length) {
          alert('This project has no named camera shots to export.');
          return;
        }
        if (typeof JSZip !== 'function') {
          alert('ZIP export is unavailable because JSZip did not load.');
          return;
        }

        const preset = String($('capturePreset')?.value || '1600x1000');
        const [widthRaw, heightRaw] = preset.split('x').map(Number);
        const width = Number.isFinite(widthRaw) && widthRaw > 0 ? widthRaw : 1600;
        const height = Number.isFinite(heightRaw) && heightRaw > 0 ? heightRaw : 1000;
        const background = $('captureBackground')?.value || 'light';
        const snapshot = snapshotCameraStateV78();
        const button = $('cameraShotExportAll');
        const originalText = button?.textContent || 'Export all shots';
        const zip = new JSZip();
        const folder = zip.folder('camera-shots');
        const manifest = {
          project: project.meta?.name || project.name || 'Layout Studio project',
          exportedAt: new Date().toISOString(),
          preset: `${width}x${height}`,
          background,
          shots: []
        };

        cameraShotBatchExportingV78 = true;
        if (button) button.disabled = true;

        try {
          if (background === 'transparent') scene.background = null;
          grid.visible = false;
          clearanceGroup.visible = false;
          transform.visible = false;

          renderer.setSize(width, height, false);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();

          for (let index = 0; index < shots.length; index += 1) {
            const shot = shots[index];
            if (button) button.textContent = `Exporting ${index + 1}/${shots.length}…`;

            applyCameraShotV70(shot);
            camera.aspect = width / height;
            camera.updateProjectionMatrix();

            // Applying a shot schedules cutaway, nearby-furniture and label updates.
            // Give those hooks time to settle before rendering the export frame.
            await waitCameraFramesV78(3);
            renderer.render(scene, camera);
            await waitCameraFramesV78(1);
            renderer.render(scene, camera);

            const blob = await rendererPngBlobV78();
            const sequence = String(index + 1).padStart(2, '0');
            const filename = `${sequence}-${safeShotSlugV70(shot.label || shot.id)}.png`;
            folder.file(filename, blob);
            manifest.shots.push({
              id: shot.id,
              label: shot.label,
              roomId: shot.roomId || null,
              type: shot.type,
              fov: shot.fov,
              filename
            });
          }

          folder.file('camera-shots.json', JSON.stringify(manifest, null, 2));
          if (button) button.textContent = 'Building ZIP…';
          const blob = await zip.generateAsync({ type: 'blob' });
          downloadBlob(blob, cameraShotZipNameV78());

          const note = $('cameraShotNote');
          if (note) {
            note.textContent = `${shots.length} camera shot${shots.length === 1 ? '' : 's'} exported as one ZIP using ${width}×${height}.`;
          }
        } catch (error) {
          console.error(error);
          alert(`Camera-shot export failed: ${error.message || error}`);
        } finally {
          restoreCameraStateV78(snapshot);
          cameraShotBatchExportingV78 = false;
          if (button) {
            button.disabled = false;
            button.textContent = originalText;
          }
        }
      }

      function applyFirstCameraShotAfterArchitectureV78() {
        if (project.settings?.architectureReviewConfirmed !== true) return;
        const shots = ensureCameraShotsV70();
        if (!shots.length) return;

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (project.settings?.architectureReviewConfirmed !== true) return;
            applyCameraShotV70(shots[0]);
            const note = $('cameraShotNote');
            if (note) {
              note.textContent = `Architecture confirmed · loaded ${shots[0].label}. ${shots.length} preset shot${shots.length === 1 ? '' : 's'} ready.`;
            }
            if ($('toolHint')) {
              $('toolHint').textContent = `Architecture confirmed. Camera shot 1 of ${shots.length} is ready; use Prev/Next or Export all shots.`;
            }
          });
        });
      }

      function installCameraBatchUiV78() {
        if ($('cameraShotExportAll')) return;
        const row = $('cameraShotDelete')?.parentElement;
        if (!row) return;

        const button = document.createElement('button');
        button.id = 'cameraShotExportAll';
        button.type = 'button';
        button.className = 'primary';
        button.textContent = 'Export all shots';
        button.title = 'Export every named camera shot as PNG files in one ZIP using the current PNG format and background settings.';
        button.addEventListener('click', exportAllCameraShotsV78);
        row.appendChild(button);
      }

      queueMicrotask(() => {
        installCameraBatchUiV78();

        // app-parts/25.js performs architecture confirmation first. This later
        // listener runs afterwards and moves directly to the first authored shot.
        $('confirmWallReview')?.addEventListener('click', () => {
          if (project.settings?.architectureReviewConfirmed === true) {
            applyFirstCameraShotAfterArchitectureV78();
          }
        });

        const buildSceneBeforeCameraBatchV78 = buildScene;
        buildScene = function() {
          const result = buildSceneBeforeCameraBatchV78();
          installCameraBatchUiV78();
          return result;
        };
      });
