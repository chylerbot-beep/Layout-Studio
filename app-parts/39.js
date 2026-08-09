      // -----------------------------------------------------------------------------
      // Camera shots: named, predetermined camera views authored either by the
      // Layout Studio Planner GPT (project.cameraShots, positions/targets in mm) or
      // captured locally by the user. Lets a shot list replace fully manual framing.
      // Additive only: absent or empty project.cameraShots degrades to prior behaviour.
      // -----------------------------------------------------------------------------

      let activeCameraShotIdV70 = null;

      function ensureCameraShotsV70() {
        const source = Array.isArray(project.cameraShots) ? project.cameraShots : [];
        const seen = new Set();
        project.cameraShots = source
          .filter(shot => shot && typeof shot === 'object')
          .map((shot, index) => {
            const positionMm = Array.isArray(shot.positionMm) && shot.positionMm.length === 3
              ? shot.positionMm.map(Number) : null;
            const targetMm = Array.isArray(shot.targetMm) && shot.targetMm.length === 3
              ? shot.targetMm.map(Number) : null;
            if (!positionMm || !targetMm) return null;
            if (positionMm.some(v => !Number.isFinite(v)) || targetMm.some(v => !Number.isFinite(v))) return null;
            let id = typeof shot.id === 'string' && shot.id.trim() ? shot.id.trim() : `shot-${index + 1}`;
            while (seen.has(id)) id = `${id}-${index + 1}`;
            seen.add(id);
            return {
              id,
              label: typeof shot.label === 'string' && shot.label.trim() ? shot.label.trim() : id,
              roomId: typeof shot.roomId === 'string' && shot.roomId.trim() ? shot.roomId.trim() : null,
              type: shot.type === 'bird' || shot.type === 'top' ? shot.type : 'eye',
              positionMm,
              targetMm,
              fov: Number.isFinite(+shot.fov) ? Math.max(20, Math.min(100, +shot.fov)) : 50,
              notes: typeof shot.notes === 'string' ? shot.notes : ''
            };
          })
          .filter(Boolean);
        return project.cameraShots;
      }

      function safeShotSlugV70(text) {
        return String(text || 'shot').toLowerCase().trim()
          .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'shot';
      }

      function applyCameraShotV70(shot) {
        if (!shot) return;
        const isEye = shot.type === 'eye';
        camera.up.set(0, 1, 0);
        camera.fov = shot.fov || 50;
        camera.updateProjectionMatrix();
        camera.position.set(mm(shot.positionMm[0]), mm(shot.positionMm[1]), mm(shot.positionMm[2]));
        orbit.target.set(mm(shot.targetMm[0]), mm(shot.targetMm[1]), mm(shot.targetMm[2]));
        if (isEye) {
          if (typeof applyEyeHorizontalLockV62 === 'function') applyEyeHorizontalLockV62();
          const heightMm = normaliseEyeLevelHeightV63(shot.positionMm[1], 1300);
          project.settings = project.settings || {};
          project.settings.eyeLevelHeightMm = heightMm;
          if ($('cameraHeight')) $('cameraHeight').value = heightMm;
        } else if (typeof releaseEyeHorizontalLockV62 === 'function') {
          releaseEyeHorizontalLockV62();
        }
        orbit.enabled = true; orbit.enableRotate = true; orbit.enablePan = true; orbit.enableZoom = true;
        orbit.update();
        ['viewTop', 'viewBird', 'viewEye'].forEach(id => $(id) && $(id).classList.remove('active'));
        if ($('fovField')) $('fovField').value = Math.round(camera.fov);
        if ($('depthField')) $('depthField').value = Math.round(camera.fov);
        if (typeof scheduleCameraCutaway === 'function') scheduleCameraCutaway();
        if (typeof scheduleCameraFurnitureVisibilityV42 === 'function') scheduleCameraFurnitureVisibilityV42();
        if (typeof scheduleEyeLabelCleanup === 'function') scheduleEyeLabelCleanup();
        if (typeof syncFurnitureLabelsV60 === 'function') syncFurnitureLabelsV60();
        activeCameraShotIdV70 = shot.id;
        syncCameraShotControlsV70();
      }

      function stepCameraShotV70(delta) {
        const shots = ensureCameraShotsV70();
        if (!shots.length) return;
        let index = shots.findIndex(shot => shot.id === activeCameraShotIdV70);
        index = index < 0 ? 0 : (index + delta + shots.length) % shots.length;
        applyCameraShotV70(shots[index]);
      }

      function captureCameraShotV70() {
        ensureCameraShotsV70();
        pushHistory('add camera shot');
        const isEyeLevel = Math.abs(camera.position.y - orbit.target.y) < 0.01;
        const shot = {
          id: 'shot-' + Date.now(),
          label: `Custom view ${project.cameraShots.length + 1}`,
          roomId: null,
          type: isEyeLevel ? 'eye' : 'bird',
          positionMm: [camera.position.x, camera.position.y, camera.position.z].map(v => Math.round(v / MM)),
          targetMm: [orbit.target.x, orbit.target.y, orbit.target.z].map(v => Math.round(v / MM)),
          fov: Math.round(camera.fov),
          notes: ''
        };
        project.cameraShots.push(shot);
        activeCameraShotIdV70 = shot.id;
        syncCameraShotControlsV70();
      }

      function deleteCameraShotV70() {
        if (!activeCameraShotIdV70) return;
        pushHistory('delete camera shot');
        project.cameraShots = (project.cameraShots || []).filter(shot => shot.id !== activeCameraShotIdV70);
        activeCameraShotIdV70 = null;
        syncCameraShotControlsV70();
      }

      function syncCameraShotControlsV70() {
        const select = $('cameraShotSelect');
        if (!select) return;
        const shots = Array.isArray(project.cameraShots) ? project.cameraShots : [];
        select.innerHTML = '';
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = shots.length ? 'Choose a shot…' : 'No preset shots on this project';
        select.appendChild(placeholder);
        shots.forEach(shot => {
          const option = document.createElement('option');
          option.value = shot.id;
          option.textContent = shot.roomId ? `${shot.label} (${shot.roomId})` : shot.label;
          select.appendChild(option);
        });
        const stillExists = shots.some(shot => shot.id === activeCameraShotIdV70);
        if (!stillExists) activeCameraShotIdV70 = null;
        select.value = activeCameraShotIdV70 || '';

        const note = $('cameraShotNote');
        if (note) {
          const active = shots.find(shot => shot.id === activeCameraShotIdV70);
          if (active && active.notes) note.textContent = active.notes;
          else if (shots.length) note.textContent = `${shots.length} preset shot${shots.length === 1 ? '' : 's'} on this project. Selecting one sets position, target, lens and height together.`;
          else note.textContent = 'No preset camera shots on this project yet. Use “Save current as shot” to build your own list, or generate shots in the planner GPT.';
        }
        if ($('cameraShotPrev')) $('cameraShotPrev').disabled = shots.length < 2;
        if ($('cameraShotNext')) $('cameraShotNext').disabled = shots.length < 2;
        if ($('cameraShotDelete')) $('cameraShotDelete').disabled = !activeCameraShotIdV70;
      }

      (function buildCameraShotUIV70() {
        const cameraSectionV70 = $('fovField')?.closest('.section');
        if (!cameraSectionV70 || $('cameraShotSelect')) return;

        const fieldRow = document.createElement('div');
        fieldRow.className = 'field-grid';
        fieldRow.style.marginTop = '10px';
        fieldRow.innerHTML = `<label class="wide">Camera shot<select id="cameraShotSelect"><option value="">No preset shots</option></select></label>`;
        cameraSectionV70.appendChild(fieldRow);

        const buttonRow = document.createElement('div');
        buttonRow.className = 'button-row';
        buttonRow.style.marginTop = '8px';
        buttonRow.innerHTML = `
          <button id="cameraShotPrev" type="button">◀ Prev</button>
          <button id="cameraShotNext" type="button">Next ▶</button>
          <button id="cameraShotCapture" type="button">Save current as shot</button>
          <button id="cameraShotDelete" type="button" class="danger">Delete shot</button>`;
        cameraSectionV70.appendChild(buttonRow);

        const note = document.createElement('p');
        note.className = 'small';
        note.id = 'cameraShotNote';
        note.style.marginTop = '6px';
        note.textContent = 'No preset camera shots on this project yet.';
        cameraSectionV70.appendChild(note);

        $('cameraShotSelect').addEventListener('change', event => {
          const shot = (project.cameraShots || []).find(s => s.id === event.target.value);
          if (shot) applyCameraShotV70(shot);
          else { activeCameraShotIdV70 = null; syncCameraShotControlsV70(); }
        });
        $('cameraShotPrev').addEventListener('click', () => stepCameraShotV70(-1));
        $('cameraShotNext').addEventListener('click', () => stepCameraShotV70(1));
        $('cameraShotCapture').addEventListener('click', captureCameraShotV70);
        $('cameraShotDelete').addEventListener('click', deleteCameraShotV70);
      })();

      // Wire into the existing normalize/build/export chains so shots survive load,
      // undo/redo, ZIP import and PNG export filenames, matching how app-parts/28.js
      // hooks the same lifecycle points for camera-furniture visibility.
      const normalizeProjectBeforeCameraShotsV70 = normalizeProject;
      normalizeProject = function () { normalizeProjectBeforeCameraShotsV70(); ensureCameraShotsV70(); };
      if (typeof normalizeProjectV27 === 'function') {
        const normalizeProjectV27BeforeCameraShotsV70 = normalizeProjectV27;
        normalizeProjectV27 = function () { normalizeProjectV27BeforeCameraShotsV70(); ensureCameraShotsV70(); };
      }
      const buildSceneBeforeCameraShotsV70 = buildScene;
      buildScene = function () { buildSceneBeforeCameraShotsV70(); ensureCameraShotsV70(); syncCameraShotControlsV70(); };

      if (typeof projectDownloadName === 'function') {
        const projectDownloadNameBeforeCameraShotsV70 = projectDownloadName;
        projectDownloadName = function (extension) {
          const base = projectDownloadNameBeforeCameraShotsV70(extension);
          if (extension !== 'png' || !activeCameraShotIdV70) return base;
          const activeShot = (project.cameraShots || []).find(shot => shot.id === activeCameraShotIdV70);
          if (!activeShot) return base;
          return base.replace(/\.png$/i, `-${safeShotSlugV70(activeShot.label)}.png`);
        };
      }

      ensureCameraShotsV70();
      syncCameraShotControlsV70();
