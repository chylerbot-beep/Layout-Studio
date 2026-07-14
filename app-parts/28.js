      // Photo-mode camera popup and camera-specific furniture visibility. Settings are
      // additive and do not alter furniture geometry, collisions or validation.
      if(!document.getElementById('photoCameraFurnitureStylesV42')){
        const style=document.createElement('style');style.id='photoCameraFurnitureStylesV42';style.textContent=`
          .app.photo-mode>.panel.left{display:none!important}
          .app.photo-mode>.panel.right{display:block!important;position:fixed;top:70px;right:12px;bottom:12px;width:min(310px,calc(100vw - 24px));z-index:58;border:1px solid var(--line);border-radius:12px;box-shadow:0 18px 55px rgba(0,0,0,.38);background:var(--panel)}
          .app.photo-mode>.panel.right .validation-compact{display:none!important}
          .app.photo-mode>.panel.right>.section.context-hidden{display:none!important}
          .app.photo-mode>.panel.right>.section:not(.context-hidden){display:block!important}
          #cameraFurnitureControls{margin-top:14px}
          #selectedFurnitureVisibility{margin-top:10px;padding-top:10px;border-top:1px solid var(--line)}
          @media(max-width:700px){.app.photo-mode>.panel.right{top:64px;right:8px;bottom:8px;width:min(300px,calc(100vw - 16px))}}
        `;document.head.appendChild(style);
      }

      function ensureCameraFurnitureSettingsV42(){
        project.settings=project.settings||{};
        project.settings.cameraFurniture=project.settings.cameraFurniture||{};
        const settings=project.settings.cameraFurniture;
        if(settings.enabled===undefined)settings.enabled=false;
        settings.depth=Math.max(100,Math.min(6000,+settings.depth||1200));
        settings.hiddenIds=Array.isArray(settings.hiddenIds)?[...new Set(settings.hiddenIds.filter(Boolean))]:[];
        settings.shownIds=Array.isArray(settings.shownIds)?[...new Set(settings.shownIds.filter(Boolean))]:[];
        return settings;
      }

      function expandSupportedFurnitureIdsV42(source){
        const ids=new Set(source);let changed=true;
        while(changed){
          changed=false;
          (project.furniture||[]).forEach(item=>{if(item.supportId&&ids.has(item.supportId)&&!ids.has(item.id)){ids.add(item.id);changed=true;}});
        }
        return ids;
      }

      function automaticHiddenFurnitureIdsV42(settings){
        const ids=new Set();
        if(!settings.enabled)return ids;
        camera.updateMatrixWorld();
        const forward=new THREE.Vector3();camera.getWorldDirection(forward);
        const maxDistance=mm(settings.depth),box=new THREE.Box3(),centre=new THREE.Vector3();
        furnitureGroup.children.forEach(mesh=>{
          box.setFromObject(mesh);box.getCenter(centre);
          const toward=centre.clone().sub(camera.position);
          if(toward.dot(forward)<=0)return;
          if(box.distanceToPoint(camera.position)<=maxDistance)ids.add(mesh.userData.id);
        });
        return ids;
      }

      function hiddenFurnitureIdsV42(){
        const settings=ensureCameraFurnitureSettingsV42();
        const affected=expandSupportedFurnitureIdsV42(new Set([...settings.hiddenIds,...automaticHiddenFurnitureIdsV42(settings)]));
        expandSupportedFurnitureIdsV42(new Set(settings.shownIds)).forEach(id=>affected.delete(id));
        return affected;
      }

      function applyCameraFurnitureVisibilityV42(){
        const settings=ensureCameraFurnitureSettingsV42(),hidden=hiddenFurnitureIdsV42();
        furnitureGroup.children.forEach(mesh=>{mesh.visible=!hidden.has(mesh.userData.id);});
        const status=$('cameraFurnitureStatus');
        if(status){
          const automatic=automaticHiddenFurnitureIdsV42(settings).size,manual=settings.hiddenIds.length;
          status.textContent=!settings.enabled&&!manual?'All furniture is visible.':`${automatic?`${automatic} nearby object${automatic===1?'':'s'} hidden automatically`:'No nearby furniture hidden'}${manual?` · ${manual} manually hidden`:''}. Hidden objects remain in project data and validation.`;
        }
        syncCameraFurnitureControlsV42(hidden);
      }

      let cameraFurnitureScheduledV42=false;
      function scheduleCameraFurnitureVisibilityV42(){
        if(cameraFurnitureScheduledV42)return;cameraFurnitureScheduledV42=true;
        requestAnimationFrame(()=>{cameraFurnitureScheduledV42=false;applyCameraFurnitureVisibilityV42();});
      }

      function syncCameraFurnitureControlsV42(hidden=hiddenFurnitureIdsV42()){
        const settings=ensureCameraFurnitureSettingsV42(),selectedId=selected?.userData?.id;
        if($('autoHideFurniture'))$('autoHideFurniture').checked=!!settings.enabled;
        if($('furnitureHideDistance'))$('furnitureHideDistance').value=Math.round(settings.depth);
        if($('hideSelectedFurniture'))$('hideSelectedFurniture').disabled=!selectedId||hidden.has(selectedId);
        if($('showSelectedFurniture'))$('showSelectedFurniture').disabled=!selectedId||!hidden.has(selectedId);
        if($('showAllFurniture'))$('showAllFurniture').disabled=!settings.enabled&&!settings.hiddenIds.length&&!settings.shownIds.length;
        if($('showAllFurnitureSelected'))$('showAllFurnitureSelected').disabled=!settings.enabled&&!settings.hiddenIds.length&&!settings.shownIds.length;
      }

      function updateCameraFurnitureSettingV42(label,mutator){
        pushHistory(label);mutator(ensureCameraFurnitureSettingsV42());applyCameraFurnitureVisibilityV42();
      }

      const rightPanelV42=$('precisionPanel'),cameraSectionV42=$('fovField')?.closest('.section'),furnitureSectionV42=$('selectionEmpty')?.closest('.section');
      const wallSectionV42=$('architectureEmpty')?.closest('.section'),validationSectionV42=$('warningList')?.closest('.section');
      if(rightPanelV42&&cameraSectionV42){
        const firstSection=rightPanelV42.querySelector(':scope > .section');
        if(firstSection!==cameraSectionV42)rightPanelV42.insertBefore(cameraSectionV42,firstSection);
      }
      if(cameraSectionV42&&!$('cameraFurnitureControls')){
        const controls=document.createElement('div');controls.id='cameraFurnitureControls';controls.innerHTML=`
          <h2>Furniture visibility</h2>
          <div class="field-grid">
            <label class="inline-check wide"><input id="autoHideFurniture" type="checkbox" /> Auto-hide nearby furniture</label>
            <label class="wide">Hide distance (mm)<input id="furnitureHideDistance" type="number" min="100" max="6000" step="100" value="1200" /></label>
          </div>
          <div class="button-row" style="margin-top:10px"><button id="showAllFurniture">Show all furniture</button></div>
          <p class="small" id="cameraFurnitureStatus">All furniture is visible.</p>`;
        const blocking=$('cameraCutawayControls');
        if(blocking)blocking.insertAdjacentElement('afterend',controls);else cameraSectionV42.appendChild(controls);
      }
      if($('selectionFields')&&!$('selectedFurnitureVisibility')){
        const controls=document.createElement('div');controls.id='selectedFurnitureVisibility';controls.innerHTML=`
          <div class="button-row">
            <button id="hideSelectedFurniture">Hide furniture</button>
            <button id="showSelectedFurniture">Show furniture</button>
            <button id="showAllFurnitureSelected">Show all furniture</button>
          </div>`;
        $('selectionFields').appendChild(controls);
      }

      $('autoHideFurniture').onchange=()=>updateCameraFurnitureSettingV42('toggle automatic furniture hiding',settings=>settings.enabled=$('autoHideFurniture').checked);
      $('furnitureHideDistance').onchange=()=>updateCameraFurnitureSettingV42('change furniture hide distance',settings=>settings.depth=Math.max(100,Math.min(6000,+$('furnitureHideDistance').value||1200)));
      $('hideSelectedFurniture').onclick=()=>{
        const id=selected?.userData?.id;if(!id)return;
        updateCameraFurnitureSettingV42('hide furniture for camera',settings=>{if(!settings.hiddenIds.includes(id))settings.hiddenIds.push(id);settings.shownIds=settings.shownIds.filter(item=>item!==id);});
        transform.detach();
      };
      $('showSelectedFurniture').onclick=()=>{
        const id=selected?.userData?.id;if(!id)return;
        updateCameraFurnitureSettingV42('show furniture for camera',settings=>{settings.hiddenIds=settings.hiddenIds.filter(item=>item!==id);if(!settings.shownIds.includes(id))settings.shownIds.push(id);});
      };
      const showAllFurnitureV42=()=>updateCameraFurnitureSettingV42('show all furniture',settings=>{settings.enabled=false;settings.hiddenIds=[];settings.shownIds=[];});
      $('showAllFurniture').onclick=showAllFurnitureV42;
      $('showAllFurnitureSelected').onclick=showAllFurnitureV42;

      const syncRightContextBeforePhotoCameraV42=syncRightContextV31;
      syncRightContextV31=function(){
        syncRightContextBeforePhotoCameraV42();
        if(photoModeActiveV31){
          cameraSectionV42?.classList.remove('context-hidden');
          furnitureSectionV42?.classList.toggle('context-hidden',!selected);
          wallSectionV42?.classList.add('context-hidden');
          validationSectionV42?.classList.add('context-hidden');
        }
        syncCameraFurnitureControlsV42();
      };

      const enterPhotoModeBeforeCameraV42=enterPhotoModeV31;
      enterPhotoModeV31=function(){enterPhotoModeBeforeCameraV42();syncRightContextV31();applyCameraFurnitureVisibilityV42();};
      const exitPhotoModeBeforeCameraV42=exitPhotoModeV31;
      exitPhotoModeV31=function(){exitPhotoModeBeforeCameraV42();syncRightContextV31();applyCameraFurnitureVisibilityV42();};

      const selectBeforeCameraFurnitureV42=select;
      select=function(mesh){selectBeforeCameraFurnitureV42(mesh);syncRightContextV31();syncCameraFurnitureControlsV42();};
      const buildSceneBeforeCameraFurnitureV42=buildScene;
      buildScene=function(){buildSceneBeforeCameraFurnitureV42();applyCameraFurnitureVisibilityV42();};
      const normalizeProjectBeforeCameraFurnitureV42=normalizeProject;
      normalizeProject=function(){normalizeProjectBeforeCameraFurnitureV42();ensureCameraFurnitureSettingsV42();};
      if(typeof normalizeProjectV27==='function'){
        const normalizeProjectV27BeforeCameraFurnitureV42=normalizeProjectV27;
        normalizeProjectV27=function(){normalizeProjectV27BeforeCameraFurnitureV42();ensureCameraFurnitureSettingsV42();};
      }
      orbit.addEventListener('change',scheduleCameraFurnitureVisibilityV42);

      ensureCameraFurnitureSettingsV42();syncRightContextV31();applyCameraFurnitureVisibilityV42();
