      // Workflow simplification: one-click Photo mode, context-sensitive inspector,
      // compact validation badge, Basic/Advanced wall fields, and one camera lens control.

      if(!document.getElementById('workflowSimplificationStylesV31')){
        const style=document.createElement('style');style.id='workflowSimplificationStylesV31';style.textContent=`
          .app.photo-mode{grid-template-columns:minmax(0,1fr)}
          .app.photo-mode>.panel{display:none!important}
          .app.photo-mode #viewport{grid-column:1/-1}
          .app.photo-mode #statusbar,.app.photo-mode #help{display:none!important}
          .app.photo-mode header #modeMove,.app.photo-mode header #modeRotate,.app.photo-mode header #undo,.app.photo-mode header #redo,.app.photo-mode header #saveJson,.app.photo-mode header #loadJson{display:none!important}
          #photoMode.active{background:var(--sage-dark);border-color:var(--sage)}
          .panel.right>.section.context-hidden{display:none!important}
          .validation-compact{position:sticky;top:0;z-index:8;padding:10px 12px 8px;background:linear-gradient(var(--panel),rgba(34,35,31,.96));border-bottom:1px solid var(--line)}
          .validation-compact button{width:100%;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 10px;text-align:left}
          .validation-compact button::after{content:'▾';color:var(--muted);transform:rotate(-90deg);transition:transform .15s ease}
          .validation-compact button[aria-expanded="true"]::after{transform:rotate(0)}
          .validation-compact button.warn{color:#ffc0b8;border-color:rgba(223,116,104,.6);background:rgba(126,48,42,.22)}
          .validation-compact button.clear{color:#c8e0c1;border-color:rgba(146,165,139,.45)}
          .validation-compact button.off{color:var(--muted)}
          #archAdvancedDetails{margin-top:10px;border:1px solid var(--line);border-radius:9px;background:rgba(0,0,0,.06);overflow:hidden}
          #archAdvancedDetails>summary{cursor:pointer;list-style:none;padding:9px 10px;color:var(--muted);font-size:10px;display:flex;justify-content:space-between;align-items:center;user-select:none}
          #archAdvancedDetails>summary::-webkit-details-marker{display:none}
          #archAdvancedDetails>summary::after{content:'▾';transition:transform .15s ease}
          #archAdvancedDetails:not([open])>summary::after{transform:rotate(-90deg)}
          #archAdvancedDetails[open]>summary{border-bottom:1px solid var(--line);background:rgba(255,255,255,.02)}
          #archAdvancedDetails>.field-grid{padding:10px}
          #architectureBasicGrid{margin-top:10px}
          .right-context-hint{padding:0 15px 10px;color:var(--muted);font-size:10px;line-height:1.4}
        `;document.head.appendChild(style);
      }

      // Perspective depth duplicated FOV/lens. Keep the hidden DOM input for legacy
      // event bindings, but remove it from the visible interface.
      const perspectiveDepthLabelV31=$('depthField')?.closest('label');
      if(perspectiveDepthLabelV31){perspectiveDepthLabelV31.hidden=true;perspectiveDepthLabelV31.style.display='none';}

      // Split architecture editing into a small Basic area and an optional Advanced area.
      const architectureFieldsV31=$('architectureFields'),architectureGridV31=$('archThickness')?.closest('.field-grid');
      let archAdvancedDetailsV31=null,archAdvancedSummaryV31=null;
      if(architectureFieldsV31&&architectureGridV31&&!$('archAdvancedDetails')){
        const basic=document.createElement('div');basic.id='architectureBasicGrid';basic.className='field-grid';
        const labels={
          thickness:$('archThickness')?.closest('label'),height:$('archHeight')?.closest('label'),
          x1:$('archX1')?.closest('label'),y1:$('archY1')?.closest('label'),x2:$('archX2')?.closest('label'),y2:$('archY2')?.closest('label'),
          length:$('archLength')?.closest('label'),rotation:$('archRotation')?.closest('label'),
          openingWidth:$('openingWidth')?.closest('label'),openingOffset:$('openingOffset')?.closest('label')
        };
        architectureGridV31.parentNode.insertBefore(basic,architectureGridV31);
        [labels.length,labels.rotation,labels.openingWidth].filter(Boolean).forEach(label=>basic.appendChild(label));
        const details=document.createElement('details');details.id='archAdvancedDetails';
        const summary=document.createElement('summary');summary.textContent='Advanced wall geometry';
        architectureGridV31.parentNode.insertBefore(details,architectureGridV31);details.append(summary,architectureGridV31);
        archAdvancedDetailsV31=details;archAdvancedSummaryV31=summary;
        try{details.open=localStorage.getItem('bto-layout-studio:architecture-advanced')==='open';}catch{}
        details.addEventListener('toggle',()=>{try{localStorage.setItem('bto-layout-studio:architecture-advanced',details.open?'open':'closed');}catch{}});
      }else{
        archAdvancedDetailsV31=$('archAdvancedDetails');archAdvancedSummaryV31=archAdvancedDetailsV31?.querySelector('summary');
      }

      function syncArchitectureFieldSimplicityV31(){
        const isWall=selectedArchitecture?.kind==='wall';
        const labels={
          thickness:$('archThickness')?.closest('label'),height:$('archHeight')?.closest('label'),
          x1:$('archX1')?.closest('label'),y1:$('archY1')?.closest('label'),x2:$('archX2')?.closest('label'),y2:$('archY2')?.closest('label'),
          length:$('archLength')?.closest('label'),rotation:$('archRotation')?.closest('label'),
          openingWidth:$('openingWidth')?.closest('label'),openingOffset:$('openingOffset')?.closest('label')
        };
        [labels.length,labels.rotation,labels.thickness,labels.x1,labels.y1,labels.x2,labels.y2].filter(Boolean).forEach(label=>label.hidden=!isWall);
        if(labels.openingWidth)labels.openingWidth.hidden=isWall;
        if(labels.openingOffset)labels.openingOffset.hidden=isWall;
        if(labels.height)labels.height.hidden=false;
        if(archAdvancedSummaryV31)archAdvancedSummaryV31.textContent=isWall?'Advanced wall geometry':'Advanced opening placement';
      }

      const populateArchitectureFieldsBeforeV31=populateArchitectureFields;
      populateArchitectureFields=function(kind,item){populateArchitectureFieldsBeforeV31(kind,item);syncArchitectureFieldSimplicityV31();};
      const updateArchitecturePanelBeforeV31=updateArchitecturePanel;
      updateArchitecturePanel=function(){updateArchitecturePanelBeforeV31();syncArchitectureFieldSimplicityV31();syncRightContextV31();};

      // Context-sensitive right inspector. Only the current task panel is visible;
      // validation remains accessible through a compact persistent badge.
      const rightPanelV31=document.querySelector('.panel.right');
      const furnitureSectionV31=$('selectionEmpty')?.closest('.section');
      const wallSectionV31=$('architectureEmpty')?.closest('.section');
      const cameraSectionV31=$('fovField')?.closest('.section');
      const validationSectionV31=$('warningList')?.closest('.section');
      let validationExpandedV31=false;
      const validationCompactV31=document.createElement('div');validationCompactV31.className='validation-compact';
      const validationCompactButtonV31=document.createElement('button');validationCompactButtonV31.type='button';validationCompactButtonV31.id='validationCompactButton';validationCompactButtonV31.setAttribute('aria-expanded','false');validationCompactButtonV31.textContent='Validation · checking';validationCompactV31.appendChild(validationCompactButtonV31);
      if(rightPanelV31&&validationSectionV31)rightPanelV31.insertBefore(validationCompactV31,rightPanelV31.firstChild);

      function validationIssueCountV31(){return $('warningList')?.querySelectorAll('li').length||0;}
      function validationEnabledV31(){return $('toggleValidation')?$('toggleValidation').classList.contains('active'):true;}
      function syncValidationCompactV31(){
        const count=validationIssueCountV31(),enabled=validationEnabledV31();validationCompactButtonV31.classList.toggle('warn',enabled&&count>0);validationCompactButtonV31.classList.toggle('clear',enabled&&count===0);validationCompactButtonV31.classList.toggle('off',!enabled);
        validationCompactButtonV31.textContent=!enabled?'Validation · off':count?`Validation · ${count} issue${count===1?'':'s'}`:'Validation · clear';validationCompactButtonV31.setAttribute('aria-expanded',String(validationExpandedV31));
      }
      function setContextSectionVisibleV31(section,visible){if(section)section.classList.toggle('context-hidden',!visible);}
      function syncRightContextV31(){
        const mode=selected?'furniture':selectedArchitecture?'architecture':'camera';
        setContextSectionVisibleV31(furnitureSectionV31,mode==='furniture');setContextSectionVisibleV31(wallSectionV31,mode==='architecture');setContextSectionVisibleV31(cameraSectionV31,mode==='camera');setContextSectionVisibleV31(validationSectionV31,validationExpandedV31);syncValidationCompactV31();
      }
      validationCompactButtonV31.addEventListener('click',()=>{validationExpandedV31=!validationExpandedV31;syncRightContextV31();});

      const selectBeforeV31=select;
      select=function(mesh){selectBeforeV31(mesh);syncRightContextV31();};
      const selectArchitectureBeforeV31=selectArchitecture;
      selectArchitecture=function(kind,id){selectArchitectureBeforeV31(kind,id);syncArchitectureFieldSimplicityV31();syncRightContextV31();};
      const clearViewportInteractionBeforeV31=clearViewportInteraction;
      clearViewportInteraction=function(){clearViewportInteractionBeforeV31();syncRightContextV31();};
      const updateSelectionPanelBeforeV31=updateSelectionPanel;
      updateSelectionPanel=function(){updateSelectionPanelBeforeV31();syncRightContextV31();};
      const validateBeforeV31=validate;
      validate=function(){const result=validateBeforeV31();syncValidationCompactV31();if(photoModeActiveV31)applyPhotoVisibilityV31();return result;};

      // One-click Photo mode: maximise the viewport and hide all editor-only overlays
      // without changing saved project visibility or validation settings.
      const appV31=document.querySelector('.app'),headerV31=document.querySelector('header');
      const photoModeButtonV31=document.createElement('button');photoModeButtonV31.id='photoMode';photoModeButtonV31.textContent='Photo mode';photoModeButtonV31.title='Hide panels, labels, guides and editing overlays for a clean camera view';
      if(headerV31)headerV31.insertBefore(photoModeButtonV31,$('capture'));
      let photoModeActiveV31=false,photoVisibilitySnapshotV31=null;

      function photoVisibilityTargetsV31(){
        return [
          ['grid',grid],['basemap',basemapGroup],['rooms',roomGroup],['clearances',clearanceGroup],['labels',labelGroup],['architectureLabels',architectureLabelGroup],
          ['selection',selectionOverlayGroup],['transform',transform],['detected',typeof detectedWallHighlightGroupV28!=='undefined'?detectedWallHighlightGroupV28:null],
          ['validation',typeof validationOverlayGroupV28!=='undefined'?validationOverlayGroupV28:null],['carpentryResize',typeof carpentryResizeGroup!=='undefined'?carpentryResizeGroup:null]
        ].filter(([,object])=>object);
      }
      function applyPhotoVisibilityV31(){
        if(!photoModeActiveV31)return;photoVisibilityTargetsV31().forEach(([,object])=>object.visible=false);
      }
      function enterPhotoModeV31(){
        if(photoModeActiveV31)return;photoVisibilitySnapshotV31=new Map(photoVisibilityTargetsV31().map(([,object])=>[object,object.visible]));photoModeActiveV31=true;appV31?.classList.add('photo-mode');photoModeButtonV31.classList.add('active');photoModeButtonV31.textContent='Exit photo';document.activeElement?.blur?.();applyPhotoVisibilityV31();requestAnimationFrame(()=>resize());
      }
      function exitPhotoModeV31(){
        if(!photoModeActiveV31)return;photoModeActiveV31=false;appV31?.classList.remove('photo-mode');photoModeButtonV31.classList.remove('active');photoModeButtonV31.textContent='Photo mode';photoVisibilitySnapshotV31?.forEach((visible,object)=>object.visible=visible);photoVisibilitySnapshotV31=null;if(typeof updateDetectedWallHighlightsV28==='function')updateDetectedWallHighlightsV28(false);validate();scheduleEyeLabelCleanup();requestAnimationFrame(()=>resize());
      }
      photoModeButtonV31.addEventListener('click',()=>photoModeActiveV31?exitPhotoModeV31():enterPhotoModeV31());
      window.addEventListener('keydown',event=>{if(photoModeActiveV31&&event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();exitPhotoModeV31();}},true);

      const buildSceneBeforeV31=buildScene;
      buildScene=function(){buildSceneBeforeV31();syncArchitectureFieldSimplicityV31();syncRightContextV31();if(photoModeActiveV31)applyPhotoVisibilityV31();};

      syncArchitectureFieldSimplicityV31();syncRightContextV31();syncValidationCompactV31();
