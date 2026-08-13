      // -----------------------------------------------------------------------------
      // Layout Planner V3 camera composition.
      //
      // The planner authors exactly 12 design-aware candidate cameras. Layout Studio
      // evaluates their real projected geometry with its own wall/furniture hiding,
      // renders one small local preview per candidate, and keeps exactly the best 8.
      // No network service or AI is used.
      // -----------------------------------------------------------------------------

      const cameraCompositionVersionV90 = '20260814-layout-planner-v3-camera-composition-v90';
      const cameraCandidateCountV90 = 12;
      const cameraFinalShotCountV90 = 8;
      let cameraCompositionBusyV90 = false;
      let cameraCompositionPreviewTargetV90 = null;

      function clampCameraCompositionV90(value, min, max, fallback) {
        const number = +value;
        return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
      }

      function normaliseCameraRangeV90(source, defaults) {
        const range = source && typeof source === 'object' ? source : {};
        let minMm = clampCameraCompositionV90(range.minMm, 100, 6000, defaults.minMm);
        let maxMm = clampCameraCompositionV90(range.maxMm, 100, 6000, defaults.maxMm);
        if (minMm > maxMm) [minMm, maxMm] = [maxMm, minMm];
        const preferredMm = clampCameraCompositionV90(range.preferredMm, minMm, maxMm, defaults.preferredMm);
        return { preferredMm, minMm, maxMm };
      }

      function normaliseCameraCandidateV90(candidate, index) {
        if (!candidate || typeof candidate !== 'object') return null;
        const positionMm = Array.isArray(candidate.positionMm) && candidate.positionMm.length === 3
          ? candidate.positionMm.map(Number) : null;
        const targetMm = Array.isArray(candidate.targetMm) && candidate.targetMm.length === 3
          ? candidate.targetMm.map(Number) : null;
        if (!positionMm || !targetMm || [...positionMm, ...targetMm].some(value => !Number.isFinite(value))) return null;
        const id = typeof candidate.id === 'string' && candidate.id.trim()
          ? candidate.id.trim()
          : `camera-candidate-${String(index + 1).padStart(2, '0')}`;
        return {
          id,
          label: typeof candidate.label === 'string' && candidate.label.trim() ? candidate.label.trim() : `Candidate ${index + 1}`,
          roomId: typeof candidate.roomId === 'string' && candidate.roomId.trim() ? candidate.roomId.trim() : null,
          type: candidate.type === 'bird' || candidate.type === 'top' ? candidate.type : 'eye',
          role: ['hero', 'layered', 'architectural', 'transition', 'detail'].includes(candidate.role) ? candidate.role : 'hero',
          positionMm,
          targetMm,
          fov: clampCameraCompositionV90(candidate.fov, 20, 100, 40),
          heroObjectIds: Array.isArray(candidate.heroObjectIds) ? [...new Set(candidate.heroObjectIds.filter(Boolean))] : [],
          notes: typeof candidate.notes === 'string' ? candidate.notes : '',
          allowCameraInHiddenWall: candidate.allowCameraInHiddenWall !== false,
          allowCameraInHiddenFurniture: candidate.allowCameraInHiddenFurniture !== false,
          renderSpec: candidate.renderSpec && typeof candidate.renderSpec === 'object'
            ? JSON.parse(JSON.stringify(candidate.renderSpec))
            : null
        };
      }

      function ensureCameraPlanV90() {
        if (!project.cameraPlan || typeof project.cameraPlan !== 'object') return null;
        const plan = project.cameraPlan;
        plan.version = 3;
        plan.candidateCount = cameraCandidateCountV90;
        plan.finalShotCount = cameraFinalShotCountV90;
        plan.compositionProfile = typeof plan.compositionProfile === 'string' && plan.compositionProfile
          ? plan.compositionProfile
          : 'editorial-residential';
        plan.visibility = plan.visibility && typeof plan.visibility === 'object' ? plan.visibility : {};
        plan.visibility.wall = normaliseCameraRangeV90(plan.visibility.wall, {
          preferredMm: 3000, minMm: 1800, maxMm: 4500
        });
        plan.visibility.furniture = normaliseCameraRangeV90(plan.visibility.furniture, {
          preferredMm: 1500, minMm: 750, maxMm: 2500
        });
        plan.candidates = (Array.isArray(plan.candidates) ? plan.candidates : [])
          .map(normaliseCameraCandidateV90)
          .filter(Boolean);
        plan.results = Array.isArray(plan.results) ? plan.results : [];
        plan.status = ['candidates', 'ranked'].includes(plan.status) ? plan.status : 'candidates';
        return plan;
      }

      function cameraCompositionDepthOptionsV90(range) {
        return [...new Set([
          Math.round(range.minMm),
          Math.round((range.minMm + range.preferredMm) / 2),
          Math.round(range.preferredMm),
          Math.round((range.preferredMm + range.maxMm) / 2),
          Math.round(range.maxMm)
        ])].sort((a, b) => a - b);
      }

      function applyCandidateCameraV90(candidate) {
        camera.up.set(0, 1, 0);
        camera.fov = candidate.fov;
        camera.position.set(mm(candidate.positionMm[0]), mm(candidate.positionMm[1]), mm(candidate.positionMm[2]));
        orbit.target.set(mm(candidate.targetMm[0]), mm(candidate.targetMm[1]), mm(candidate.targetMm[2]));
        camera.updateProjectionMatrix();
        orbit.update();
        camera.updateMatrixWorld(true);
      }

      function applyCandidateVisibilityV90(wallDepthMm, furnitureDepthMm) {
        const wall = ensureCameraCutawaySettings();
        wall.enabled = true;
        wall.style = 'hide';
        wall.opacity = 0;
        wall.depth = wallDepthMm;
        wall.hiddenWallIds = [];
        const furniture = ensureCameraFurnitureSettingsV42();
        furniture.enabled = true;
        furniture.depth = furnitureDepthMm;
        furniture.hiddenIds = [];
        furniture.shownIds = [];
        applyCameraCutaway();
        applyCameraFurnitureVisibilityV42();
      }

      function projectedMeshRectV90(mesh) {
        if (!mesh?.visible) return null;
        const box = new THREE.Box3().setFromObject(mesh);
        if (box.isEmpty()) return null;
        const points = [];
        for (const x of [box.min.x, box.max.x]) {
          for (const y of [box.min.y, box.max.y]) {
            for (const z of [box.min.z, box.max.z]) points.push(new THREE.Vector3(x, y, z));
          }
        }
        const visiblePoints = points.map(point => {
          const view = point.clone().applyMatrix4(camera.matrixWorldInverse);
          if (view.z >= -camera.near) return null;
          const ndc = point.clone().project(camera);
          return Number.isFinite(ndc.x) && Number.isFinite(ndc.y) ? ndc : null;
        }).filter(Boolean);
        if (!visiblePoints.length) return null;
        const raw = {
          minX: Math.min(...visiblePoints.map(point => point.x)),
          maxX: Math.max(...visiblePoints.map(point => point.x)),
          minY: Math.min(...visiblePoints.map(point => point.y)),
          maxY: Math.max(...visiblePoints.map(point => point.y))
        };
        const clipped = {
          minX: Math.max(-1, raw.minX), maxX: Math.min(1, raw.maxX),
          minY: Math.max(-1, raw.minY), maxY: Math.min(1, raw.maxY)
        };
        const rawArea = Math.max(0.0001, (raw.maxX - raw.minX) * (raw.maxY - raw.minY));
        const clippedArea = Math.max(0, clipped.maxX - clipped.minX) * Math.max(0, clipped.maxY - clipped.minY);
        if (clippedArea <= 0) return null;
        const centre = box.getCenter(new THREE.Vector3());
        return {
          id: mesh.userData?.id,
          area: clippedArea / 4,
          cropRatio: Math.max(0, Math.min(1, clippedArea / rawArea)),
          centreX: (clipped.minX + clipped.maxX) / 2,
          centreY: (clipped.minY + clipped.maxY) / 2,
          depth: centre.distanceTo(camera.position),
          box
        };
      }

      function pointInsideWallV90(positionMm, wall) {
        const metrics = wallMetrics(wall);
        const px = positionMm[0] - metrics.x1;
        const py = positionMm[2] - metrics.y1;
        const along = Math.max(0, Math.min(metrics.length, px * metrics.ux + py * metrics.uy));
        const closestX = metrics.x1 + metrics.ux * along;
        const closestY = metrics.y1 + metrics.uy * along;
        return Math.hypot(positionMm[0] - closestX, positionMm[2] - closestY) <= Math.max(50, (+wall.thickness || 100) / 2);
      }

      function scoreCandidateGeometryV90(candidate, wallDepthMm, furnitureDepthMm) {
        applyCandidateCameraV90(candidate);
        applyCandidateVisibilityV90(wallDepthMm, furnitureDepthMm);
        const rects = furnitureGroup.children.map(projectedMeshRectV90).filter(Boolean);
        const rectById = new Map(rects.map(rect => [rect.id, rect]));
        let heroRects = candidate.heroObjectIds.map(id => rectById.get(id)).filter(Boolean);
        if (!heroRects.length) {
          const room = (project.rooms || []).find(item => item.id === candidate.roomId);
          if (room) {
            const roomIds = new Set((project.furniture || []).filter(item => {
              if (item.placement?.roomId === room.id) return true;
              const centreX = +item.x + +item.w / 2;
              const centreY = +item.y + +item.d / 2;
              return centreX >= room.x && centreX <= room.x + room.w && centreY >= room.y && centreY <= room.y + room.d;
            }).map(item => item.id));
            heroRects = rects.filter(rect => roomIds.has(rect.id)).sort((a, b) => b.area - a.area).slice(0, 3);
          }
        }
        if (!heroRects.length) heroRects = [...rects].sort((a, b) => b.area - a.area).slice(0, 2);

        const heroVisibleRatio = candidate.heroObjectIds.length
          ? heroRects.length / candidate.heroObjectIds.length
          : heroRects.length ? 1 : 0;
        const heroArea = heroRects.reduce((sum, rect) => sum + Math.min(.28, rect.area), 0);
        const heroCrop = heroRects.length
          ? heroRects.reduce((sum, rect) => sum + rect.cropRatio, 0) / heroRects.length
          : 0;
        const heroCentreX = heroRects.length
          ? heroRects.reduce((sum, rect) => sum + rect.centreX * rect.area, 0) / Math.max(.001, heroRects.reduce((sum, rect) => sum + rect.area, 0))
          : 0;
        const heroCentreY = heroRects.length
          ? heroRects.reduce((sum, rect) => sum + rect.centreY * rect.area, 0) / Math.max(.001, heroRects.reduce((sum, rect) => sum + rect.area, 0))
          : 0;
        const subjectScore = Math.min(24, heroVisibleRatio * 14 + Math.min(1, heroArea / .18) * 10);
        const cropScore = 10 * heroCrop;

        const depths = rects.map(rect => rect.depth).sort((a, b) => a - b);
        const depthSpread = depths.length > 1 ? depths[depths.length - 1] - depths[0] : 0;
        const layerCount = new Set(depths.map(depth => Math.min(2, Math.floor(depth / 2.2)))).size;
        const depthScore = Math.min(14, Math.min(1, depthSpread / 5) * 8 + Math.min(1, layerCount / 3) * 6);

        const balanceDistance = Math.hypot(heroCentreX * .8, heroCentreY * .45);
        const balanceScore = Math.max(0, 12 * (1 - Math.min(1, balanceDistance)));
        const occupied = Math.min(1, rects.reduce((sum, rect) => sum + Math.min(.22, rect.area), 0));
        const negativeSpaceScore = Math.max(0, 10 - Math.abs(occupied - .42) * 24);

        const isLevel = Math.abs(candidate.positionMm[1] - candidate.targetMm[1]) <= 30;
        const heightScore = candidate.type !== 'eye'
          ? 2
          : Math.max(0, 5 - Math.abs(candidate.positionMm[1] - 1500) / 150);
        const fovScore = Math.max(0, 5 - Math.abs(candidate.fov - 40) / 2.5);
        const levelScore = candidate.type !== 'eye' || isLevel ? 4 : 0;
        const cameraScore = heightScore + fovScore + levelScore;

        const room = (project.rooms || []).find(item => item.id === candidate.roomId);
        const targetInsideRoom = room
          ? candidate.targetMm[0] >= room.x && candidate.targetMm[0] <= room.x + room.w &&
            candidate.targetMm[2] >= room.y && candidate.targetMm[2] <= room.y + room.d
          : true;
        const storyScore = (targetInsideRoom ? 4 : 0) + (rects.length >= 3 ? 4 : rects.length * 1.2);

        const directionX = candidate.targetMm[0] - candidate.positionMm[0];
        const directionY = candidate.targetMm[2] - candidate.positionMm[2];
        const angle = Math.abs(Math.atan2(directionY, directionX) * 180 / Math.PI) % 90;
        const diagonal = Math.min(angle, 90 - angle);
        const preferredAngle = candidate.role === 'architectural' ? 8 : 28;
        const lineScore = Math.max(0, 8 - Math.abs(diagonal - preferredAngle) / 4);

        const hiddenWalls = typeof cameraCutawayWallIds !== 'undefined' ? [...cameraCutawayWallIds] : [];
        const hiddenFurniture = typeof hiddenFurnitureIdsV42 === 'function' ? [...hiddenFurnitureIdsV42()] : [];
        let penalty = hiddenWalls.length * .65 + hiddenFurniture.length * 1.8;
        const containingWalls = (project.walls || []).filter(wall => pointInsideWallV90(candidate.positionMm, wall));
        containingWalls.forEach(wall => {
          const hidden = hiddenWalls.includes(wall.id);
          penalty += hidden && candidate.allowCameraInHiddenWall ? 2 : 28;
        });
        const containingFurniture = furnitureGroup.children.filter(mesh => {
          const box = new THREE.Box3().setFromObject(mesh);
          return camera.position.x >= box.min.x && camera.position.x <= box.max.x &&
            camera.position.z >= box.min.z && camera.position.z <= box.max.z;
        });
        containingFurniture.forEach(mesh => {
          const hidden = hiddenFurniture.includes(mesh.userData?.id);
          penalty += hidden && candidate.allowCameraInHiddenFurniture ? 5 : 32;
        });
        if (!rects.length) penalty += 30;

        const rawScore = subjectScore + cropScore + depthScore + balanceScore + negativeSpaceScore + cameraScore + storyScore + lineScore - penalty;
        return {
          score: Math.max(0, Math.min(100, rawScore)),
          wallDepthMm,
          furnitureDepthMm,
          hiddenWallIds: hiddenWalls,
          hiddenFurnitureIds: hiddenFurniture,
          breakdown: {
            subject: subjectScore,
            crop: cropScore,
            depth: depthScore,
            balance: balanceScore,
            negativeSpace: negativeSpaceScore,
            camera: cameraScore,
            story: storyScore,
            leadingLines: lineScore,
            penalty
          }
        };
      }

      function scoreLocalPreviewV90() {
        const width = 240, height = 150;
        if (!cameraCompositionPreviewTargetV90) {
          cameraCompositionPreviewTargetV90 = new THREE.WebGLRenderTarget(width, height, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat
          });
        }
        const previousTarget = renderer.getRenderTarget();
        const previousAspect = camera.aspect;
        const pixels = new Uint8Array(width * height * 4);
        try {
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          renderer.setRenderTarget(cameraCompositionPreviewTargetV90);
          renderer.render(scene, camera);
          renderer.readRenderTargetPixels(cameraCompositionPreviewTargetV90, 0, 0, width, height, pixels);
        } finally {
          renderer.setRenderTarget(previousTarget);
          camera.aspect = previousAspect;
          camera.updateProjectionMatrix();
        }
        let left = 0, right = 0, edge = 0, samples = 0;
        const luminanceAt = index => pixels[index] * .2126 + pixels[index + 1] * .7152 + pixels[index + 2] * .0722;
        for (let y = 1; y < height; y += 3) {
          for (let x = 1; x < width; x += 3) {
            const index = (y * width + x) * 4;
            const luminance = luminanceAt(index);
            if (x < width / 2) left += luminance; else right += luminance;
            edge += Math.abs(luminance - luminanceAt(index - 4)) + Math.abs(luminance - luminanceAt(index - width * 4));
            samples += 1;
          }
        }
        const halfSamples = Math.max(1, samples / 2);
        const balance = 1 - Math.min(1, Math.abs(left - right) / Math.max(1, (left + right) * .55));
        const edgeEnergy = Math.min(1, edge / Math.max(1, samples * 46));
        return Math.max(0, Math.min(10, balance * 4 + edgeEnergy * 6));
      }

      function candidateSimilarityPenaltyV90(candidate, selected) {
        if (!selected.length) return 0;
        const candidateDirection = new THREE.Vector2(
          candidate.targetMm[0] - candidate.positionMm[0],
          candidate.targetMm[2] - candidate.positionMm[2]
        ).normalize();
        return Math.max(...selected.map(entry => {
          const other = entry.candidate;
          const distance = Math.hypot(
            candidate.positionMm[0] - other.positionMm[0],
            candidate.positionMm[2] - other.positionMm[2]
          );
          const otherDirection = new THREE.Vector2(
            other.targetMm[0] - other.positionMm[0],
            other.targetMm[2] - other.positionMm[2]
          ).normalize();
          const headingSimilarity = Math.max(-1, Math.min(1, candidateDirection.dot(otherDirection)));
          const angle = Math.acos(headingSimilarity) * 180 / Math.PI;
          let penalty = 0;
          if (distance < 1600 && angle < 18) penalty += 15;
          else if (distance < 2600 && angle < 12) penalty += 8;
          if (candidate.roomId && candidate.roomId === other.roomId && candidate.role === other.role) penalty += 3;
          return penalty;
        }));
      }

      function renderSpecForCandidateV90(candidate) {
        const source = candidate.renderSpec || (project.design?.shotRenderSpecs || []).find(spec => spec.shotId === candidate.id);
        if (source) return { ...JSON.parse(JSON.stringify(source)), shotId: candidate.id };
        return {
          id: `render-${candidate.id}`,
          shotId: candidate.id,
          intent: 'Produce a natural editorial interior image while preserving the exact approved composition.',
          mustInclude: candidate.heroObjectIds.length
            ? [`Keep the mapped hero objects visible: ${candidate.heroObjectIds.join(', ')}.`]
            : ['Keep every object visible in the Layout Studio camera image.'],
          allowedInterpretation: ['Resolve surface texture only within the approved style board.'],
          negativeConstraints: ['Do not add, remove, move or resize architecture, furniture or styling objects.'],
          lockedInputs: ['Use the Layout Studio PNG as the spatial and compositional source of truth.'],
          policy: { canModifyLayout: false, canModifyDesign: false, canAddObjects: false, canSourceProducts: false }
        };
      }

      async function rankCameraPlanV90() {
        if (cameraCompositionBusyV90) return;
        const plan = ensureCameraPlanV90();
        const status = $('cameraCompositionStatusV90');
        if (!plan || plan.candidates.length !== cameraCandidateCountV90) {
          const count = plan?.candidates.length || 0;
          const message = `Planner V3 requires exactly ${cameraCandidateCountV90} valid camera candidates; this project has ${count}.`;
          if (status) status.textContent = message;
          alert(message);
          return;
        }

        const duplicateIds = plan.candidates.filter((candidate, index, all) => all.findIndex(item => item.id === candidate.id) !== index);
        if (duplicateIds.length) {
          alert('Planner V3 camera candidate IDs must be unique.');
          return;
        }

        cameraCompositionBusyV90 = true;
        const button = $('cameraCompositionRunV90');
        const originalText = button?.textContent || 'Rank 12 → Keep best 8';
        if (button) button.disabled = true;
        pushHistory('rank Planner V3 camera candidates');
        const cameraSnapshot = typeof snapshotCameraStateV78 === 'function' ? snapshotCameraStateV78() : null;
        const settingsSnapshot = JSON.stringify({
          cameraCutaway: project.settings?.cameraCutaway || null,
          cameraFurniture: project.settings?.cameraFurniture || null
        });

        try {
          const wallOptions = cameraCompositionDepthOptionsV90(plan.visibility.wall);
          const furnitureOptions = cameraCompositionDepthOptionsV90(plan.visibility.furniture);
          const evaluated = [];
          for (let index = 0; index < plan.candidates.length; index += 1) {
            const candidate = plan.candidates[index];
            if (button) button.textContent = `Ranking ${index + 1}/${cameraCandidateCountV90}…`;
            if (status) status.textContent = `Evaluating ${candidate.label}…`;
            let best = null;
            wallOptions.forEach(wallDepthMm => furnitureOptions.forEach(furnitureDepthMm => {
              const result = scoreCandidateGeometryV90(candidate, wallDepthMm, furnitureDepthMm);
              if (!best || result.score > best.score || (result.score === best.score && (
                Math.abs(wallDepthMm - plan.visibility.wall.preferredMm) + Math.abs(furnitureDepthMm - plan.visibility.furniture.preferredMm)
              ) < (
                Math.abs(best.wallDepthMm - plan.visibility.wall.preferredMm) + Math.abs(best.furnitureDepthMm - plan.visibility.furniture.preferredMm)
              ))) best = result;
            }));
            applyCandidateCameraV90(candidate);
            applyCandidateVisibilityV90(best.wallDepthMm, best.furnitureDepthMm);
            best.preview = scoreLocalPreviewV90();
            best.score = Math.max(0, Math.min(100, best.score * .9 + best.preview));
            evaluated.push({ candidate, ...best });
            await new Promise(resolve => requestAnimationFrame(resolve));
          }

          const selected = [];
          const remaining = [...evaluated];
          while (selected.length < cameraFinalShotCountV90 && remaining.length) {
            remaining.forEach(entry => {
              entry.selectionScore = entry.score - candidateSimilarityPenaltyV90(entry.candidate, selected);
            });
            remaining.sort((a, b) => b.selectionScore - a.selectionScore || b.score - a.score || a.candidate.id.localeCompare(b.candidate.id));
            selected.push(remaining.shift());
          }

          project.cameraShots = selected.map((entry, index) => ({
            id: entry.candidate.id,
            label: entry.candidate.label,
            roomId: entry.candidate.roomId,
            type: entry.candidate.type,
            role: entry.candidate.role,
            positionMm: [...entry.candidate.positionMm],
            targetMm: [...entry.candidate.targetMm],
            fov: entry.candidate.fov,
            notes: entry.candidate.notes,
            heroObjectIds: [...entry.candidate.heroObjectIds],
            visibility: {
              wall: { enabled: true, depthMm: entry.wallDepthMm, hiddenWallIds: [...entry.hiddenWallIds] },
              furniture: { enabled: true, depthMm: entry.furnitureDepthMm, hiddenIds: [...entry.hiddenFurnitureIds], shownIds: [] }
            },
            compositionScore: Math.round(entry.selectionScore * 10) / 10,
            compositionRank: index + 1,
            locked: false,
            plannerCandidateId: entry.candidate.id
          }));
          ensureCameraShotsV70();
          plan.results = selected.map((entry, index) => ({
            candidateId: entry.candidate.id,
            rank: index + 1,
            score: Math.round(entry.selectionScore * 10) / 10,
            baseScore: Math.round(entry.score * 10) / 10,
            wallHideDistanceMm: entry.wallDepthMm,
            furnitureHideDistanceMm: entry.furnitureDepthMm,
            hiddenWallIds: [...entry.hiddenWallIds],
            hiddenFurnitureIds: [...entry.hiddenFurnitureIds],
            breakdown: Object.fromEntries(Object.entries(entry.breakdown).map(([key, value]) => [key, Math.round(value * 10) / 10]))
          }));
          plan.status = 'ranked';
          plan.rankedAt = new Date().toISOString();
          plan.rankingVersion = cameraCompositionVersionV90;
          project.design = project.design || {};
          project.design.shotRenderSpecs = selected.map(entry => renderSpecForCandidateV90(entry.candidate));

          project.workflow = project.workflow || {};
          project.workflow.approvals = project.workflow.approvals || {};
          project.workflow.approvals.design = project.workflow.approvals.design || {};
          project.workflow.approvals.design.status = 'changes-required';
          project.workflow.approvals.design.approvedAt = null;
          project.workflow.approvals.design.fingerprint = null;
          project.workflow.locks = project.workflow.locks || {};
          project.workflow.locks.design = false;
          project.workflow.locks.cameraShots = false;
          project.workflow.stage = 'design-development';

          syncCameraShotControlsV70();
          applyCameraShotV70(project.cameraShots[0]);
          if (status) status.textContent = `Complete: ${cameraCandidateCountV90} candidates ranked locally; the best ${cameraFinalShotCountV90} are now final shots. Review and lock them at Gate 2.`;
          validate();
        } catch (error) {
          console.error(error);
          const saved = JSON.parse(settingsSnapshot);
          project.settings = project.settings || {};
          if (saved.cameraCutaway) project.settings.cameraCutaway = saved.cameraCutaway;
          if (saved.cameraFurniture) project.settings.cameraFurniture = saved.cameraFurniture;
          if (cameraSnapshot && typeof restoreCameraStateV78 === 'function') restoreCameraStateV78(cameraSnapshot);
          const message = `Camera ranking failed: ${error.message || error}`;
          if (status) status.textContent = message;
          alert(message);
        } finally {
          cameraCompositionBusyV90 = false;
          if (button) {
            button.disabled = false;
            button.textContent = originalText;
          }
          syncCameraCompositionUiV90();
        }
      }

      function syncCameraCompositionUiV90() {
        const plan = ensureCameraPlanV90();
        const button = $('cameraCompositionRunV90');
        const status = $('cameraCompositionStatusV90');
        if (!button || !status) return;
        const count = plan?.candidates.length || 0;
        button.disabled = cameraCompositionBusyV90 || count !== cameraCandidateCountV90;
        if (!cameraCompositionBusyV90) {
          if (!plan) status.textContent = 'Import a Layout Planner V3 project to rank its camera candidates.';
          else if (count !== cameraCandidateCountV90) status.textContent = `Planner V3 requires exactly ${cameraCandidateCountV90} candidates; found ${count}.`;
          else if (plan.status === 'ranked' && project.cameraShots?.length === cameraFinalShotCountV90) {
            status.textContent = `${cameraCandidateCountV90} candidates ranked · best ${cameraFinalShotCountV90} saved · no AI or API used.`;
          } else status.textContent = `${cameraCandidateCountV90} candidates ready · Studio will keep the best ${cameraFinalShotCountV90}.`;
        }
        const fields = {
          cameraWallPreferredV90: plan?.visibility.wall.preferredMm,
          cameraWallMinV90: plan?.visibility.wall.minMm,
          cameraWallMaxV90: plan?.visibility.wall.maxMm,
          cameraFurniturePreferredV90: plan?.visibility.furniture.preferredMm,
          cameraFurnitureMinV90: plan?.visibility.furniture.minMm,
          cameraFurnitureMaxV90: plan?.visibility.furniture.maxMm
        };
        Object.entries(fields).forEach(([id, value]) => {
          const input = $(id);
          if (input && value !== undefined && document.activeElement !== input) input.value = Math.round(value);
          if (input) input.disabled = !plan || cameraCompositionBusyV90;
        });
      }

      function updateCameraCompositionRangeV90() {
        const plan = ensureCameraPlanV90();
        if (!plan) return;
        pushHistory('change camera composition visibility range');
        plan.visibility.wall = normaliseCameraRangeV90({
          preferredMm: $('cameraWallPreferredV90').value,
          minMm: $('cameraWallMinV90').value,
          maxMm: $('cameraWallMaxV90').value
        }, { preferredMm: 3000, minMm: 1800, maxMm: 4500 });
        plan.visibility.furniture = normaliseCameraRangeV90({
          preferredMm: $('cameraFurniturePreferredV90').value,
          minMm: $('cameraFurnitureMinV90').value,
          maxMm: $('cameraFurnitureMaxV90').value
        }, { preferredMm: 1500, minMm: 750, maxMm: 2500 });
        plan.status = 'candidates';
        plan.results = [];
        syncCameraCompositionUiV90();
      }

      (function buildCameraCompositionUiV90() {
        const cameraSection = $('fovField')?.closest('.section');
        if (!cameraSection || $('cameraCompositionControlsV90')) return;
        const controls = document.createElement('div');
        controls.id = 'cameraCompositionControlsV90';
        controls.innerHTML = `
          <h2>Planner V3 composition</h2>
          <p class="small">Exactly 12 planned candidates are evaluated locally. Layout Studio keeps the best 8 distinct photographs.</p>
          <div class="field-grid camera-composition-grid-v90">
            <label>Wall preferred<input id="cameraWallPreferredV90" type="number" min="100" max="6000" step="100" value="3000" /></label>
            <label>Wall range<input id="cameraWallMinV90" type="number" min="100" max="6000" step="100" value="1800" aria-label="Minimum wall hide distance" /><input id="cameraWallMaxV90" type="number" min="100" max="6000" step="100" value="4500" aria-label="Maximum wall hide distance" /></label>
            <label>Furniture preferred<input id="cameraFurniturePreferredV90" type="number" min="100" max="6000" step="100" value="1500" /></label>
            <label>Furniture range<input id="cameraFurnitureMinV90" type="number" min="100" max="6000" step="100" value="750" aria-label="Minimum furniture hide distance" /><input id="cameraFurnitureMaxV90" type="number" min="100" max="6000" step="100" value="2500" aria-label="Maximum furniture hide distance" /></label>
          </div>
          <div class="button-row" style="margin-top:10px"><button id="cameraCompositionRunV90" type="button">Rank 12 → Keep best 8</button></div>
          <p class="small" id="cameraCompositionStatusV90">Import a Layout Planner V3 project to rank its camera candidates.</p>`;
        const cameraShotNote = $('cameraShotNote');
        if (cameraShotNote) cameraShotNote.insertAdjacentElement('afterend', controls);
        else cameraSection.appendChild(controls);
        $('cameraCompositionRunV90').addEventListener('click', rankCameraPlanV90);
        [
          'cameraWallPreferredV90', 'cameraWallMinV90', 'cameraWallMaxV90',
          'cameraFurniturePreferredV90', 'cameraFurnitureMinV90', 'cameraFurnitureMaxV90'
        ].forEach(id => $(id).addEventListener('change', updateCameraCompositionRangeV90));
      })();

      if (!document.getElementById('cameraCompositionStylesV90')) {
        const style = document.createElement('style');
        style.id = 'cameraCompositionStylesV90';
        style.textContent = `
          #cameraCompositionControlsV90{margin-top:16px;padding-top:14px;border-top:1px solid var(--line)}
          #cameraCompositionControlsV90>h2{font-size:10px;margin-bottom:9px;color:#bbb9ae;text-transform:uppercase;letter-spacing:.08em}
          .camera-composition-grid-v90 label input+input{margin-top:5px}
          #cameraCompositionRunV90{width:100%;background:var(--sage);color:#fff;border-color:transparent}
          #cameraCompositionRunV90:disabled{opacity:.48}
        `;
        document.head.appendChild(style);
      }

      const normalizeProjectBeforeCameraCompositionV90 = normalizeProject;
      normalizeProject = function() { normalizeProjectBeforeCameraCompositionV90(); ensureCameraPlanV90(); };
      if (typeof normalizeProjectV27 === 'function') {
        const normalizeProjectV27BeforeCameraCompositionV90 = normalizeProjectV27;
        normalizeProjectV27 = function() { normalizeProjectV27BeforeCameraCompositionV90(); ensureCameraPlanV90(); };
      }
      const buildSceneBeforeCameraCompositionV90 = buildScene;
      buildScene = function() { buildSceneBeforeCameraCompositionV90(); ensureCameraPlanV90(); syncCameraCompositionUiV90(); };

      ensureCameraPlanV90();
      syncCameraCompositionUiV90();
