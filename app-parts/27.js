      // Guided architecture review and responsive precision-panel access.
      // The guide floats above the editor without a backdrop so OrbitControls remain
      // available for zooming, panning and changing camera views during review.
      let reviewGuideStepV34=1,reviewGuideMinimizedV34=false;

      function setReviewGuideStepV34(step){
        reviewGuideStepV34=Math.max(1,Math.min(3,step));
        document.querySelectorAll('[data-review-step]').forEach(page=>page.hidden=Number(page.dataset.reviewStep)!==reviewGuideStepV34);
        $('reviewStepLabel').textContent=`Step ${reviewGuideStepV34} of 3`;$('reviewProgressBar').style.width=`${reviewGuideStepV34/3*100}%`;
        $('reviewStepBack').hidden=reviewGuideStepV34===1;$('reviewStepNext').hidden=reviewGuideStepV34===3;
      }
      function reviewGuideIsActiveV34(){return !!(wallReviewActiveV32&&project.basemap&&project.settings?.architectureReviewConfirmed!==true);}
      function syncReviewGuideVisibilityV34(){
        const active=reviewGuideIsActiveV34();$('wallReviewWorkflow').hidden=!active||reviewGuideMinimizedV34;$('resumeReviewGuide').hidden=!active||!reviewGuideMinimizedV34;
      }
      $('reviewStepBack').onclick=()=>setReviewGuideStepV34(reviewGuideStepV34-1);
      $('reviewStepNext').onclick=()=>setReviewGuideStepV34(reviewGuideStepV34+1);
      $('reviewGuideClose').onclick=()=>{reviewGuideMinimizedV34=true;syncReviewGuideVisibilityV34();};
      $('resumeReviewGuide').onclick=()=>{reviewGuideMinimizedV34=false;syncReviewGuideVisibilityV34();};
      $('reviewViewTop').onclick=()=>{orbit.enabled=true;viewTop();};
      $('reviewViewBird').onclick=()=>{orbit.enabled=true;viewBird();};
      $('reviewViewEye').onclick=()=>{orbit.enabled=true;viewEye();};
      $('confirmWallReview').addEventListener('click',()=>{reviewGuideMinimizedV34=false;$('resumeReviewGuide').hidden=true;});

      const beginWallReviewBeforeGuideV34=beginWallReviewV32;
      beginWallReviewV32=function(force=false){reviewGuideMinimizedV34=false;setReviewGuideStepV34(1);beginWallReviewBeforeGuideV34(force);syncReviewGuideVisibilityV34();};
      const buildSceneBeforeGuideV34=buildScene;
      buildScene=function(){buildSceneBeforeGuideV34();syncReviewGuideVisibilityV34();};
      setReviewGuideStepV34(1);syncReviewGuideVisibilityV34();

      const precisionPanelV34=$('precisionPanel'),precisionToggleV34=$('togglePrecisionPanel'),precisionBackdropV34=$('precisionPanelBackdrop');
      function setPrecisionPanelOpenV34(open){
        const mobile=window.matchMedia('(max-width: 900px)').matches,value=!!open&&mobile;precisionPanelV34.classList.toggle('mobile-open',value);precisionPanelV34.setAttribute('aria-hidden',String(mobile&&!value));document.body.classList.toggle('precision-panel-open',value);precisionToggleV34.classList.toggle('active',value);precisionToggleV34.setAttribute('aria-expanded',String(value));precisionToggleV34.textContent=value?'Close precision':'Precision';
      }
      precisionToggleV34.onclick=()=>setPrecisionPanelOpenV34(!precisionPanelV34.classList.contains('mobile-open'));
      precisionBackdropV34.onclick=()=>setPrecisionPanelOpenV34(false);
      window.addEventListener('resize',()=>{if(!window.matchMedia('(max-width: 900px)').matches)setPrecisionPanelOpenV34(false);});
      window.addEventListener('keydown',event=>{if(event.key==='Escape'&&precisionPanelV34.classList.contains('mobile-open'))setPrecisionPanelOpenV34(false);});
      setPrecisionPanelOpenV34(false);
