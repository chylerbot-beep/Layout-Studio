      // Eye-level photo label cleanup: hide occluded labels, keep a consistent
      // screen size, and suppress overlapping labels without changing project geometry.
      let eyeLabelCleanupScheduled=false;
      const eyeLabelScreenSize=new THREE.Vector2();

      function ensureEyeLabelSettings(){
        project.settings=project.settings||{};
        project.settings.eyeLevelLabels=project.settings.eyeLevelLabels||{};
        const settings=project.settings.eyeLevelLabels;
        if(settings.enabled===undefined)settings.enabled=true;
        if(settings.hideOccluded===undefined)settings.hideOccluded=true;
        if(settings.declutter===undefined)settings.declutter=true;
        settings.sizePx=Math.max(12,Math.min(30,+settings.sizePx||18));
        settings.maxVisible=Math.max(4,Math.min(40,+settings.maxVisible||16));
        return settings;
      }

      const makeLabelSpriteBeforeEyeCleanup=makeLabelSprite;
      makeLabelSprite=function(text,position,footprint,targetIds=[]){
        const sprite=makeLabelSpriteBeforeEyeCleanup(text,position,footprint,targetIds);
        sprite.userData.labelText=text;
        sprite.userData.baseLabelScale=[sprite.scale.x,sprite.scale.y,sprite.scale.z];
        sprite.userData.baseLabelAspect=sprite.scale.x/Math.max(.001,sprite.scale.y);
        return sprite;
      };

      const eyeLabelHost=$('cameraCutawayControls')||$('fovField')?.closest('.section');
      if(eyeLabelHost&&!$('eyeLabelCleanupControls')){
        const panel=document.createElement('div');panel.id='eyeLabelCleanupControls';panel.style.marginTop='14px';
        panel.innerHTML=`
          <h2 style="margin-top:0">Eye-level labels</h2>
          <div class="field-grid">
            <label class="inline-check wide"><input id="cleanEyeLabels" type="checkbox" checked /> Photo label cleanup</label>
            <label class="inline-check wide"><input id="hideOccludedEyeLabels" type="checkbox" checked /> Hide labels behind walls and objects</label>
            <label class="inline-check wide"><input id="declutterEyeLabels" type="checkbox" checked /> Hide overlapping labels</label>
            <label>Label size (px)<input id="eyeLabelSize" type="number" min="12" max="30" step="1" value="18" /></label>
            <label>Maximum visible<input id="eyeLabelMax" type="number" min="4" max="40" step="1" value="16" /></label>
          </div>
          <p class="small" id="eyeLabelCleanupStatus">Eye-level cleanup keeps nearby, unobstructed labels and removes overlaps for cleaner screenshots.</p>`;
        eyeLabelHost.appendChild(panel);
      }

      function isEyeLevelLabelMode(){
        return !!$('viewEye')?.classList.contains('active')&&camera.position.y/MM<4200;
      }

      function syncEyeLabelControls(){
        const settings=ensureEyeLabelSettings();
        if($('cleanEyeLabels'))$('cleanEyeLabels').checked=!!settings.enabled;
        if($('hideOccludedEyeLabels'))$('hideOccludedEyeLabels').checked=!!settings.hideOccluded;
        if($('declutterEyeLabels'))$('declutterEyeLabels').checked=!!settings.declutter;
        if($('eyeLabelSize'))$('eyeLabelSize').value=Math.round(settings.sizePx);
        if($('eyeLabelMax'))$('eyeLabelMax').value=Math.round(settings.maxVisible);
      }

      function restoreLabelScale(label){
        const base=label.userData.baseLabelScale;
        if(base)label.scale.set(base[0],base[1],base[2]);
      }

      function setEyeLabelScreenScale(label,sizePx){
        renderer.getSize(eyeLabelScreenSize);
        const renderHeight=Math.max(1,eyeLabelScreenSize.y),distance=Math.max(.15,camera.position.distanceTo(label.position));
        const worldHeight=2*distance*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*sizePx/renderHeight;
        const aspect=label.userData.baseLabelAspect||4;
        label.scale.set(worldHeight*aspect,worldHeight,1);
      }

      function labelTargetIds(label){return label.userData.ignoreIds||[];}
      function labelPriority(label){
        const ids=labelTargetIds(label),selectedId=selected?.userData?.id,architectureId=selectedArchitecture?.id;
        if(ids.includes(selectedId)||ids.includes(architectureId))return 100000;
        const furniture=ids.some(id=>(project.furniture||[]).some(item=>item.id===id));
        const opening=ids.some(id=>(project.openings||[]).some(item=>item.id===id));
        const distance=camera.position.distanceTo(label.position);
        return (furniture?5000:opening?4000:3000)-distance*120;
      }

      function labelScreenRect(label){
        const projected=label.position.clone().project(camera);
        if(projected.z<-1||projected.z>1||Math.abs(projected.x)>1.18||Math.abs(projected.y)>1.18)return null;
        renderer.getSize(eyeLabelScreenSize);const width=eyeLabelScreenSize.x,height=eyeLabelScreenSize.y;
        const cx=(projected.x*.5+.5)*width,cy=(-projected.y*.5+.5)*height;
        const pixelHeight=Math.max(8,ensureEyeLabelSettings().sizePx),pixelWidth=Math.min(280,pixelHeight*(label.userData.baseLabelAspect||4));
        return{left:cx-pixelWidth/2,right:cx+pixelWidth/2,top:cy-pixelHeight/2,bottom:cy+pixelHeight/2,cx,cy};
      }

      function screenRectsOverlap(a,b,padding=6){
        return !(a.right+padding<=b.left||b.right+padding<=a.left||a.bottom+padding<=b.top||b.bottom+padding<=a.top);
      }

      function labelBlocked(label,targets){
        const direction=label.position.clone().sub(camera.position),distance=direction.length();
        if(distance<.05)return false;
        labelRaycaster.set(camera.position,direction.normalize());labelRaycaster.near=.02;labelRaycaster.far=Math.max(.03,distance-.045);
        const ignore=new Set(labelTargetIds(label));
        return labelRaycaster.intersectObjects(targets,true).some(hit=>{
          const id=hit.object.userData.objectId||hit.object.userData.id;
          return hit.distance<distance-.045&&!ignore.has(id);
        });
      }

      function updateEyeLevelLabelCleanup(){
        if(!labelVisible)return;
        scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);
        const settings=ensureEyeLabelSettings(),eyeMode=isEyeLevelLabelMode()&&settings.enabled;
        const labels=[...labelGroup.children,...architectureLabelGroup.children];
        const targets=[
          ...(shellGroup.visible?shellGroup.children.filter(item=>item.visible!==false):[]),
          ...(openingGroup.visible?openingGroup.children.filter(item=>item.visible!==false):[]),
          ...(furnitureGroup.visible?furnitureGroup.children.filter(item=>item.visible!==false):[]),
          ...(ceilingGroup.visible?ceilingGroup.children.filter(item=>item.visible!==false):[])
        ];
        let hiddenOccluded=0,hiddenOverlap=0,hiddenCutaway=0,visibleCount=0;
        const candidates=[];

        labels.forEach(label=>{
          const ids=labelTargetIds(label),hiddenByCutaway=typeof cameraCutawayWallIds!=='undefined'&&ids.some(id=>cameraCutawayWallIds.has(id));
          restoreLabelScale(label);label.visible=true;
          if(hiddenByCutaway){label.visible=false;hiddenCutaway++;return;}
          if(!eyeMode){
            const blocked=labelBlocked(label,targets),wanted=blocked?label.userData.blockedColor:label.userData.normalColor;
            if(label.material.color.getHex()!==wanted)label.material.color.setHex(wanted);
            return;
          }
          label.material.color.setHex(label.userData.normalColor);
          setEyeLabelScreenScale(label,settings.sizePx);
          const rect=labelScreenRect(label);
          if(!rect){label.visible=false;return;}
          if(settings.hideOccluded&&labelBlocked(label,targets)){label.visible=false;hiddenOccluded++;return;}
          candidates.push({label,rect,priority:labelPriority(label),distance:camera.position.distanceTo(label.position)});
        });

        if(eyeMode){
          candidates.sort((a,b)=>b.priority-a.priority||a.distance-b.distance);
          const accepted=[];
          candidates.forEach(entry=>{
            const selectedLabel=entry.priority>=100000;
            const overlap=settings.declutter&&accepted.some(other=>screenRectsOverlap(entry.rect,other.rect));
            const overLimit=accepted.length>=settings.maxVisible&&!selectedLabel;
            if((overlap||overLimit)&&!selectedLabel){entry.label.visible=false;hiddenOverlap++;return;}
            entry.label.visible=true;accepted.push(entry);visibleCount++;
          });
        }

        const status=$('eyeLabelCleanupStatus');
        if(status){
          status.textContent=!eyeMode?'Eye-level cleanup activates automatically in Eye level view.':`${visibleCount} label${visibleCount===1?'':'s'} visible · ${hiddenOccluded} occluded · ${hiddenOverlap} overlapping${hiddenCutaway?` · ${hiddenCutaway} on cutaway walls`:''}.`;
        }
      }

      updateLabelOcclusion=updateEyeLevelLabelCleanup;

      function scheduleEyeLabelCleanup(){
        if(eyeLabelCleanupScheduled)return;eyeLabelCleanupScheduled=true;
        requestAnimationFrame(()=>{eyeLabelCleanupScheduled=false;updateEyeLevelLabelCleanup();});
      }

      function updateEyeLabelSetting(label,mutator){
        pushHistory(label);const settings=ensureEyeLabelSettings();mutator(settings);syncEyeLabelControls();scheduleEyeLabelCleanup();
      }

      if($('cleanEyeLabels'))$('cleanEyeLabels').onchange=()=>updateEyeLabelSetting('toggle eye-level label cleanup',settings=>settings.enabled=$('cleanEyeLabels').checked);
      if($('hideOccludedEyeLabels'))$('hideOccludedEyeLabels').onchange=()=>updateEyeLabelSetting('toggle eye-level label occlusion',settings=>settings.hideOccluded=$('hideOccludedEyeLabels').checked);
      if($('declutterEyeLabels'))$('declutterEyeLabels').onchange=()=>updateEyeLabelSetting('toggle eye-level label declutter',settings=>settings.declutter=$('declutterEyeLabels').checked);
      if($('eyeLabelSize'))$('eyeLabelSize').onchange=()=>updateEyeLabelSetting('change eye-level label size',settings=>settings.sizePx=Math.max(12,Math.min(30,+$('eyeLabelSize').value||18)));
      if($('eyeLabelMax'))$('eyeLabelMax').onchange=()=>updateEyeLabelSetting('change eye-level label limit',settings=>settings.maxVisible=Math.max(4,Math.min(40,+$('eyeLabelMax').value||16)));

      const viewTopBeforeEyeLabels=viewTop,viewBirdBeforeEyeLabels=viewBird,viewEyeBeforeEyeLabels=viewEye;
      viewTop=function(){viewTopBeforeEyeLabels();scheduleEyeLabelCleanup();};
      viewBird=function(){viewBirdBeforeEyeLabels();scheduleEyeLabelCleanup();};
      viewEye=function(){viewEyeBeforeEyeLabels();scheduleEyeLabelCleanup();};
      orbit.addEventListener('change',scheduleEyeLabelCleanup);

      const normalizeProjectBeforeEyeLabels=normalizeProject;
      normalizeProject=function(){normalizeProjectBeforeEyeLabels();ensureEyeLabelSettings();};
      if(typeof normalizeProjectV27==='function'){
        const normalizeProjectV27BeforeEyeLabels=normalizeProjectV27;
        normalizeProjectV27=function(){normalizeProjectV27BeforeEyeLabels();ensureEyeLabelSettings();};
      }
      const buildSceneBeforeEyeLabels=buildScene;
      buildScene=function(){buildSceneBeforeEyeLabels();syncEyeLabelControls();scheduleEyeLabelCleanup();};

      // Recalculate label size and decluttering at export resolution, then restore the
      // viewport cleanup after the PNG is created.
      capturePng=function(){
        const [w,h]=$('capturePreset').value.split('x').map(Number),oldSize=new THREE.Vector2();renderer.getSize(oldSize);
        const oldBg=scene.background,oldGrid=grid.visible,oldClear=clearanceGroup.visible,oldTransform=transform.visible,oldOverlay=selectionOverlayGroup.visible;
        const oldResize=typeof carpentryResizeGroup!=='undefined'?carpentryResizeGroup.visible:null;
        if($('captureBackground').value==='transparent')scene.background=null;
        grid.visible=false;clearanceGroup.visible=false;transform.visible=false;selectionOverlayGroup.visible=false;if(oldResize!==null)carpentryResizeGroup.visible=false;
        renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
        if(typeof applyCameraCutaway==='function')applyCameraCutaway();updateEyeLevelLabelCleanup();renderer.render(scene,camera);
        renderer.domElement.toBlob(blob=>{
          if(blob)downloadBlob(blob,projectDownloadName('png'));
          renderer.setSize(oldSize.x,oldSize.y,false);camera.aspect=oldSize.x/oldSize.y;camera.updateProjectionMatrix();scene.background=oldBg;grid.visible=oldGrid;clearanceGroup.visible=oldClear;transform.visible=oldTransform;selectionOverlayGroup.visible=oldOverlay;if(oldResize!==null)carpentryResizeGroup.visible=oldResize;
          if(typeof applyCameraCutaway==='function')applyCameraCutaway();updateEyeLevelLabelCleanup();$('captureModal').classList.remove('open');
        },'image/png');
      };

      ensureEyeLabelSettings();syncEyeLabelControls();scheduleEyeLabelCleanup();
