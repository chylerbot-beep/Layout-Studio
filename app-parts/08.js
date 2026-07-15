      function normaliseEyeLevelHeightV63(value,fallback=1300){
        const parsed=Number(value),safeFallback=Number.isFinite(Number(fallback))?Number(fallback):1300;
        return Math.round(Math.max(500,Math.min(12000,Number.isFinite(parsed)?parsed:safeFallback)));
      }
      function currentEyeLevelHeightV63(){
        project.settings=project.settings||{};
        const input=$('cameraHeight'),stored=normaliseEyeLevelHeightV63(project.settings.eyeLevelHeightMm,1300);
        const raw=input&&input.value.trim()!==''?Number(input.value):stored;
        const height=normaliseEyeLevelHeightV63(raw,stored);
        project.settings.eyeLevelHeightMm=height;
        return height;
      }
      function setViewButton(id){
        ['viewTop','viewBird','viewEye'].forEach(x=>$(x).classList.toggle('active',x===id));
        $('fovField').value=Math.round(camera.fov);
        if(id==='viewEye'){
          const height=normaliseEyeLevelHeightV63(camera.position.y/MM,project.settings?.eyeLevelHeightMm||1300);
          project.settings=project.settings||{};
          project.settings.eyeLevelHeightMm=height;
          $('cameraHeight').value=height;
        }else{
          $('cameraHeight').value=normaliseEyeLevelHeightV63(project.settings?.eyeLevelHeightMm,1300);
        }
        $('depthField').value=Math.round(camera.fov);
      }
      function resize(){ const w=viewport.clientWidth,h=viewport.clientHeight; renderer.setSize(w,h,false); camera.aspect=w/h; camera.updateProjectionMatrix(); }
      let lastFrame=0,lastLabelCheck=0;
      function animate(time=0){ requestAnimationFrame(animate);if(document.hidden||time-lastFrame<40)return;lastFrame=time;orbit.update();if(time-lastLabelCheck>250){updateLabelOcclusion();lastLabelCheck=time;}renderer.render(scene,camera); }

      function saveProject(){
        syncSelectedFromMesh(); project.camera={position:camera.position.toArray(),target:orbit.target.toArray(),fov:camera.fov};
        downloadBlob(new Blob([JSON.stringify(project,null,2)],{type:'application/json'}),'layout-studio-project.json');
      }
      function normalizeProject(){
        project.rooms=project.rooms||[];project.walls=project.walls||[];project.openings=project.openings||[];project.shell=project.shell||[];project.clearances=project.clearances||[];project.furniture=project.furniture||[];
        project.settings=project.settings||{};if(project.settings.ceilingVisible===undefined)project.settings.ceilingVisible=false;project.settings.ceilingHeight=Math.max(2100,Math.min(5000,+project.settings.ceilingHeight||2600));
        const savedCameraY=Number(project.camera?.position?.[1]),savedTargetY=Number(project.camera?.target?.[1]);
        const savedHorizontalEyeHeight=Number.isFinite(savedCameraY)&&Number.isFinite(savedTargetY)&&Math.abs(savedCameraY-savedTargetY)<0.01?savedCameraY/MM:1300;
        project.settings.eyeLevelHeightMm=normaliseEyeLevelHeightV63(project.settings.eyeLevelHeightMm,savedHorizontalEyeHeight);
        if($('cameraHeight'))$('cameraHeight').value=project.settings.eyeLevelHeightMm;
        project.walls.forEach((w,i)=>{w.id=w.id||`wall-imported-${i}`;const e=wallEndpoints(w);if(![w.x1,w.y1,w.x2,w.y2].every(Number.isFinite)){w.x1=e.x1;w.y1=e.y1;w.x2=e.x2;w.y2=e.y2;}w.thickness=wallThickness(w);syncWallLegacyBounds(w);});project.openings.forEach((o,i)=>o.id=o.id||`opening-imported-${i}`);project.furniture.forEach((item,i)=>{item.id=item.id||`item-imported-${i}`;item.category=item.category||'furniture';});
        if(project.basemap){project.basemap.width=project.basemap.width||PLAN_W;project.basemap.depth=project.basemap.depth||PLAN_H;project.basemap.offsetX=project.basemap.offsetX||0;project.basemap.offsetY=project.basemap.offsetY||0;project.basemap.crop=project.basemap.crop||{left:0,top:0,right:1,bottom:1};if(project.basemap.lockRatio===undefined)project.basemap.lockRatio=true;}
      }
      function loadProject(file){
        const reader=new FileReader();reader.onload=()=>{try{pushHistory('load project');project=JSON.parse(reader.result);normalizeProject();selected=null;selectedArchitecture=null;transform.detach();wallDetectionCache=null;basemapRenderSignature='';basemapImage=null;if(project.basemap?.dataUrl){basemapImage=new Image();basemapImage.onload=()=>buildBasemap(true);basemapImage.src=project.basemap.dataUrl;}buildScene();syncBasemapControls();if(project.camera){camera.position.fromArray(project.camera.position);orbit.target.fromArray(project.camera.target);camera.fov=project.camera.fov;camera.updateProjectionMatrix();}}catch(e){console.error(e);alert('This project file could not be read.');}};reader.readAsText(file);
      }
      function downloadBlob(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
      function capturePng(){
        const [w,h]=$('capturePreset').value.split('x').map(Number); const oldSize=new THREE.Vector2();renderer.getSize(oldSize); const oldBg=scene.background; const oldGrid=grid.visible,oldClear=clearanceGroup.visible,oldTransform=transform.visible;
        if($('captureBackground').value==='transparent')scene.background=null; grid.visible=false;clearanceGroup.visible=false;transform.visible=false;
        renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();renderer.render(scene,camera);
        renderer.domElement.toBlob(blob=>{
          downloadBlob(blob,projectDownloadName('png'));
          renderer.setSize(oldSize.x,oldSize.y,false);camera.aspect=oldSize.x/oldSize.y;camera.updateProjectionMatrix();scene.background=oldBg;grid.visible=oldGrid;clearanceGroup.visible=oldClear;transform.visible=oldTransform;$('captureModal').classList.remove('open');
        },'image/png');
      }


      function beginWallDrag(control,event){
        const wall=selectedArchitecture?.kind==='wall'?(project.walls||[]).find(w=>w.id===selectedArchitecture.id):null,point=planPoint(event,25);if(!wall||!point)return false;
        const e=wallMetrics(wall);pushHistory(control==='move'?'move wall':control==='rotate'?'rotate wall':'resize wall');wallDrag={pointerId:event.pointerId,mode:control,wallId:wall.id,startPoint:point,original:{x1:e.x1,y1:e.y1,x2:e.x2,y2:e.y2,cx:e.cx,cy:e.cy,length:e.length,thickness:e.thickness}};orbit.enabled=false;renderer.domElement.setPointerCapture?.(event.pointerId);$('toolHint').textContent=control==='move'?'Dragging wall. Release to place it.':control==='rotate'?'Rotating wall around its centre. Release to finish.':'Dragging wall endpoint to extend or shorten it.';return true;
      }
      function updateWallDrag(event){
        if(!wallDrag||event.pointerId!==wallDrag.pointerId)return;const point=planPoint(event,25),wall=(project.walls||[]).find(w=>w.id===wallDrag.wallId);if(!point||!wall)return;const o=wallDrag.original;let x1=o.x1,y1=o.y1,x2=o.x2,y2=o.y2;
        if(wallDrag.mode==='move'){const dx=point.x-wallDrag.startPoint.x,dy=point.y-wallDrag.startPoint.y;x1+=dx;y1+=dy;x2+=dx;y2+=dy;}
        else if(wallDrag.mode==='start'){const target=event.altKey?point:magneticWallPointV45(point,wall.id);x1=target.x;y1=target.y;}
        else if(wallDrag.mode==='end'){const target=event.altKey?point:magneticWallPointV45(point,wall.id);x2=target.x;y2=target.y;}
        else if(wallDrag.mode==='rotate'){const angle=Math.atan2(point.y-o.cy,point.x-o.cx),half=o.length/2,ux=Math.cos(angle),uy=Math.sin(angle);x1=o.cx-ux*half;y1=o.cy-uy*half;x2=o.cx+ux*half;y2=o.cy+uy*half;}
        setWallFromEndpoints(wall,x1,y1,x2,y2,o.thickness,false);const now=performance.now();if(now-wallDragLastRender>32){wallDragLastRender=now;refreshArchitectureVisuals(false);populateArchitectureFields('wall',wall);}
      }
      function endWallDrag(event,cancel=false){
        if(!wallDrag||event.pointerId!==undefined&&event.pointerId!==wallDrag.pointerId)return;const wall=(project.walls||[]).find(w=>w.id===wallDrag.wallId);renderer.domElement.releasePointerCapture?.(wallDrag.pointerId);wallDrag=null;orbit.enabled=true;if(wall){refreshArchitectureVisuals(true);$('toolHint').textContent='Wall updated. Drag the body, blue endpoints or green rotation handle again, or use Undo.';}if(cancel)$('toolHint').textContent='Wall drag ended.';
      }

      function beginOpeningDragV45(opening,event){
        if(opening.type!=='window')return false;
        openingDrag={pointerId:event.pointerId,openingId:opening.id,originalOffset:+opening.offset||0,startX:event.clientX,startY:event.clientY,history:false,lastRender:0};orbit.enabled=false;renderer.domElement.setPointerCapture?.(event.pointerId);$('toolHint').textContent='Drag left or right along the wall to position the window.';return true;
      }
      function updateOpeningDragV45(event){
        if(!openingDrag||event.pointerId!==openingDrag.pointerId)return;const opening=(project.openings||[]).find(item=>item.id===openingDrag.openingId),wall=opening&&(project.walls||[]).find(item=>item.id===opening.wallId),point=planPoint(event,25);if(!opening||!wall||!point)return;
        if(!openingDrag.history&&Math.hypot(event.clientX-openingDrag.startX,event.clientY-openingDrag.startY)<3)return;
        if(!openingDrag.history){pushHistory('move window along wall');openingDrag.history=true;}
        const e=wallMetrics(wall),minimum=(+opening.width||300)/2+25,raw=(point.x-e.x1)*e.ux+(point.y-e.y1)*e.uy;opening.offset=Math.round(Math.max(minimum,Math.min(e.length-minimum,raw))/25)*25;
        const now=performance.now();if(now-openingDrag.lastRender>32){openingDrag.lastRender=now;refreshArchitectureVisuals(false);populateArchitectureFields('opening',opening);$('toolHint').textContent='Window position follows the wall. Release to finish.';}
      }
      function endOpeningDragV45(event,cancel=false){
        if(!openingDrag||event.pointerId!==undefined&&event.pointerId!==openingDrag.pointerId)return;const id=openingDrag.openingId,moved=openingDrag.history;renderer.domElement.releasePointerCapture?.(openingDrag.pointerId);openingDrag=null;orbit.enabled=true;if(moved){refreshArchitectureVisuals(true);selectArchitecture('opening',id);$('toolHint').textContent='Window repositioned. Drag it again or use the offset field for exact placement.';}else if(cancel)$('toolHint').textContent='Window drag ended.';
      }

      function clearViewportInteraction(){
        if(wallDrag)endWallDrag({pointerId:wallDrag.pointerId},true);if(openingDrag)endOpeningDragV45({pointerId:openingDrag.pointerId},true);select(null);selectedArchitecture=null;updateArchitecturePanel();renderArchitectureList();setTool('select');$('selectionStatus').textContent='Nothing selected';
      }
      renderer.domElement.addEventListener('pointerdown',e=>{
        if(e.button===2){e.preventDefault();e.stopImmediatePropagation();clearViewportInteraction();}
      },true);
      renderer.domElement.addEventListener('pointerdown',e=>{
        if(transform.dragging||e.button!==0)return;
        if(activeTool!=='select'){const point=planPoint(e);if(!point)return;if(activeTool==='wall')drawWallAt(point,e);else addOpeningAt(point,activeTool);return;}
        const r=renderer.domElement.getBoundingClientRect();pointer.x=((e.clientX-r.left)/r.width)*2-1;pointer.y=-((e.clientY-r.top)/r.height)*2+1;raycaster.setFromCamera(pointer,camera);
        const controlHits=raycaster.intersectObjects(selectionOverlayGroup.children,false).filter(h=>h.object.userData?.wallControl);if(controlHits.length&&beginWallDrag(controlHits[0].object.userData.wallControl,e)){e.preventDefault();e.stopPropagation();return;}
        const openingHits=raycaster.intersectObjects(openingGroup.children,false).filter(h=>h.object.userData?.opening),furnitureHits=raycaster.intersectObjects(furnitureGroup.children.filter(item=>item.visible),true);
        if(openingHits.length&&(!furnitureHits.length||openingHits[0].distance<=furnitureHits[0].distance)){const opening=(project.openings||[]).find(item=>item.id===openingHits[0].object.userData.id);selectArchitecture('opening',opening?.id);if(opening&&beginOpeningDragV45(opening,e)){e.preventDefault();e.stopPropagation();}return;}
        if(furnitureHits.length){const object=sceneObjectFromHit(furnitureHits[0].object);if(object){select(object);return;}}
        const wallHits=raycaster.intersectObjects(shellGroup.children,false).filter(h=>h.object.userData?.wall);if(wallHits.length){selectArchitecture('wall',wallHits[0].object.userData.id);return;}
      });
      renderer.domElement.addEventListener('pointermove',updateWallDrag);
      renderer.domElement.addEventListener('pointermove',updateOpeningDragV45);
      renderer.domElement.addEventListener('pointerup',endWallDrag);
      renderer.domElement.addEventListener('pointerup',endOpeningDragV45);
      renderer.domElement.addEventListener('pointercancel',e=>{endWallDrag(e,true);endOpeningDragV45(e,true);});
      renderer.domElement.addEventListener('contextmenu',e=>{e.preventDefault();clearViewportInteraction();});
      window.addEventListener('resize',resize);
      ['nameField','xField','yField','wField','dField','hField','rField'].forEach(id=>$(id).addEventListener('change',rebuildSelected));
      ['archName','archThickness','archHeight','archX1','archY1','archX2','archY2','archLength','archRotation','openingWidth','openingOffset'].forEach(id=>$(id).addEventListener('change',rebuildArchitecture));

      // Eye-level keeps the camera and OrbitControls target at the same height.
      // Users can therefore type any height from 500–12,000 mm without unlocking pitch.
      viewEye=function(){
        const focus=currentViewFocusV60();
        const horizontalBefore=rememberViewHeadingV60();
        const currentDistance=Math.max(1,camera.position.distanceTo(orbit.target));
        const horizontal=Math.max(1.8,Math.min(5.5,horizontalBefore>0.25?horizontalBefore:currentDistance*0.32));
        const eyeHeight=mm(currentEyeLevelHeightV63());
        camera.up.set(0,1,0);
        camera.fov=52;
        camera.updateProjectionMatrix();
        orbit.target.set(focus.x,eyeHeight,focus.z);
        camera.position.set(focus.x+preservedViewHeadingV60.x*horizontal,eyeHeight,focus.z+preservedViewHeadingV60.z*horizontal);
        applyEyeHorizontalLockV62();
        orbit.enabled=true;
        orbit.enableRotate=true;
        orbit.enablePan=true;
        orbit.enableZoom=true;
        finishViewPresetV60('viewEye');
      };

      $('viewTop').onclick=viewTop;$('viewBird').onclick=viewBird;$('viewEye').onclick=viewEye;
      $('modeMove').onclick=()=>{transform.setMode('translate');$('modeMove').classList.add('active');$('modeRotate').classList.remove('active');};
      $('modeRotate').onclick=()=>{transform.setMode('rotate');$('modeRotate').classList.add('active');$('modeMove').classList.remove('active');};
      $('toggleGrid').onclick=()=>{grid.visible=!grid.visible;$('toggleGrid').classList.toggle('active',grid.visible);};
      $('toggleClearance').onclick=()=>{clearanceGroup.visible=!clearanceGroup.visible;$('toggleClearance').classList.toggle('active',clearanceGroup.visible);};
      $('toggleShell').onclick=()=>{shellGroup.visible=!shellGroup.visible;$('toggleShell').classList.toggle('active',shellGroup.visible);};
      $('toggleCeiling').onclick=()=>{pushHistory('toggle ceiling');project.settings.ceilingVisible=!project.settings.ceilingVisible;ceilingGroup.visible=project.settings.ceilingVisible;$('toggleCeiling').classList.toggle('active',ceilingGroup.visible);};
      $('ceilingHeight').onchange=()=>{const height=Math.max(2100,Math.min(5000,+$('ceilingHeight').value||2600));pushHistory('change ceiling height');project.settings.ceilingHeight=height;buildCeiling();};
      $('toggleLabels').onclick=()=>{labelVisible=!labelVisible;labelGroup.visible=labelVisible;architectureLabelGroup.visible=labelVisible;$('toggleLabels').classList.toggle('active',labelVisible);};
      $('duplicate').onclick=()=>{if(!selected)return;pushHistory('duplicate furniture');const copy={...selected.userData,id:'item-'+Date.now(),name:selected.userData.name+' copy',x:selected.userData.x+300,y:selected.userData.y+300};project.furniture.push(copy);buildScene();selectById(copy.id);};
      $('delete').onclick=()=>{if(!selected)return;pushHistory('delete furniture');const id=selected.userData.id;project.furniture=project.furniture.filter(x=>x.id!==id);select(null);buildScene();};
      $('saveJson').onclick=saveProject;$('loadJson').onclick=()=>$('jsonFile').click();$('jsonFile').onchange=e=>e.target.files[0]&&loadProject(e.target.files[0]);
      $('fovField').onchange=()=>{camera.fov=+$('fovField').value;camera.updateProjectionMatrix();$('depthField').value=camera.fov;};
      $('depthField').oninput=()=>{camera.fov=+$('depthField').value;camera.updateProjectionMatrix();$('fovField').value=camera.fov;};
      const applyCameraHeightV63=commit=>{
        const input=$('cameraHeight');if(!input||input.value.trim()==='')return;
        const raw=Number(input.value);if(!Number.isFinite(raw))return;
        const height=normaliseEyeLevelHeightV63(raw,project.settings?.eyeLevelHeightMm||1300);
        project.settings=project.settings||{};project.settings.eyeLevelHeightMm=height;
        if(commit)input.value=height;
        if(!$('viewEye').classList.contains('active'))return;
        const worldHeight=mm(height);
        camera.position.y=worldHeight;
        orbit.target.y=worldHeight;
        applyEyeHorizontalLockV62();
        orbit.update();
        if(typeof scheduleCameraCutaway==='function')scheduleCameraCutaway();
        if(typeof scheduleCameraFurnitureVisibilityV42==='function')scheduleCameraFurnitureVisibilityV42();
        if(typeof scheduleEyeLabelCleanup==='function')scheduleEyeLabelCleanup();
      };
      $('cameraHeight').oninput=()=>applyCameraHeightV63(false);
      $('cameraHeight').onchange=()=>applyCameraHeightV63(true);
      $('capture').onclick=()=>$('captureModal').classList.add('open');$('captureCancel').onclick=()=>$('captureModal').classList.remove('open');$('captureConfirm').onclick=capturePng;

      $('undo').onclick=undoAction;$('redo').onclick=redoAction;$('undo').disabled=true;$('redo').disabled=true;
      $('toolSelect').onclick=()=>setTool('select');$('toolWall').onclick=()=>setTool('wall');$('toolDoor').onclick=()=>setTool('door');$('toolWindow').onclick=()=>setTool('window');
      $('deleteArchitecture').onclick=()=>selectedArchitecture&&deleteArchitecture(selectedArchitecture.kind,selectedArchitecture.id);
      $('alignSelectedWall').onclick=alignSelectedWallToBasemap;
      $('uploadBasemap').onclick=()=>$('basemapFile').click();$('basemapFile').onchange=e=>e.target.files[0]&&loadBasemap(e.target.files[0]);
      $('toggleBasemap').onclick=()=>{basemapGroup.visible=!basemapGroup.visible;$('toggleBasemap').classList.toggle('active',basemapGroup.visible);};
      $('removeBasemap').onclick=()=>{if(!project.basemap)return;pushHistory('remove basemap');project.basemap=null;basemapImage=null;wallDetectionCache=null;basemapRenderSignature='';$('ocrPanel').hidden=true;buildBasemap(true);$('basemapStatus').textContent='No basemap loaded.';renderArchitectureHighlight();};
      $('basemapOpacity').oninput=()=>{if(!project.basemap)return;project.basemap.opacity=+$('basemapOpacity').value/100;basemapGroup.children.forEach(x=>{if(x.material)x.material.opacity=project.basemap.opacity;});basemapRenderSignature=basemapSignature();};
      const resizeBasemap=source=>{
        let w=Math.max(100,+$('planWidth').value||PLAN_W),d=Math.max(100,+$('planDepth').value||PLAN_H),locked=$('lockBasemapRatio').checked;
        if(locked&&!basemapResizeGuard){basemapResizeGuard=true;if(source==='width'){d=Math.round(w/basemapAspectRatio);$('planDepth').value=d;}else if(source==='depth'){w=Math.round(d*basemapAspectRatio);$('planWidth').value=w;}basemapResizeGuard=false;}
        if(!project.basemap)return;
        pushHistory('resize basemap');project.basemap.width=w;project.basemap.depth=d;project.basemap.lockRatio=locked;project.basemap.offsetX=+$('basemapOffsetX').value||0;project.basemap.offsetY=+$('basemapOffsetY').value||0;wallDetectionCache=null;buildBasemap(true);renderArchitectureHighlight();
      };
      $('planWidth').onchange=()=>resizeBasemap('width');$('planDepth').onchange=()=>resizeBasemap('depth');
      $('basemapOffsetX').onchange=()=>resizeBasemap('offset');$('basemapOffsetY').onchange=()=>resizeBasemap('offset');
      $('lockBasemapRatio').onchange=()=>{basemapAspectRatio=(+$('planWidth').value||PLAN_W)/(+$('planDepth').value||PLAN_H);if(project.basemap){pushHistory('change basemap ratio lock');project.basemap.lockRatio=$('lockBasemapRatio').checked;}};
      $('autoFitBasemap').onclick=autoFitBasemap;$('ocrDimensions').onclick=readDimensionsWithOcr;$('applyOcrDimensions').onclick=applyOcrDimensions;
      $('autoTrace').onclick=detectWalls;$('clearDetected').onclick=()=>{if(!(project.walls||[]).some(x=>x.detected))return;pushHistory('clear detected walls');const ids=new Set(project.walls.filter(x=>x.detected).map(x=>x.id));project.walls=project.walls.filter(x=>!x.detected);project.openings=project.openings.filter(x=>!ids.has(x.wallId));if(selectedArchitecture&&ids.has(selectedArchitecture.id))selectedArchitecture=null;buildScene();};
      window.addEventListener('keydown',e=>{const mod=e.ctrlKey||e.metaKey;if(mod&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redoAction():undoAction();}if(mod&&e.key.toLowerCase()==='y'){e.preventDefault();redoAction();}if(e.key==='Escape'){setTool('select');select(null);selectedArchitecture=null;updateArchitecturePanel();renderArchitectureList();$('selectionStatus').textContent='Nothing selected';}});

      renderCatalog();normalizeProject();buildScene();viewBird();resize();$('alignSelectedWall').disabled=true;animate();
    })();
