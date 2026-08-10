      // -----------------------------------------------------------------------------
      // v2.8 workflow contract: two planning/design approval gates followed by an
      // isolated render handoff. The handoff deliberately excludes project JSON.
      // -----------------------------------------------------------------------------

      const workflowModuleVersionV75 = '20260810-isolated-render-workflow-v75';
      const lockedRenderRulesV75 = [
        'Use the Layout Studio PNG as the spatial and compositional source of truth.',
        'Keep the approved camera position, lens, crop and framing unchanged.',
        'Keep walls, ceilings, openings, floor zones and built-ins unchanged.',
        'Keep every furniture item in its approved position, size and orientation.',
        'Keep approved lighting-fixture positions and major styling-object positions unchanged.'
      ];
      const prohibitedRenderRulesV75 = [
        'Do not add, remove, move, resize or substitute architecture, furniture, built-ins or major styling objects.',
        'Do not redesign, re-plan, source products or introduce a new concept.',
        'Do not read or modify a Layout Studio project ZIP during image generation.'
      ];

      function canonicalValueV75(value) {
        if (Array.isArray(value)) return value.map(canonicalValueV75);
        if (!value || typeof value !== 'object') return value;
        return Object.keys(value).sort().reduce((result, key) => {
          if (value[key] !== undefined) result[key] = canonicalValueV75(value[key]);
          return result;
        }, {});
      }

      function fingerprintValueV75(value) {
        const source = JSON.stringify(canonicalValueV75(value));
        let hash = 0x811c9dc5;
        for (let index = 0; index < source.length; index += 1) {
          hash ^= source.charCodeAt(index);
          hash = Math.imul(hash, 0x01000193);
        }
        return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, '0')}`;
      }

      function geometryOnlyV75(item) {
        if (!item || typeof item !== 'object') return item;
        const keys = [
          'id', 'type', 'category', 'model', 'custom', 'x', 'y', 'w', 'd', 'h',
          'x1', 'y1', 'x2', 'y2', 'thickness', 'elevation', 'rotation', 'wallId',
          'offset', 'width', 'height', 'sill', 'swing', 'fixed', 'placement'
        ];
        return keys.reduce((result, key) => {
          if (item[key] !== undefined) result[key] = item[key];
          return result;
        }, {});
      }

      function layoutFingerprintV75() {
        return fingerprintValueV75({
          plan: project.plan || null,
          rooms: (project.rooms || []).map(geometryOnlyV75),
          walls: (project.walls || []).map(geometryOnlyV75),
          openings: (project.openings || []).map(geometryOnlyV75),
          shell: (project.shell || []).map(geometryOnlyV75),
          clearances: (project.clearances || []).map(geometryOnlyV75),
          furniture: (project.furniture || []).map(geometryOnlyV75)
        });
      }

      function designFingerprintV75() {
        const settings = project.settings || {};
        return fingerprintValueV75({
          layout: layoutFingerprintV75(),
          design: project.design || null,
          cameraShots: project.cameraShots || [],
          references: (project.references || []).map(reference => ({
            id: reference.id,
            name: reference.name,
            mimeType: reference.mimeType,
            assetPath: reference.assetPath || null,
            size: reference.size || null
          })),
          furniture: project.furniture || [],
          shell: project.shell || [],
          viewSettings: {
            ceilingHeight: settings.ceilingHeight,
            cameraCutaway: settings.cameraCutaway || null,
            cameraFurniture: settings.cameraFurniture || null
          }
        });
      }

      function normaliseStringListV75(value) {
        return Array.isArray(value)
          ? value.map(item => String(item || '').trim()).filter(Boolean)
          : [];
      }

      function ensureWorkflowV75() {
        project.workflow = project.workflow && typeof project.workflow === 'object' ? project.workflow : {};
        const workflow = project.workflow;
        workflow.schemaVersion = 1;
        workflow.stage = ['layout-planning', 'design-development', 'design-approved'].includes(workflow.stage)
          ? workflow.stage : 'layout-planning';
        workflow.approvals = workflow.approvals && typeof workflow.approvals === 'object' ? workflow.approvals : {};
        ['layout', 'design'].forEach(kind => {
          const approval = workflow.approvals[kind] && typeof workflow.approvals[kind] === 'object'
            ? workflow.approvals[kind] : {};
          approval.status = ['pending', 'approved', 'changes-required'].includes(approval.status)
            ? approval.status : 'pending';
          approval.approvedAt = typeof approval.approvedAt === 'string' ? approval.approvedAt : null;
          approval.fingerprint = typeof approval.fingerprint === 'string' ? approval.fingerprint : null;
          workflow.approvals[kind] = approval;
        });
        workflow.locks = workflow.locks && typeof workflow.locks === 'object' ? workflow.locks : {};

        project.design = project.design && typeof project.design === 'object' ? project.design : {};
        const design = project.design;
        design.styleBoard = design.styleBoard && typeof design.styleBoard === 'object' ? design.styleBoard : {};
        design.styleBoard.referenceIds = [...new Set(normaliseStringListV75(design.styleBoard.referenceIds))];
        design.styleBoard.notes = typeof design.styleBoard.notes === 'string' ? design.styleBoard.notes : '';
        design.furnitureArchetypes = normaliseStringListV75(design.furnitureArchetypes);
        design.materials = normaliseStringListV75(design.materials);
        design.lighting = normaliseStringListV75(design.lighting);
        design.styling = normaliseStringListV75(design.styling);
        const shots = new Set((project.cameraShots || []).map(shot => shot.id));
        const seenSpecs = new Set();
        design.shotRenderSpecs = (Array.isArray(design.shotRenderSpecs) ? design.shotRenderSpecs : [])
          .filter(spec => spec && typeof spec === 'object' && shots.has(spec.shotId) && !seenSpecs.has(spec.shotId))
          .map(spec => {
            seenSpecs.add(spec.shotId);
            return {
              id: typeof spec.id === 'string' && spec.id ? spec.id : `render-${spec.shotId}`,
              shotId: spec.shotId,
              intent: typeof spec.intent === 'string' ? spec.intent : '',
              mustInclude: normaliseStringListV75(spec.mustInclude),
              allowedInterpretation: normaliseStringListV75(spec.allowedInterpretation),
              negativeConstraints: normaliseStringListV75(spec.negativeConstraints),
              lockedInputs: [...lockedRenderRulesV75],
              policy: {
                canModifyLayout: false,
                canModifyDesign: false,
                canAddObjects: false,
                canSourceProducts: false
              }
            };
          });

        const layoutApproval = workflow.approvals.layout;
        const designApproval = workflow.approvals.design;
        if (layoutApproval.status === 'approved' && !layoutApproval.fingerprint) {
          layoutApproval.fingerprint = layoutFingerprintV75();
        }
        if (designApproval.status === 'approved' && !designApproval.fingerprint) {
          designApproval.fingerprint = designFingerprintV75();
        }
        if (designApproval.status === 'approved' && layoutApproval.status !== 'approved') {
          designApproval.status = 'changes-required';
          designApproval.approvedAt = null;
          designApproval.fingerprint = null;
        }
        workflow.locks.layout = layoutApproval.status === 'approved';
        workflow.locks.design = designApproval.status === 'approved';
        workflow.locks.cameraShots = designApproval.status === 'approved';
        workflow.stage = designApproval.status === 'approved'
          ? 'design-approved'
          : layoutApproval.status === 'approved' ? 'design-development' : 'layout-planning';
        return workflow;
      }

      function refreshWorkflowIntegrityV75() {
        const workflow = ensureWorkflowV75();
        const layoutApproval = workflow.approvals.layout;
        const designApproval = workflow.approvals.design;
        if (layoutApproval.status === 'approved' && layoutApproval.fingerprint !== layoutFingerprintV75()) {
          layoutApproval.status = 'changes-required';
          layoutApproval.approvedAt = null;
          layoutApproval.fingerprint = null;
          designApproval.status = designApproval.status === 'pending' ? 'pending' : 'changes-required';
          designApproval.approvedAt = null;
          designApproval.fingerprint = null;
        } else if (designApproval.status === 'approved' && designApproval.fingerprint !== designFingerprintV75()) {
          designApproval.status = 'changes-required';
          designApproval.approvedAt = null;
          designApproval.fingerprint = null;
        }
        if (designApproval.status === 'approved' && designReadinessIssuesV75().length) {
          designApproval.status = 'changes-required';
          designApproval.approvedAt = null;
          designApproval.fingerprint = null;
        }
        ensureWorkflowV75();
        syncWorkflowUiV75();
        return workflow;
      }

      function isLayoutApprovedV75() {
        refreshWorkflowIntegrityV75();
        return project.workflow.approvals.layout.status === 'approved';
      }

      function isDesignApprovedV75() {
        refreshWorkflowIntegrityV75();
        return project.workflow.approvals.layout.status === 'approved' &&
          project.workflow.approvals.design.status === 'approved';
      }

      function linesFromValueV75(value) {
        return String(value || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
      }

      function listToValueV75(value) {
        return normaliseStringListV75(value).join('\n');
      }

      function approvalLabelV75(approval) {
        if (approval.status === 'approved') return approval.approvedAt
          ? `Approved ${new Date(approval.approvedAt).toLocaleString()}` : 'Approved';
        if (approval.status === 'changes-required') return 'Changes detected - approval required again';
        return 'Awaiting approval';
      }

      function setValueUnlessEditingV75(id, value) {
        const element = $(id);
        if (element && document.activeElement !== element) element.value = value;
      }

      function renderStyleBoardChoicesV75() {
        const container = $('workflowStyleBoardChoices');
        if (!container) return;
        const selected = new Set(project.design?.styleBoard?.referenceIds || []);
        const references = project.references || [];
        container.innerHTML = references.length ? '' : '<span class="workflow-empty">Add at least one approved style-board image.</span>';
        references.forEach(reference => {
          const label = document.createElement('label');
          label.className = 'workflow-reference-choice';
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.value = reference.id;
          checkbox.checked = selected.has(reference.id);
          checkbox.addEventListener('change', () => {
            pushHistory('change approved style board');
            const ids = new Set(project.design.styleBoard.referenceIds);
            if (checkbox.checked) ids.add(reference.id); else ids.delete(reference.id);
            project.design.styleBoard.referenceIds = [...ids];
            queueMicrotask(refreshWorkflowIntegrityV75);
          });
          const image = document.createElement('img');
          image.src = reference.dataUrl || '';
          image.alt = '';
          const name = document.createElement('span');
          name.textContent = reference.name;
          label.append(checkbox, image, name);
          container.appendChild(label);
        });
      }

      function findRenderSpecV75(shotId) {
        return (project.design?.shotRenderSpecs || []).find(spec => spec.shotId === shotId) || null;
      }

      function syncShotSpecEditorV75(force = false) {
        const select = $('workflowShotSelect');
        if (!select) return;
        const prior = select.value;
        const shots = project.cameraShots || [];
        select.innerHTML = '<option value="">Choose a locked camera shot...</option>';
        shots.forEach(shot => {
          const option = document.createElement('option');
          option.value = shot.id;
          option.textContent = shot.label;
          select.appendChild(option);
        });
        const wanted = shots.some(shot => shot.id === prior)
          ? prior
          : shots.some(shot => shot.id === activeCameraShotIdV70) ? activeCameraShotIdV70 : shots[0]?.id || '';
        select.value = wanted;
        if (!force && document.activeElement && document.activeElement.closest?.('#workflowShotSpecEditor')) return;
        const spec = findRenderSpecV75(wanted);
        $('workflowShotIntent').value = spec?.intent || '';
        $('workflowMustInclude').value = listToValueV75(spec?.mustInclude);
        $('workflowAllowedInterpretation').value = listToValueV75(spec?.allowedInterpretation);
        $('workflowNegativeConstraints').value = listToValueV75(spec?.negativeConstraints);
      }

      function saveDesignFieldsV75() {
        ensureWorkflowV75();
        project.design.styleBoard.notes = $('workflowStyleBoardNotes').value.trim();
        project.design.furnitureArchetypes = linesFromValueV75($('workflowFurnitureArchetypes').value);
        project.design.materials = linesFromValueV75($('workflowMaterials').value);
        project.design.lighting = linesFromValueV75($('workflowLighting').value);
        project.design.styling = linesFromValueV75($('workflowStyling').value);
      }

      function saveShotSpecV75() {
        const shotId = $('workflowShotSelect').value;
        if (!shotId) {
          setPackageStatus('Choose a camera shot before saving its render spec.', 'error');
          return;
        }
        pushHistory('save shot render spec');
        const spec = {
          id: `render-${shotId}`,
          shotId,
          intent: $('workflowShotIntent').value.trim(),
          mustInclude: linesFromValueV75($('workflowMustInclude').value),
          allowedInterpretation: linesFromValueV75($('workflowAllowedInterpretation').value),
          negativeConstraints: linesFromValueV75($('workflowNegativeConstraints').value),
          lockedInputs: [...lockedRenderRulesV75],
          policy: {
            canModifyLayout: false,
            canModifyDesign: false,
            canAddObjects: false,
            canSourceProducts: false
          }
        };
        project.design.shotRenderSpecs = project.design.shotRenderSpecs.filter(item => item.shotId !== shotId);
        project.design.shotRenderSpecs.push(spec);
        setPackageStatus(`Saved the isolated render spec for ${project.cameraShots.find(shot => shot.id === shotId)?.label || shotId}.`, 'ok');
        queueMicrotask(refreshWorkflowIntegrityV75);
      }

      function designReadinessIssuesV75() {
        ensureWorkflowV75();
        const issues = [];
        const selectedReferences = project.design.styleBoard.referenceIds
          .map(id => (project.references || []).find(reference => reference.id === id))
          .filter(Boolean);
        if (!selectedReferences.length) issues.push('select at least one approved style-board image');
        if (selectedReferences.some(reference => !reference.dataUrl)) issues.push('reload style-board assets that are missing from this browser session');
        if (!project.design.furnitureArchetypes.length) issues.push('add the approved furniture archetypes');
        if (!project.design.materials.length) issues.push('add the approved material palette');
        if (!project.design.lighting.length) issues.push('add the approved lighting direction');
        if (!project.design.styling.length) issues.push('add the approved styling direction');
        if (!(project.cameraShots || []).length) issues.push('save at least one locked camera shot');
        (project.cameraShots || []).forEach(shot => {
          const spec = findRenderSpecV75(shot.id);
          if (!spec || !spec.intent.trim()) issues.push(`complete the render intent for "${shot.label}"`);
        });
        return issues;
      }

      function approveLayoutV75() {
        ensureWorkflowV75();
        if (!(project.walls || []).length) {
          setPackageStatus('Gate 1 needs an authored layout with walls before approval.', 'error');
          return;
        }
        const warningCount = $('warningList')?.querySelectorAll('li').length || 0;
        if (warningCount && !confirm(`The layout has ${warningCount} validation issue${warningCount === 1 ? '' : 's'}. Approve Gate 1 with those issues recorded?`)) return;
        const now = new Date().toISOString();
        project.workflow.approvals.layout = {status: 'approved', approvedAt: now, fingerprint: layoutFingerprintV75()};
        project.workflow.approvals.design = {status: 'pending', approvedAt: null, fingerprint: null};
        ensureWorkflowV75();
        syncWorkflowUiV75();
        setPackageStatus('Gate 1 approved. The spatial layout is locked; continue with Step 2 design development.', 'ok');
      }

      function approveDesignV75() {
        saveDesignFieldsV75();
        refreshWorkflowIntegrityV75();
        if (!isLayoutApprovedV75()) {
          setPackageStatus('Approve Gate 1 before approving the design.', 'error');
          return;
        }
        const issues = designReadinessIssuesV75();
        if (issues.length) {
          setPackageStatus(`Gate 2 is not ready: ${issues.join('; ')}.`, 'error');
          return;
        }
        const now = new Date().toISOString();
        project.workflow.approvals.design = {status: 'approved', approvedAt: now, fingerprint: designFingerprintV75()};
        ensureWorkflowV75();
        syncWorkflowUiV75();
        setPackageStatus('Gate 2 approved. Design metadata and camera shots are locked; the Step 2 ZIP and Step 3 render handoff are now available.', 'ok');
      }

      function reopenApprovalV75(kind) {
        ensureWorkflowV75();
        if (kind === 'layout') {
          project.workflow.approvals.layout = {status: 'pending', approvedAt: null, fingerprint: null};
          project.workflow.approvals.design = {status: 'pending', approvedAt: null, fingerprint: null};
          setPackageStatus('Layout reopened. Gate 1 and Gate 2 must be approved again.', 'ok');
        } else {
          project.workflow.approvals.design = {status: 'pending', approvedAt: null, fingerprint: null};
          setPackageStatus('Design reopened. Gate 2 must be approved again.', 'ok');
        }
        ensureWorkflowV75();
        syncWorkflowUiV75();
      }

      function syncWorkflowUiV75() {
        if (!$('workflowPanel') || !project) return;
        const workflow = ensureWorkflowV75();
        const layout = workflow.approvals.layout;
        const design = workflow.approvals.design;
        const designApproved = layout.status === 'approved' && design.status === 'approved';
        $('workflowLayoutStatus').textContent = approvalLabelV75(layout);
        $('workflowDesignStatus').textContent = approvalLabelV75(design);
        $('workflowLayoutStep').classList.toggle('complete', layout.status === 'approved');
        $('workflowDesignStep').classList.toggle('complete', design.status === 'approved');
        $('workflowRenderStep').classList.toggle('complete', designApproved);
        $('approveLayoutGate').hidden = layout.status === 'approved';
        $('reopenLayoutGate').hidden = layout.status !== 'approved';
        $('approveDesignGate').disabled = layout.status !== 'approved';
        $('approveDesignGate').hidden = design.status === 'approved';
        $('reopenDesignGate').hidden = design.status !== 'approved';
        $('exportPackage').disabled = !designApproved;
        $('workflowRenderHandoff').disabled = !designApproved;
        $('headerRenderHandoff').disabled = !designApproved;
        $('workflowRenderStatus').textContent = designApproved
          ? 'Post-approval only. Choose a locked shot, then export the PNG + style board + shot render spec.'
          : 'Available only after Gate 2. No image generation occurs during planning or design.';
        setValueUnlessEditingV75('workflowStyleBoardNotes', project.design.styleBoard.notes || '');
        setValueUnlessEditingV75('workflowFurnitureArchetypes', listToValueV75(project.design.furnitureArchetypes));
        setValueUnlessEditingV75('workflowMaterials', listToValueV75(project.design.materials));
        setValueUnlessEditingV75('workflowLighting', listToValueV75(project.design.lighting));
        setValueUnlessEditingV75('workflowStyling', listToValueV75(project.design.styling));
        renderStyleBoardChoicesV75();
        syncShotSpecEditorV75();
      }

      async function captureApprovedLayoutPngV75(width, height) {
        const oldSize = new THREE.Vector2();
        renderer.getSize(oldSize);
        const oldBackground = scene.background;
        const oldGrid = grid.visible;
        const oldClearance = clearanceGroup.visible;
        const oldTransform = transform.visible;
        const oldOverlay = selectionOverlayGroup.visible;
        const oldResize = typeof carpentryResizeGroup !== 'undefined' ? carpentryResizeGroup.visible : null;
        const labels = [...labelGroup.children, ...architectureLabelGroup.children];
        const hiddenLabels = new Set(labels.filter(label => label.visible === false));
        try {
          grid.visible = false;
          clearanceGroup.visible = false;
          transform.visible = false;
          selectionOverlayGroup.visible = false;
          if (oldResize !== null) carpentryResizeGroup.visible = false;
          renderer.setSize(width, height, false);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          if (typeof applyCameraCutaway === 'function') applyCameraCutaway();
          if (typeof updateEyeLevelLabelCleanup === 'function') updateEyeLevelLabelCleanup();
          hiddenLabels.forEach(label => { label.visible = false; });
          await new Promise(resolve => requestAnimationFrame(resolve));
          renderer.render(scene, camera);
          const blob = await new Promise(resolve => renderer.domElement.toBlob(resolve, 'image/png'));
          if (!blob) throw new Error('The approved Layout Studio PNG could not be created');
          return blob;
        } finally {
          renderer.setSize(oldSize.x, oldSize.y, false);
          camera.aspect = oldSize.x / oldSize.y;
          camera.updateProjectionMatrix();
          scene.background = oldBackground;
          grid.visible = oldGrid;
          clearanceGroup.visible = oldClearance;
          transform.visible = oldTransform;
          selectionOverlayGroup.visible = oldOverlay;
          if (oldResize !== null) carpentryResizeGroup.visible = oldResize;
          if (typeof applyCameraCutaway === 'function') applyCameraCutaway();
          if (typeof updateEyeLevelLabelCleanup === 'function') updateEyeLevelLabelCleanup();
        }
      }

      function renderHandoffSpecV75(shot, storedSpec, pngName, styleBoardAssets, width, height) {
        return {
          schemaVersion: 1,
          stage: 'image-generation-only',
          sourceImage: pngName,
          styleBoard: styleBoardAssets,
          shot: {id: shot.id, label: shot.label},
          intent: storedSpec.intent,
          mustInclude: storedSpec.mustInclude,
          locked: [...lockedRenderRulesV75],
          controlledInterpretation: storedSpec.allowedInterpretation,
          prohibited: [...prohibitedRenderRulesV75, ...storedSpec.negativeConstraints],
          output: {width, height, format: 'png'},
          policy: {
            projectZipAllowed: false,
            canModifyLayout: false,
            canModifyDesign: false,
            canAddObjects: false,
            canSourceProducts: false
          }
        };
      }

      async function exportRenderHandoffV75() {
        if (!isDesignApprovedV75()) {
          setPackageStatus('The isolated image-generation handoff is available only after Gate 2 approval.', 'error');
          return;
        }
        const shotId = $('renderHandoffShot').value || activeCameraShotIdV70;
        const shot = (project.cameraShots || []).find(item => item.id === shotId);
        const storedSpec = shot && findRenderSpecV75(shot.id);
        if (!shot || !storedSpec) {
          setPackageStatus('Choose a locked camera shot with a completed render spec.', 'error');
          return;
        }
        const references = project.design.styleBoard.referenceIds
          .map(id => (project.references || []).find(reference => reference.id === id))
          .filter(Boolean);
        if (!references.length || references.some(reference => !reference.dataUrl)) {
          setPackageStatus('The approved style-board image assets must be loaded before exporting the handoff.', 'error');
          return;
        }
        const [width, height] = $('renderHandoffPreset').value.split('x').map(Number);
        setPackageBusy(true, `Preparing the isolated handoff for ${shot.label}...`);
        try {
          applyCameraShotV70(shot);
          await new Promise(resolve => requestAnimationFrame(resolve));
          const pngBlob = await captureApprovedLayoutPngV75(width, height);
          const zip = new JSZip();
          const pngName = 'layout-studio-export.png';
          zip.file(pngName, pngBlob);
          const styleBoardAssets = [];
          references.forEach((reference, index) => {
            const payload = dataUrlPayload(reference.dataUrl);
            if (!payload) throw new Error(`Style-board asset could not be read: ${reference.name}`);
            const extension = extensionForMime(reference.mimeType || payload.mimeType, reference.name);
            let assetName = safeFileName(reference.name || `style-board.${extension}`);
            if (!/\.[a-z0-9]{2,5}$/i.test(assetName)) assetName += `.${extension}`;
            const path = `style-board/${String(index + 1).padStart(2, '0')}-${assetName}`;
            zip.file(path, payload.base64, {base64: true});
            styleBoardAssets.push(path);
          });
          const renderSpec = renderHandoffSpecV75(shot, storedSpec, pngName, styleBoardAssets, width, height);
          zip.file('render-spec.json', JSON.stringify(renderSpec, null, 2));
          const blob = await zip.generateAsync(
            {type: 'blob', compression: 'DEFLATE', compressionOptions: {level: 6}},
            progress => setPackageStatus(`Compressing isolated render handoff... ${Math.round(progress.percent)}%`, 'busy')
          );
          downloadBlob(blob, `${safeFileName(project.meta?.name, 'layout-studio')}-${safeShotSlugV70(shot.label)}-render-handoff.zip`);
          $('renderHandoffModal').classList.remove('open');
          setPackageStatus('Render handoff exported. It contains only the approved Layout Studio PNG, approved style-board assets and this shot\'s render spec.', 'ok');
        } catch (error) {
          console.error(error);
          setPackageStatus(`Render handoff failed: ${error.message}`, 'error');
        } finally {
          setPackageBusy(false);
          syncWorkflowUiV75();
        }
      }

      function openRenderHandoffV75() {
        if (!isDesignApprovedV75()) {
          setPackageStatus('Complete both approval gates before starting Step 3.', 'error');
          return;
        }
        const select = $('renderHandoffShot');
        select.innerHTML = '';
        (project.cameraShots || []).forEach(shot => {
          const option = document.createElement('option');
          option.value = shot.id;
          option.textContent = shot.label;
          select.appendChild(option);
        });
        select.value = (project.cameraShots || []).some(shot => shot.id === activeCameraShotIdV70)
          ? activeCameraShotIdV70 : project.cameraShots[0]?.id || '';
        $('renderHandoffModal').classList.add('open');
      }

      (function buildWorkflowUiV75() {
        const workspace = document.querySelector('.project-workspace');
        if (!workspace || $('workflowPanel')) return;
        const panel = document.createElement('div');
        panel.className = 'section workflow-panel';
        panel.id = 'workflowPanel';
        panel.innerHTML = `
          <h2>Planner workflow</h2>
          <div class="workflow-step" id="workflowLayoutStep">
            <div class="workflow-step-heading"><span>Step 1</span><strong>Layout planning</strong></div>
            <p>Approve architecture, room use, furniture footprints and circulation. No image generation.</p>
            <div class="workflow-status" id="workflowLayoutStatus">Awaiting approval</div>
            <div class="button-row"><button id="approveLayoutGate" class="primary">Approve Gate 1</button><button id="reopenLayoutGate" hidden>Reopen layout</button></div>
          </div>
          <div class="workflow-step" id="workflowDesignStep">
            <div class="workflow-step-heading"><span>Step 2</span><strong>Design + complete Studio ZIP</strong></div>
            <p>Add approved archetypes, materials, lighting, styling, and locked shots. Gate 2 unlocks the complete project ZIP.</p>
            <details class="workflow-details">
              <summary>Design metadata</summary>
              <div class="workflow-detail-body">
                <div class="button-row"><button id="workflowAddStyleBoard">Add style-board images</button></div>
                <div id="workflowStyleBoardChoices" class="workflow-reference-choices"></div>
                <label>Style-board notes<textarea id="workflowStyleBoardNotes"></textarea></label>
                <label>Furniture archetypes - one per line<textarea id="workflowFurnitureArchetypes"></textarea></label>
                <label>Material palette - one per line<textarea id="workflowMaterials"></textarea></label>
                <label>Lighting direction - one per line<textarea id="workflowLighting"></textarea></label>
                <label>Styling direction - one per line<textarea id="workflowStyling"></textarea></label>
              </div>
            </details>
            <details class="workflow-details" id="workflowShotSpecEditor">
              <summary>Shot-specific render specs</summary>
              <div class="workflow-detail-body">
                <label>Locked camera shot<select id="workflowShotSelect"></select></label>
                <label>Render intent<textarea id="workflowShotIntent"></textarea></label>
                <label>Must remain visible - one per line<textarea id="workflowMustInclude"></textarea></label>
                <label>Allowed interpretation - one per line<textarea id="workflowAllowedInterpretation"></textarea></label>
                <label>Extra prohibitions - one per line<textarea id="workflowNegativeConstraints"></textarea></label>
                <button id="workflowSaveShotSpec" class="primary">Save shot render spec</button>
              </div>
            </details>
            <div class="workflow-status" id="workflowDesignStatus">Awaiting approval</div>
            <div class="button-row"><button id="approveDesignGate" class="primary">Approve Gate 2</button><button id="reopenDesignGate" hidden>Reopen design</button></div>
          </div>
          <div class="workflow-step" id="workflowRenderStep">
            <div class="workflow-step-heading"><span>Step 3</span><strong>Image generation only</strong></div>
            <p id="workflowRenderStatus">Available only after Gate 2.</p>
            <button id="workflowRenderHandoff" class="primary">Export isolated render handoff</button>
          </div>`;
        workspace.insertAdjacentElement('afterend', panel);

        const headerButton = document.createElement('button');
        headerButton.id = 'headerRenderHandoff';
        headerButton.className = 'primary';
        headerButton.textContent = 'Image handoff';
        headerButton.title = 'Step 3: export only the approved PNG, style board and shot render spec';
        $('capture').insertAdjacentElement('beforebegin', headerButton);

        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'renderHandoffModal';
        modal.innerHTML = `
          <div class="dialog render-handoff-dialog" role="dialog" aria-modal="true" aria-labelledby="renderHandoffTitle">
            <span class="scale-step-label">Step 3 - post approval</span>
            <h3 id="renderHandoffTitle">Image-generation handoff</h3>
            <p class="small">This action exports only the approved Layout Studio PNG, approved style-board assets and the selected shot's render spec. It cannot change the project.</p>
            <label>Locked camera shot<select id="renderHandoffShot"></select></label>
            <label style="margin-top:10px">Output size<select id="renderHandoffPreset"><option value="1600x1000">Landscape 16:10</option><option value="1600x900">Landscape 16:9</option><option value="1200x1500">Portrait 4:5</option><option value="1200x1600">Portrait 3:4</option><option value="1400x1400">Square</option></select></label>
            <div class="render-lock-note"><strong>Locked</strong><span>No layout, design, camera, object or sourcing changes are permitted.</span></div>
            <div class="dialog-actions"><button id="renderHandoffCancel">Cancel</button><button id="renderHandoffExport" class="primary">Download handoff ZIP</button></div>
          </div>`;
        document.body.appendChild(modal);

        $('approveLayoutGate').onclick = approveLayoutV75;
        $('reopenLayoutGate').onclick = () => reopenApprovalV75('layout');
        $('approveDesignGate').onclick = approveDesignV75;
        $('reopenDesignGate').onclick = () => reopenApprovalV75('design');
        $('workflowSaveShotSpec').onclick = saveShotSpecV75;
        $('workflowShotSelect').onchange = () => syncShotSpecEditorV75(true);
        $('workflowAddStyleBoard').onclick = () => $('referenceFiles').click();
        ['workflowStyleBoardNotes', 'workflowFurnitureArchetypes', 'workflowMaterials', 'workflowLighting', 'workflowStyling'].forEach(id => {
          $(id).addEventListener('focus', () => pushHistory('edit approved design metadata'));
          $(id).addEventListener('input', () => {
            saveDesignFieldsV75();
            queueMicrotask(refreshWorkflowIntegrityV75);
          });
        });
        $('workflowRenderHandoff').onclick = openRenderHandoffV75;
        $('headerRenderHandoff').onclick = openRenderHandoffV75;
        $('renderHandoffCancel').onclick = () => $('renderHandoffModal').classList.remove('open');
        $('renderHandoffExport').onclick = exportRenderHandoffV75;
      })();

      const normalizeProjectBeforeWorkflowV75 = normalizeProject;
      normalizeProject = function() {
        normalizeProjectBeforeWorkflowV75();
        ensureWorkflowV75();
      };
      if (typeof normalizeProjectV27 === 'function') {
        const normalizeProjectV27BeforeWorkflowV75 = normalizeProjectV27;
        normalizeProjectV27 = function() {
          normalizeProjectV27BeforeWorkflowV75();
          ensureWorkflowV75();
        };
      }

      const pushHistoryBeforeWorkflowV75 = pushHistory;
      pushHistory = function(label) {
        const result = pushHistoryBeforeWorkflowV75(label);
        queueMicrotask(refreshWorkflowIntegrityV75);
        return result;
      };

      const buildSceneBeforeWorkflowV75 = buildScene;
      buildScene = function() {
        const result = buildSceneBeforeWorkflowV75();
        refreshWorkflowIntegrityV75();
        return result;
      };

      const renderReferenceListBeforeWorkflowV75 = renderReferenceList;
      renderReferenceList = function() {
        const result = renderReferenceListBeforeWorkflowV75();
        renderStyleBoardChoicesV75();
        return result;
      };

      const setPackageBusyBeforeWorkflowV75 = setPackageBusy;
      setPackageBusy = function(busy, message) {
        const result = setPackageBusyBeforeWorkflowV75(busy, message);
        if (!busy) queueMicrotask(syncWorkflowUiV75);
        return result;
      };

      const exportProjectPackageBeforeWorkflowV75 = exportProjectPackage;
      exportProjectPackage = async function() {
        if (!isDesignApprovedV75()) {
          setPackageStatus('The complete Step 2 Layout Studio ZIP is available only after Gate 2 approval.', 'error');
          return;
        }
        return exportProjectPackageBeforeWorkflowV75();
      };

      ensureWorkflowV75();
      syncWorkflowUiV75();
