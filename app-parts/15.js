      // Camera cutaway controls. Walls remain in the project model and collision checks;
      // only their viewport/export rendering is faded or hidden.
      const cameraCutawayRaycaster=new THREE.Raycaster(),cameraCutawayMaterialBase=new WeakMap(),cameraCutawayVisibleBase=new WeakMap();
      let cameraCutawayScheduled=false,cameraCutawayWallIds=new Set(),cutawayOpacitySnapshot=null;

      function ensureCameraCutawaySettings(){
        project.settings=project.settings||{};
        project.settings.cameraCutaway=project.settings.cameraCutaway||{};
        const settings=project.settings.cameraCutaway;
        if(settings.enabled===undefined)settings.enabled=false;
        if(!['fade','hide'].includes(settings.style))settings.style='fade';
        settings.opacity=Math.max(.03,Math.min(.6,+settings.opacity||.15));
        settings.depth=Math.max(100,Math.min(6000,+settings.depth||1200));
        settings.hiddenWallIds=Array.isArray(settings.hiddenWallIds)?[...new Set(settings.hiddenWallIds.filter(Boolean))]:[];
        return settings;
      }

      const cameraSection=$('fovField')?.closest('.section');
      if(cameraSection&&!$('cameraCutawayControls')){
        const controls=document.createElement('div');controls.id='cameraCutawayControls';controls.style.marginTop='14px';
        controls.innerHTML=`
          <h2 style="margin-top:0">Camera visibility</h2>
          <div class="field-grid">
            <label class="inline-check wide"><input id="autoCutaway" type="checkbox" /> Auto-hide blocking walls</label>
            <label>Cutaway style<select id="cutawayStyle"><option value="fade">Fade</option><option value="hide">Hide</option></select></label>
            <label>Wall opacity<input id="cutawayOpacity" type="range" min="3" max="60" step="1" value="15" /></label>
            <label class="wide">Cutaway depth (mm)<input id="cutawayDepth" type="number" min="100" max="6000" step="100" value="1200" /></label>
          </div>
          <div class="button-row" style="margin-top:10px">
            <button id="hideSelectedCameraWall">Hide selected wall</button>
            <button id="showAllCameraWalls">Show all walls</button>
          </div>
          <p class="small" id="cameraCutawayStatus">Cutaway is off. Walls remain part of the model and validation.</p>`;
        cameraSection.insertBefore(controls,cameraSection.lastElementChild);
      }

      function syncCameraCutawayControls(){
        const settings=ensureCameraCutawaySettings();
        if($('autoCutaway'))$('autoCutaway').checked=!!settings.enabled;
        if($('cutawayStyle'))$('cutawayStyle').value=settings.style;
        if($('cutawayOpacity'))$('cutawayOpacity').value=Math.round(settings.opacity*100);
        if($('cutawayDepth'))$('cutawayDepth').value=Math.round(settings.depth);
        const wallId=selectedCameraWallId();
        if($('hideSelectedCameraWall'))$('hideSelectedCameraWall').disabled=!wallId;
        if($('showAllCameraWalls'))$('showAllCameraWalls').disabled=!settings.hiddenWallIds.length;
      }

      function selectedCameraWallId(){
        if(!selectedArchitecture)return null;
        if(selectedArchitecture.kind==='wall')return selectedArchitecture.id;
        const opening=(project.openings||[]).find(item=>item.id===selectedArchitecture.id);
        return opening?.wallId||null;
      }

      function rememberCutawayBase(mesh){
        if(!cameraCutawayVisibleBase.has(mesh))cameraCutawayVisibleBase.set(mesh,mesh.visible);
        const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
        materials.filter(Boolean).forEach(material=>{
          if(!cameraCutawayMaterialBase.has(material))cameraCutawayMaterialBase.set(material,{opacity:material.opacity,transparent:material.transparent,depthWrite:material.depthWrite});
        });
      }

      function restoreCutawayMesh(mesh){
        rememberCutawayBase(mesh);mesh.visible=cameraCutawayVisibleBase.get(mesh);
        const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
        materials.filter(Boolean).forEach(material=>{const base=cameraCutawayMaterialBase.get(material);material.opacity=base.opacity;material.transparent=base.transparent;material.depthWrite=base.depthWrite;material.needsUpdate=true;});
      }

      function fadeCutawayMesh(mesh,opacity){
        rememberCutawayBase(mesh);mesh.visible=true;
        const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
        materials.filter(Boolean).forEach(material=>{const base=cameraCutawayMaterialBase.get(material);material.transparent=true;material.opacity=Math.min(base.opacity,opacity);material.depthWrite=false;material.needsUpdate=true;});
      }

      function automaticBlockingWallIds(settings){
        const ids=new Set(),ceilingHeight=project.settings?.ceilingHeight||2600,cameraHeight=camera.position.y/MM;
        if(!settings.enabled||cameraHeight>ceilingHeight+1400)return ids;
        const wallMeshes=shellGroup.children.filter(mesh=>mesh.userData?.wall);
        if(!wallMeshes.length)return ids;
        camera.updateMatrixWorld();
        const origin=camera.position.clone(),centre=orbit.target.clone(),centreVector=centre.clone().sub(origin),centreDistance=centreVector.length();
        if(centreDistance<.15)return ids;
        const right=new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion),up=new THREE.Vector3(0,1,0).applyQuaternion(camera.quaternion);
        const halfHeight=Math.max(.3,Math.min(1.25,Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*centreDistance*.38));
        const halfWidth=Math.max(.45,Math.min(1.8,halfHeight*Math.max(.8,camera.aspect)));
        const targets=[centre.clone()];
        [-1,1].forEach(s=>{targets.push(centre.clone().addScaledVector(right,halfWidth*s));targets.push(centre.clone().addScaledVector(up,halfHeight*s));});
        [-1,1].forEach(x=>[-1,1].forEach(y=>targets.push(centre.clone().addScaledVector(right,halfWidth*x*.72).addScaledVector(up,halfHeight*y*.72))));
        const maxDepth=mm(settings.depth);
        targets.forEach(target=>{
          const direction=target.clone().sub(origin),distance=direction.length();if(distance<.1)return;
          cameraCutawayRaycaster.set(origin,direction.normalize());cameraCutawayRaycaster.near=.02;cameraCutawayRaycaster.far=Math.max(.03,Math.min(distance-.04,maxDepth));
          cameraCutawayRaycaster.intersectObjects(wallMeshes,false).forEach(hit=>{if(hit.distance<=cameraCutawayRaycaster.far+.01&&hit.object.userData?.id)ids.add(hit.object.userData.id);});
        });
        return ids;
      }

      function applyCameraCutaway(){
        const settings=ensureCameraCutawaySettings(),manual=new Set(settings.hiddenWallIds),wallMeshes=shellGroup.children.filter(mesh=>mesh.userData?.wall);
        wallMeshes.forEach(restoreCutawayMesh);openingGroup.children.forEach(restoreCutawayMesh);
        const automatic=automaticBlockingWallIds(settings),affected=new Set([...manual,...automatic]);cameraCutawayWallIds=affected;
        wallMeshes.forEach(mesh=>{
          const wallId=mesh.userData.id;if(!affected.has(wallId))return;
          if(manual.has(wallId)||settings.style==='hide')mesh.visible=false;else fadeCutawayMesh(mesh,settings.opacity);
        });
        openingGroup.children.forEach(mesh=>{
          const wallId=mesh.userData?.wallId;if(!wallId||!affected.has(wallId))return;
          if(manual.has(wallId)||settings.style==='hide')mesh.visible=false;else fadeCutawayMesh(mesh,Math.min(settings.opacity,.22));
        });
        architectureLabelGroup.children.forEach(label=>{const ids=label.userData?.ignoreIds||[];label.visible=!ids.some(id=>affected.has(id));});
        const status=$('cameraCutawayStatus');
        if(status){
          const autoCount=automatic.size,manualCount=manual.size;
          status.textContent=!settings.enabled&&!manualCount?'Cutaway is off. Walls remain part of the model and validation.':`${autoCount?`${autoCount} blocking wall${autoCount===1?'':'s'} ${settings.style==='hide'?'hidden':'faded'}`:'No automatic blocking wall'}${manualCount?` · ${manualCount} manually hidden`:''}. PNG export uses this view.`;
        }
        syncCameraCutawayControls();
      }

      function scheduleCameraCutaway(){
        if(cameraCutawayScheduled)return;cameraCutawayScheduled=true;requestAnimationFrame(()=>{cameraCutawayScheduled=false;applyCameraCutaway();});
      }

      function updateCutawaySetting(label,mutator){
        pushHistory(label);const settings=ensureCameraCutawaySettings();mutator(settings);applyCameraCutaway();
      }

      function armCutawayOpacityHistory(){if(!cutawayOpacitySnapshot)cutawayOpacitySnapshot=JSON.stringify(project);}
      function commitCutawayOpacityHistory(){
        if(!cutawayOpacitySnapshot)return;const changed=cutawayOpacitySnapshot!==JSON.stringify(project);
        if(changed){undoStack.push(cutawayOpacitySnapshot);if(undoStack.length>60)undoStack.shift();redoStack.length=0;$('undo').disabled=false;$('redo').disabled=true;$('undo').title='Undo change cutaway opacity';}
        cutawayOpacitySnapshot=null;
      }

      if($('autoCutaway'))$('autoCutaway').onchange=()=>updateCutawaySetting('toggle camera cutaway',settings=>settings.enabled=$('autoCutaway').checked);
      if($('cutawayStyle'))$('cutawayStyle').onchange=()=>updateCutawaySetting('change cutaway style',settings=>settings.style=$('cutawayStyle').value);
      if($('cutawayOpacity')){
        $('cutawayOpacity').oninput=()=>{armCutawayOpacityHistory();const settings=ensureCameraCutawaySettings();settings.opacity=Math.max(.03,Math.min(.6,+$('cutawayOpacity').value/100));applyCameraCutaway();};
        $('cutawayOpacity').onchange=commitCutawayOpacityHistory;$('cutawayOpacity').onblur=commitCutawayOpacityHistory;
      }
      if($('cutawayDepth'))$('cutawayDepth').onchange=()=>updateCutawaySetting('change cutaway depth',settings=>settings.depth=Math.max(100,Math.min(6000,+$('cutawayDepth').value||1200)));
      if($('hideSelectedCameraWall'))$('hideSelectedCameraWall').onclick=()=>{
        const wallId=selectedCameraWallId();if(!wallId)return;updateCutawaySetting('hide wall for camera',settings=>{if(!settings.hiddenWallIds.includes(wallId))settings.hiddenWallIds.push(wallId);});
      };
      if($('showAllCameraWalls'))$('showAllCameraWalls').onclick=()=>updateCutawaySetting('show all camera walls',settings=>settings.hiddenWallIds=[]);

      orbit.addEventListener('change',scheduleCameraCutaway);

      const normalizeProjectBeforeCameraCutaway=normalizeProject;
      normalizeProject=function(){normalizeProjectBeforeCameraCutaway();ensureCameraCutawaySettings();};
      if(typeof normalizeProjectV27==='function'){
        const normalizeProjectV27BeforeCameraCutaway=normalizeProjectV27;
        normalizeProjectV27=function(){normalizeProjectV27BeforeCameraCutaway();ensureCameraCutawaySettings();};
      }
      const buildSceneBeforeCameraCutaway=buildScene;
      buildScene=function(){buildSceneBeforeCameraCutaway();syncCameraCutawayControls();scheduleCameraCutaway();};
      const updateArchitecturePanelBeforeCameraCutaway=updateArchitecturePanel;
      updateArchitecturePanel=function(){updateArchitecturePanelBeforeCameraCutaway();syncCameraCutawayControls();};
      const selectArchitectureBeforeCameraCutaway=selectArchitecture;
      selectArchitecture=function(kind,id){selectArchitectureBeforeCameraCutaway(kind,id);syncCameraCutawayControls();};
      const clearViewportInteractionBeforeCameraCutaway=clearViewportInteraction;
      clearViewportInteraction=function(){clearViewportInteractionBeforeCameraCutaway();syncCameraCutawayControls();};

      ensureCameraCutawaySettings();syncCameraCutawayControls();scheduleCameraCutaway();
