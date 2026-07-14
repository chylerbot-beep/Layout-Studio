      // In-panel architecture review and responsive precision-panel access.
      // Review temporarily replaces the normal left inspector, leaving the viewport
      // unobstructed. Cancel restores the project, history and camera from before the
      // automatic floor-plan check; confirmation keeps the reviewed architecture.
      let reviewGuideStepV35=1,reviewSessionSnapshotV35=null;
      const reviewWorkflowV35=$('wallReviewWorkflow'),leftPanelV35=document.querySelector('.panel.left');
      reviewWorkflowV35.classList.add('section');leftPanelV35.prepend(reviewWorkflowV35);

      function setReviewGuideStepV35(step){
        reviewGuideStepV35=Math.max(1,Math.min(3,step));
        reviewWorkflowV35.querySelectorAll('[data-review-step]').forEach(page=>page.hidden=Number(page.dataset.reviewStep)!==reviewGuideStepV35);
        $('reviewStepLabel').textContent=`Step ${reviewGuideStepV35} of 3`;$('reviewProgressBar').style.width=`${reviewGuideStepV35/3*100}%`;
        $('reviewStepBack').hidden=reviewGuideStepV35===1;$('reviewStepNext').hidden=reviewGuideStepV35===3;
      }
      function reviewGuideIsActiveV35(){return !!(wallReviewActiveV32&&project.basemap&&project.settings?.architectureReviewConfirmed!==true);}
      function syncReviewGuideVisibilityV35(){
        const active=reviewGuideIsActiveV35();reviewWorkflowV35.hidden=!active;document.body.classList.toggle('architecture-review-mode',active);
      }
      function captureReviewSessionV35(){
        return{projectJson:JSON.stringify(project),undo:[...undoStack],redo:[...redoStack],cameraPosition:camera.position.toArray(),cameraTarget:orbit.target.toArray(),fov:camera.fov,view:{top:$('viewTop').classList.contains('active'),bird:$('viewBird').classList.contains('active'),eye:$('viewEye').classList.contains('active')}};
      }
      function restoreReviewSessionV35(snapshot){
        if(typeof cancelReviewAreaV33==='function')cancelReviewAreaV33();if(typeof restoreOriginalBasemapV33==='function')restoreOriginalBasemapV33();
        project=JSON.parse(snapshot.projectJson);normalizeProjectV27();selected=null;selectedArchitecture=null;transform.detach();wallDetectionCache=null;basemapRenderSignature='';wallReviewActiveV32=false;wallReviewStartKeyV32='';
        undoStack.splice(0,undoStack.length,...snapshot.undo);redoStack.splice(0,redoStack.length,...snapshot.redo);$('undo').disabled=!undoStack.length;$('redo').disabled=!redoStack.length;
        camera.position.fromArray(snapshot.cameraPosition);orbit.target.fromArray(snapshot.cameraTarget);camera.fov=snapshot.fov;camera.updateProjectionMatrix();orbit.enabled=true;orbit.update();
        $('viewTop').classList.toggle('active',snapshot.view.top);$('viewBird').classList.toggle('active',snapshot.view.bird);$('viewEye').classList.toggle('active',snapshot.view.eye);$('fovField').value=Math.round(camera.fov);$('cameraHeight').value=Math.round(camera.position.y/MM);
        buildScene();syncBasemapControls();updateProjectWorkspace();$('basemapStatus').textContent='Architecture review discarded. The project has been restored to its state before floor-plan checking.';
      }

      $('reviewStepBack').onclick=()=>setReviewGuideStepV35(reviewGuideStepV35-1);
      $('reviewStepNext').onclick=()=>setReviewGuideStepV35(reviewGuideStepV35+1);
      $('reviewCancel').onclick=()=>{if(!reviewSessionSnapshotV35)return;if(!confirm('Exit architecture review and discard every automatic or manual change made during this review?'))return;const snapshot=reviewSessionSnapshotV35;reviewSessionSnapshotV35=null;restoreReviewSessionV35(snapshot);syncReviewGuideVisibilityV35();};
      $('confirmWallReview').addEventListener('click',()=>{reviewSessionSnapshotV35=null;document.body.classList.remove('architecture-review-mode');});

      const beginWallReviewBeforePanelV35=beginWallReviewV32;
      beginWallReviewV32=function(force=false){
        const candidate=wallReviewActiveV32?null:captureReviewSessionV35();setReviewGuideStepV35(1);beginWallReviewBeforePanelV35(force);if(candidate&&reviewGuideIsActiveV35())reviewSessionSnapshotV35=candidate;syncReviewGuideVisibilityV35();
      };
      const buildSceneBeforePanelV35=buildScene;
      buildScene=function(){buildSceneBeforePanelV35();syncReviewGuideVisibilityV35();};
      setReviewGuideStepV35(1);syncReviewGuideVisibilityV35();

      const precisionPanelV35=$('precisionPanel'),precisionToggleV35=$('togglePrecisionPanel'),precisionBackdropV35=$('precisionPanelBackdrop');
      function setPrecisionPanelOpenV35(open){
        const mobile=window.matchMedia('(max-width: 900px)').matches,value=!!open&&mobile;precisionPanelV35.classList.toggle('mobile-open',value);precisionPanelV35.setAttribute('aria-hidden',String(mobile&&!value));document.body.classList.toggle('precision-panel-open',value);precisionToggleV35.classList.toggle('active',value);precisionToggleV35.setAttribute('aria-expanded',String(value));precisionToggleV35.textContent=value?'Close precision':'Precision';
      }
      precisionToggleV35.onclick=()=>setPrecisionPanelOpenV35(!precisionPanelV35.classList.contains('mobile-open'));
      precisionBackdropV35.onclick=()=>setPrecisionPanelOpenV35(false);
      window.addEventListener('resize',()=>{if(!window.matchMedia('(max-width: 900px)').matches)setPrecisionPanelOpenV35(false);});
      window.addEventListener('keydown',event=>{if(event.key==='Escape'&&precisionPanelV35.classList.contains('mobile-open'))setPrecisionPanelOpenV35(false);});
      setPrecisionPanelOpenV35(false);
