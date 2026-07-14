      // Architecture-review UI and responsive precision-panel access.
      // Detection remains in app-parts/25.js; ruler calibration remains in 26.js.
      const REVIEW_STEP_COUNT_V36 = 2;
      const reviewWorkflowV36 = $('wallReviewWorkflow');
      const leftPanelV36 = document.querySelector('.panel.left');
      let reviewStepV36 = 1;
      let reviewSessionV36 = null;
      let reviewHighlightsVisibleV36 = true;
      let originalBasemapOpacityV36 = null;

      reviewWorkflowV36.classList.add('section');
      leftPanelV36.prepend(reviewWorkflowV36);

      function reviewIsActiveV36(){
        return !!(
          wallReviewActiveV32 &&
          project.basemap &&
          project.settings?.architectureReviewConfirmed !== true
        );
      }

      function setReviewStepV36(step){
        reviewStepV36 = Math.max(1, Math.min(REVIEW_STEP_COUNT_V36, step));
        reviewWorkflowV36.querySelectorAll('[data-review-step]').forEach(page => {
          page.hidden = Number(page.dataset.reviewStep) !== reviewStepV36;
        });
        $('reviewStepLabel').textContent = `Step ${reviewStepV36 + 1} of ${REVIEW_STEP_COUNT_V36 + 1}`;
        $('reviewProgressBar').style.width = `${(reviewStepV36 + 1) / (REVIEW_STEP_COUNT_V36 + 1) * 100}%`;
        $('reviewStepBack').hidden = reviewStepV36 === 1;
        $('reviewStepNext').hidden = reviewStepV36 === REVIEW_STEP_COUNT_V36;
      }

      function setReviewInstructionV36(message){
        $('wallReviewInstruction').textContent = message;
      }

      function pluralV36(count, singular){
        return `${count} ${singular}${count === 1 ? '' : 's'}`;
      }

      function syncReviewCountsV36(){
        const walls = (project.walls || []).filter(item => item.detected).length;
        const doors = (project.openings || []).filter(item => item.type === 'door' && item.autoDetected).length;
        const windows = (project.openings || []).filter(item => item.type === 'window' && item.autoDetected).length;
        $('reviewSuggestionCounts').textContent = [
          `Unconfirmed: ${pluralV36(walls, 'wall')}`,
          pluralV36(doors, 'detected door'),
          pluralV36(windows, 'detected or aligned window')
        ].join(' · ');
      }

      function syncReviewHighlightsV36(){
        const button = $('reviewToggleHighlights');
        button.classList.toggle('active', reviewHighlightsVisibleV36);
        button.textContent = `Highlight walls: ${reviewHighlightsVisibleV36 ? 'on' : 'off'}`;
        detectedWallHighlightGroupV28.visible = reviewIsActiveV36() && reviewHighlightsVisibleV36;
      }

      function syncArchitectureReviewUiV36(){
        const active = reviewIsActiveV36();
        reviewWorkflowV36.hidden = !active;
        document.body.classList.toggle('architecture-review-mode', active);
        $('collisionStatus').hidden = active;
        syncReviewCountsV36();
        updateDetectedWallHighlightsV28(false);
        syncReviewHighlightsV36();
      }

      function captureReviewSessionV36(){
        return {
          projectJson: JSON.stringify(project),
          undo: [...undoStack],
          redo: [...redoStack],
          cameraPosition: camera.position.toArray(),
          cameraTarget: orbit.target.toArray(),
          fov: camera.fov,
          activeView: ['viewTop', 'viewBird', 'viewEye'].find(id => $(id).classList.contains('active'))
        };
      }

      function restoreReviewSessionV36(snapshot){
        restoreOriginalBasemapV36();
        project = JSON.parse(snapshot.projectJson);
        normalizeProjectV27();
        selected = null;
        selectedArchitecture = null;
        transform.detach();
        wallDetectionCache = null;
        basemapRenderSignature = '';
        wallReviewActiveV32 = false;
        wallReviewStartKeyV32 = '';

        undoStack.splice(0, undoStack.length, ...snapshot.undo);
        redoStack.splice(0, redoStack.length, ...snapshot.redo);
        $('undo').disabled = !undoStack.length;
        $('redo').disabled = !redoStack.length;

        camera.position.fromArray(snapshot.cameraPosition);
        orbit.target.fromArray(snapshot.cameraTarget);
        camera.fov = snapshot.fov;
        camera.updateProjectionMatrix();
        orbit.enabled = true;
        orbit.enableRotate = true;
        orbit.enablePan = true;
        orbit.enableZoom = true;
        orbit.update();

        ['viewTop', 'viewBird', 'viewEye'].forEach(id => $(id).classList.toggle('active', id === snapshot.activeView));
        $('fovField').value = Math.round(camera.fov);
        $('cameraHeight').value = Math.round(camera.position.y / MM);
        buildScene();
        syncBasemapControls();
        updateProjectWorkspace();
        $('basemapStatus').textContent = 'Architecture review discarded. The project has been restored to its state before floor-plan checking.';
      }

      function selectReviewToolV36(tool, instruction){
        setTool(tool);
        setReviewInstructionV36(instruction);
      }

      function alignSelectedReviewWallV36(){
        if(selectedArchitecture?.kind !== 'wall'){
          setReviewInstructionV36('Select a wall first, then choose Align selected.');
          return;
        }
        alignSelectedWallToBasemap();
        setReviewInstructionV36('Selected wall aligned. Compare it with the basemap before confirming.');
      }

      function deleteSelectedReviewArchitectureV36(){
        if(!selectedArchitecture){
          setReviewInstructionV36('Select an incorrect wall, door or window first.');
          return;
        }
        $('deleteArchitecture').click();
        setReviewInstructionV36('Incorrect architecture removed. Continue reviewing the plan.');
      }

      function showOriginalBasemapV36(){
        if(originalBasemapOpacityV36 !== null || !project.basemap)return;
        originalBasemapOpacityV36 = project.basemap.opacity ?? .48;
        project.basemap.opacity = 1;
        basemapGroup.children.forEach(item => { if(item.material)item.material.opacity = 1; });
        $('reviewOriginal').classList.add('active');
        $('reviewOriginal').textContent = 'Release original';
      }

      function restoreOriginalBasemapV36(){
        if(originalBasemapOpacityV36 === null || !project.basemap)return;
        project.basemap.opacity = originalBasemapOpacityV36;
        basemapGroup.children.forEach(item => { if(item.material)item.material.opacity = originalBasemapOpacityV36; });
        originalBasemapOpacityV36 = null;
        $('reviewOriginal').classList.remove('active');
        $('reviewOriginal').textContent = 'Hold original';
      }

      $('reviewStepBack').onclick = () => setReviewStepV36(reviewStepV36 - 1);
      $('reviewStepNext').onclick = () => setReviewStepV36(reviewStepV36 + 1);
      $('reviewToggleHighlights').onclick = () => {
        reviewHighlightsVisibleV36 = !reviewHighlightsVisibleV36;
        syncReviewHighlightsV36();
      };
      $('reviewAddWall').onclick = () => selectReviewToolV36('wall', 'Current view preserved. Click two points to draw the missing wall; nearby wall joints snap magnetically.');
      $('reviewAddDoor').onclick = () => selectReviewToolV36('door', 'Current view preserved. Click the correct wall to add a missing door.');
      $('reviewAddWindow').onclick = () => selectReviewToolV36('window', 'Current view preserved. Click the correct wall to add a missing window.');
      $('reviewAlignSelected').onclick = alignSelectedReviewWallV36;
      $('reviewDeleteSelected').onclick = deleteSelectedReviewArchitectureV36;
      $('reviewOriginal').addEventListener('pointerdown', showOriginalBasemapV36);
      ['pointerup', 'pointercancel', 'pointerleave'].forEach(type => {
        $('reviewOriginal').addEventListener(type, restoreOriginalBasemapV36);
      });

      window.addEventListener('keydown', event => {
        if((event.key === 'y' || event.key === 'Y') && !event.ctrlKey && !event.metaKey && !event.altKey && !event.repeat && !reviewWorkflowV36.hidden){
          showOriginalBasemapV36();
        }
      });
      window.addEventListener('keyup', event => {
        if(event.key === 'y' || event.key === 'Y')restoreOriginalBasemapV36();
      });

      $('reviewCancel').onclick = () => {
        if(!reviewSessionV36)return;
        if(!confirm('Exit architecture review and discard every automatic or manual change made during this review?'))return;
        const snapshot = reviewSessionV36;
        reviewSessionV36 = null;
        restoreReviewSessionV36(snapshot);
        syncArchitectureReviewUiV36();
      };
      $('confirmWallReview').addEventListener('click', () => {
        reviewSessionV36 = null;
        document.body.classList.remove('architecture-review-mode');
      });

      const beginWallReviewBeforeUiV36 = beginWallReviewV32;
      beginWallReviewV32 = function(force = false){
        const snapshot = wallReviewActiveV32 ? null : captureReviewSessionV36();
        setReviewStepV36(1);
        beginWallReviewBeforeUiV36(force);
        if(snapshot && reviewIsActiveV36())reviewSessionV36 = snapshot;
        syncArchitectureReviewUiV36();
      };

      const updateDetectedWallHighlightsBeforeUiV36 = updateDetectedWallHighlightsV28;
      updateDetectedWallHighlightsV28 = function(rebuild = false){
        updateDetectedWallHighlightsBeforeUiV36(rebuild);
        detectedWallHighlightGroupV28.visible = reviewIsActiveV36() && reviewHighlightsVisibleV36;
      };

      const validateBeforeReviewUiV36 = validate;
      validate = function(){
        validateBeforeReviewUiV36();
        if(wallReviewActiveV32){
          clearGroup(validationOverlayGroupV28);
          validationOverlayGroupV28.visible = false;
        }
        $('collisionStatus').hidden = !!wallReviewActiveV32;
      };

      const buildSceneBeforeReviewUiV36 = buildScene;
      buildScene = function(){
        buildSceneBeforeReviewUiV36();
        syncArchitectureReviewUiV36();
      };

      // Precision controls become a drawer below 900 px instead of disappearing.
      const precisionPanelV36 = $('precisionPanel');
      const precisionToggleV36 = $('togglePrecisionPanel');
      const precisionBackdropV36 = $('precisionPanelBackdrop');

      function setPrecisionPanelOpenV36(open){
        const mobile = window.matchMedia('(max-width: 900px)').matches;
        const visible = !!open && mobile;
        precisionPanelV36.classList.toggle('mobile-open', visible);
        precisionPanelV36.setAttribute('aria-hidden', String(mobile && !visible));
        document.body.classList.toggle('precision-panel-open', visible);
        precisionToggleV36.classList.toggle('active', visible);
        precisionToggleV36.setAttribute('aria-expanded', String(visible));
        precisionToggleV36.textContent = visible ? 'Close precision' : 'Precision';
      }

      precisionToggleV36.onclick = () => setPrecisionPanelOpenV36(!precisionPanelV36.classList.contains('mobile-open'));
      precisionBackdropV36.onclick = () => setPrecisionPanelOpenV36(false);
      window.addEventListener('resize', () => {
        if(!window.matchMedia('(max-width: 900px)').matches)setPrecisionPanelOpenV36(false);
      });
      window.addEventListener('keydown', event => {
        if(event.key === 'Escape' && precisionPanelV36.classList.contains('mobile-open'))setPrecisionPanelOpenV36(false);
      });

      setReviewStepV36(1);
      syncArchitectureReviewUiV36();
      setPrecisionPanelOpenV36(false);
