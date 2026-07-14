      // Wall editing, door-aware detection and physical-overlap validation refinements.

      // Remove OCR from the visible workflow while retaining hidden DOM hooks used by the
      // legacy event-binding module. Tesseract is therefore never loaded during normal use.
      if($('ocrDimensions')){$('ocrDimensions').hidden=true;$('ocrDimensions').style.display='none';}
      if($('ocrPanel')){$('ocrPanel').hidden=true;$('ocrPanel').style.display='none';}
      if($('basemapStatus')&&$('basemapStatus').textContent.includes('dimension')){
        $('basemapStatus').textContent='Enter the published overall plan dimensions, then use Auto-fit drawing β before tracing or aligning walls.';
      }

      // Explain the Ctrl constraint beside the existing wall controls.
      if($('selectedWallNote')&&!$('ctrlWallConstraintNote')){
        const note=document.createElement('div');note.id='ctrlWallConstraintNote';note.style.marginTop='7px';note.textContent='While dragging a blue endpoint, hold Ctrl to extend or shorten the wall on its original line without changing its angle.';$('selectedWallNote').appendChild(note);
      }

      // Hold Ctrl/Cmd while resizing a wall endpoint to project the pointer onto the
      // wall's original centre line. The fixed endpoint stays fixed and the wall cannot flip.
      const updateWallDragBeforePlaneConstraint=updateWallDrag;
      updateWallDrag=function(event){
        if(!wallDrag||event.pointerId!==wallDrag.pointerId)return;
        const constrained=(event.ctrlKey||event.metaKey)&&(wallDrag.mode==='start'||wallDrag.mode==='end');
        if(!constrained){updateWallDragBeforePlaneConstraint(event);return;}
        const pointerPoint=planPoint(event,25),wall=(project.walls||[]).find(item=>item.id===wallDrag.wallId);if(!pointerPoint||!wall)return;
        const original=wallDrag.original,length=Math.max(200,original.length),ux=(original.x2-original.x1)/length,uy=(original.y2-original.y1)/length;
        const movingStart=wallDrag.mode==='start',fixed=movingStart?{x:original.x2,y:original.y2}:{x:original.x1,y:original.y1},originalSign=movingStart?-1:1;
        let scalar=(pointerPoint.x-fixed.x)*ux+(pointerPoint.y-fixed.y)*uy;
        if(scalar*originalSign<200)scalar=originalSign*200;
        const projected={x:fixed.x+ux*scalar,y:fixed.y+uy*scalar};
        const x1=movingStart?projected.x:fixed.x,y1=movingStart?projected.y:fixed.y,x2=movingStart?fixed.x:projected.x,y2=movingStart?fixed.y:projected.y;
        setWallFromEndpoints(wall,x1,y1,x2,y2,original.thickness,false);
        const now=performance.now();if(now-wallDragLastRender>32){wallDragLastRender=now;refreshArchitectureVisuals(false);populateArchitectureFields('wall',wall);$('toolHint').textContent='Ctrl constraint active: wall length is changing on its original line.';}
      };

      // Door-aware wall-detection post-processing. Door leaves are usually short, thin
      // strokes attached perpendicularly to a longer wall. Door openings also appear as
      // low-density gaps in an otherwise thick wall band. Reject the former and split at
      // the latter rather than creating a wall across the doorway.
      function detectionSegmentLengthV28(segment){return Math.max(0,segment.b-segment.a);}
      function segmentTouchesPerpendicularWallV28(segment,other){
        if(segment.horizontal===other.horizontal)return false;
        const horizontal=segment.horizontal?segment:other,vertical=segment.horizontal?other:segment;
        const endpointNear=Math.min(Math.abs(vertical.p-horizontal.a),Math.abs(vertical.p-horizontal.b))<=190;
        const crosses=horizontal.p>=vertical.a-180&&horizontal.p<=vertical.b+180;
        return endpointNear&&crosses;
      }
      function isDoorLeafSegmentV28(segment,allSegments){
        const length=detectionSegmentLengthV28(segment),thin=segment.thickness<=95;
        if(!thin||length<500||length>1250)return false;
        return allSegments.some(other=>other!==segment&&detectionSegmentLengthV28(other)>=1450&&other.thickness>=95&&segmentTouchesPerpendicularWallV28(segment,other));
      }
      function medianNumberV28(values){if(!values.length)return 0;const sorted=[...values].sort((a,b)=>a-b);return sorted[(sorted.length/2)|0];}
      function occupancyAlongDetectedWallV28(segment,analysis,mask){
        const horizontal=segment.horizontal,b=project.basemap||{},planPrimary=horizontal?(b.width||PLAN_W):(b.depth||PLAN_H),planCross=horizontal?(b.depth||PLAN_H):(b.width||PLAN_W),pixelPrimary=horizontal?analysis.w:analysis.h,pixelCross=horizontal?analysis.h:analysis.w;
        const startPx=(segment.a-(horizontal?(b.offsetX||0):(b.offsetY||0)))/planPrimary*pixelPrimary,endPx=(segment.b-(horizontal?(b.offsetX||0):(b.offsetY||0)))/planPrimary*pixelPrimary,crossPx=(segment.p-(horizontal?(b.offsetY||0):(b.offsetX||0)))/planCross*pixelCross;
        const half=Math.max(2,Math.round(segment.thickness/planCross*pixelCross*.58)),step=Math.max(1,Math.round(pixelPrimary/900)),samples=[];
        for(let primary=Math.max(1,Math.round(startPx));primary<=Math.min(pixelPrimary-2,Math.round(endPx));primary+=step){
          let dark=0,total=0;
          for(let delta=-half;delta<=half;delta++){
            const x=horizontal?primary:Math.round(crossPx)+delta,y=horizontal?Math.round(crossPx)+delta:primary;
            if(x<0||x>=analysis.w||y<0||y>=analysis.h)continue;total++;if(mask[y*analysis.w+x])dark++;
          }
          samples.push({primary,world:segment.a+(primary-startPx)/Math.max(1,endPx-startPx)*(segment.b-segment.a),occupancy:total?dark/total:0});
        }
        return samples;
      }
      function splitDetectedSegmentAtDoorGapsV28(segment){
        if(!project.basemap||!basemapImage?.complete||detectionSegmentLengthV28(segment)<1500)return[segment];
        const analysis=makeBasemapAnalysis(true,1100);if(!analysis)return[segment];const masked=makeWallMask(analysis,190),samples=occupancyAlongDetectedWallV28(segment,analysis,masked.raw);if(samples.length<12)return[segment];
        const baseline=medianNumberV28(samples.map(sample=>sample.occupancy).filter(value=>value>.05));if(baseline<.2)return[segment];const lowThreshold=Math.max(.10,Math.min(.32,baseline*.42));
        const low=samples.map(sample=>sample.occupancy<lowThreshold);for(let i=1;i<low.length-1;i++)if(!low[i]&&low[i-1]&&low[i+1])low[i]=true;
        const gaps=[];let run=-1;
        for(let i=0;i<=low.length;i++){
          if(i<low.length&&low[i]&&run<0)run=i;
          if((i===low.length||!low[i])&&run>=0){const end=i-1,startWorld=samples[run].world,endWorld=samples[end].world,span=Math.abs(endWorld-startWorld);if(run>1&&end<low.length-2&&span>=500&&span<=1250)gaps.push({a:Math.min(startWorld,endWorld)-45,b:Math.max(startWorld,endWorld)+45});run=-1;}
        }
        if(!gaps.length)return[segment];
        let cursor=segment.a;const pieces=[];gaps.sort((a,b)=>a.a-b.a).forEach(gap=>{const left=Math.max(segment.a,gap.a),right=Math.min(segment.b,gap.b);if(left-cursor>=450)pieces.push({...segment,a:cursor,b:left,doorTrimmed:true});cursor=Math.max(cursor,right);});if(segment.b-cursor>=450)pieces.push({...segment,a:cursor,b:segment.b,doorTrimmed:true});return pieces.length?pieces:[segment];
      }
      const getDetectedWallSegmentsBeforeDoorFilter=getDetectedWallSegments;
      getDetectedWallSegments=function(force=false){
        const original=getDetectedWallSegmentsBeforeDoorFilter(force),withoutDoorLeaves=original.filter(segment=>!isDoorLeafSegmentV28(segment,original)),split=[];
        withoutDoorLeaves.forEach(segment=>split.push(...splitDetectedSegmentAtDoorGapsV28(segment)));
        return split.filter(segment=>detectionSegmentLengthV28(segment)>=450);
      };

      // Detected suggestions use normal wall material. During architecture review their
      // unconfirmed state can be shown with a red wireframe outline.
      const buildWallBeforeDetectedOutline=buildWall;
      buildWall=function(wall){
        if(!wall.detected){buildWallBeforeDetectedOutline(wall);return;}
        wall.detected=false;try{buildWallBeforeDetectedOutline(wall);}finally{wall.detected=true;}
      };
      const detectedWallHighlightGroupV28=new THREE.Group();detectedWallHighlightGroupV28.renderOrder=935;scene.add(detectedWallHighlightGroupV28);
      function detectedWallOutlineV28(wall){
        const material=new THREE.MeshBasicMaterial({color:0xff3b30,wireframe:true,transparent:true,opacity:.96,depthTest:false,depthWrite:false}),mesh=makeWallPrism(wall,material,.035,wall.h);mesh.renderOrder=935;mesh.userData={detectedWallHighlight:true,wallId:wall.id};return mesh;
      }
      function updateDetectedWallHighlightsV28(rebuild=false){
        if(rebuild){clearGroup(detectedWallHighlightGroupV28);(project.walls||[]).filter(wall=>wall.detected).forEach(wall=>detectedWallHighlightGroupV28.add(detectedWallOutlineV28(wall)));}
        detectedWallHighlightGroupV28.visible=false;
      }
      const renderArchitectureListBeforeDetectedOutline=renderArchitectureList;
      renderArchitectureList=function(){renderArchitectureListBeforeDetectedOutline();updateDetectedWallHighlightsV28(true);};

      // Validation now reports physical geometry overlaps only. Clearance-zone advisory
      // messages are intentionally excluded, so dining-chair pull-back and island-aisle
      // messages no longer appear or colour furniture.
      const validationOverlayGroupV28=new THREE.Group();validationOverlayGroupV28.renderOrder=980;scene.add(validationOverlayGroupV28);
      function ensurePhysicalValidationSettingsV28(){project.settings=project.settings||{};if(project.settings.validationEnabled===undefined)project.settings.validationEnabled=true;return project.settings.validationEnabled;}
      const validationSectionV28=[...document.querySelectorAll('.panel.right .section')].find(section=>section.querySelector(':scope > h2')?.textContent.trim()==='Validation');
      if(validationSectionV28&&!$('toggleValidation')){
        const row=document.createElement('div');row.className='button-row';row.style.marginBottom='12px';row.innerHTML='<button id="toggleValidation" class="active">Validate: on</button><span class="small" id="validationModeNote" style="align-self:center">Physical overlaps only</span>';validationSectionV28.insertBefore(row,validationSectionV28.querySelector('.readout'));
        if($('entranceCheck')){$('entranceCheck').hidden=true;$('entranceCheck').previousElementSibling.hidden=true;}
        if($('kitchenCheck')){$('kitchenCheck').hidden=true;$('kitchenCheck').previousElementSibling.hidden=true;}
        if($('overlapCheck')?.previousElementSibling)$('overlapCheck').previousElementSibling.textContent='Physical overlaps';
      }
      function polygonAxesV28(points){const axes=[];for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy)||1;axes.push({x:-dy/length,y:dx/length});}return axes;}
      function projectPolygonV28(points,axis){let min=Infinity,max=-Infinity;points.forEach(point=>{const value=point.x*axis.x+point.y*axis.y;if(value<min)min=value;if(value>max)max=value;});return{min,max};}
      function polygonsOverlapV28(a,b,epsilon=5){for(const axis of [...polygonAxesV28(a),...polygonAxesV28(b)]){const pa=projectPolygonV28(a,axis),pb=projectPolygonV28(b,axis);if(pa.max<=pb.min+epsilon||pb.max<=pa.min+epsilon)return false;}return true;}
      function rotatedRectV28(cx,cy,w,d,angle){const c=Math.cos(angle),s=Math.sin(angle),hw=w/2,hd=d/2;return[[-hw,-hd],[hw,-hd],[hw,hd],[-hw,hd]].map(([x,y])=>({x:cx+x*c-y*s,y:cy+x*s+y*c}));}
      function itemShapeV28(item){return{points:rotatedRectV28(item.x+item.w/2,item.y+item.d/2,item.w,item.d,THREE.MathUtils.degToRad(item.rotation||0)),minY:+item.elevation||0,maxY:(+item.elevation||0)+(+item.h||0)};}
      function wallSegmentShapeV28(wall,from,to,minY,maxY){const e=wallMetrics(wall),length=Math.max(1,to-from),mid=from+length/2,cx=e.x1+e.ux*mid,cy=e.y1+e.uy*mid;return{points:rotatedRectV28(cx,cy,length,e.thickness,e.angle),minY,maxY,wall,from,to};}
      function physicalWallShapesV28(){const shapes=[];(project.walls||[]).forEach(wall=>{const e=wallMetrics(wall),openings=(project.openings||[]).filter(op=>op.wallId===wall.id).sort((a,b)=>a.offset-b.offset);let cursor=0;openings.forEach(op=>{const left=Math.max(cursor,op.offset-op.width/2),right=Math.min(e.length,op.offset+op.width/2);if(left-cursor>5)shapes.push(wallSegmentShapeV28(wall,cursor,left,0,wall.h));if(op.sill>5)shapes.push(wallSegmentShapeV28(wall,left,right,0,op.sill));const top=(op.sill||0)+(op.height||0);if(wall.h-top>5)shapes.push(wallSegmentShapeV28(wall,left,right,top,wall.h));cursor=Math.max(cursor,right);});if(e.length-cursor>5)shapes.push(wallSegmentShapeV28(wall,cursor,e.length,0,wall.h));});return shapes;}
      function verticalOverlapV28(a,b,epsilon=5){return a.maxY>b.minY+epsilon&&b.maxY>a.minY+epsilon;}
      function shapesOverlapV28(a,b){return verticalOverlapV28(a,b)&&polygonsOverlapV28(a.points,b.points);}
      function addValidationObjectOutlineV28(object){const helper=new THREE.BoxHelper(object,0xff3029);helper.material.depthTest=false;helper.material.transparent=true;helper.material.opacity=.98;helper.renderOrder=982;validationOverlayGroupV28.add(helper);}
      function addValidationWallOutlineV28(shape){const material=new THREE.MeshBasicMaterial({color:0xff3029,wireframe:true,transparent:true,opacity:.98,depthTest:false,depthWrite:false}),mesh=makeWallPrism(shape.wall,material,mm(shape.minY),shape.maxY-shape.minY,shape.from,shape.to);mesh.renderOrder=981;validationOverlayGroupV28.add(mesh);}
      function addValidationShellOutlineV28(item){const material=new THREE.MeshBasicMaterial({color:0xff3029,wireframe:true,transparent:true,opacity:.98,depthTest:false,depthWrite:false}),mesh=makeBox(item,material);mesh.renderOrder=981;validationOverlayGroupV28.add(mesh);}
      function syncValidationToggleV28(){const enabled=ensurePhysicalValidationSettingsV28(),button=$('toggleValidation');if(button){button.textContent=enabled?'Validate: on':'Validate: off';button.classList.toggle('active',enabled);}}
      validate=function(){
        clearGroup(validationOverlayGroupV28);const enabled=ensurePhysicalValidationSettingsV28(),warnings=[],problemFurniture=new Set(),problemWalls=[],problemShell=[];
        furnitureGroup.children.forEach(mesh=>setObjectTint(mesh,mesh.userData.color||palette.furniture,selected===mesh?0x263225:0x000000));
        if(enabled){
          const items=(project.furniture||[]).map(item=>({item,shape:itemShapeV28(item),mesh:furnitureGroup.children.find(mesh=>mesh.userData.id===item.id)}));
          for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++)if(shapesOverlapV28(items[i].shape,items[j].shape)){warnings.push(`${items[i].item.name} overlaps ${items[j].item.name}`);problemFurniture.add(items[i].item.id);problemFurniture.add(items[j].item.id);}
          const wallShapes=physicalWallShapesV28();items.forEach(entry=>wallShapes.forEach(shape=>{if(shapesOverlapV28(entry.shape,shape)){warnings.push(`${entry.item.name} intersects ${shape.wall.name}`);problemFurniture.add(entry.item.id);if(!problemWalls.some(existing=>existing.wall.id===shape.wall.id&&existing.from===shape.from&&existing.to===shape.to))problemWalls.push(shape);}}));
          const shellItems=(project.shell||[]).filter(item=>(item.h||0)>0);items.forEach(entry=>shellItems.forEach(shell=>{const shape=itemShapeV28({...shell,elevation:shell.elevation||0,rotation:shell.rotation||0});if(shapesOverlapV28(entry.shape,shape)){warnings.push(`${entry.item.name} intersects ${shell.name}`);problemFurniture.add(entry.item.id);if(!problemShell.includes(shell))problemShell.push(shell);}}));
          problemFurniture.forEach(id=>{const object=furnitureGroup.children.find(mesh=>mesh.userData.id===id);if(object)addValidationObjectOutlineV28(object);});problemWalls.forEach(addValidationWallOutlineV28);problemShell.forEach(addValidationShellOutlineV28);
        }
        const uniqueWarnings=[...new Set(warnings)];if($('entranceCheck'))$('entranceCheck').textContent='Not checked';if($('kitchenCheck'))$('kitchenCheck').textContent='Not checked';if($('overlapCheck'))$('overlapCheck').textContent=!enabled?'Off':uniqueWarnings.length?`${uniqueWarnings.length} issue${uniqueWarnings.length===1?'':'s'}`:'No overlaps';if($('warningList'))$('warningList').innerHTML=uniqueWarnings.map(message=>`<li>${message}</li>`).join('');
        const status=$('collisionStatus');if(status){status.textContent=!enabled?'Validation off':uniqueWarnings.length?`${uniqueWarnings.length} overlap${uniqueWarnings.length===1?'':'s'}`:'No overlaps';status.classList.toggle('warn',enabled&&!!uniqueWarnings.length);}validationOverlayGroupV28.visible=enabled;syncValidationToggleV28();
      };
      if($('toggleValidation'))$('toggleValidation').onclick=()=>{pushHistory('toggle validation');project.settings.validationEnabled=!ensurePhysicalValidationSettingsV28();validate();};

      const normalizeProjectBeforeV28=normalizeProject;
      normalizeProject=function(){normalizeProjectBeforeV28();ensurePhysicalValidationSettingsV28();};
      if(typeof normalizeProjectV27==='function'){
        const normalizeProjectV27BeforeV28=normalizeProjectV27;
        normalizeProjectV27=function(){normalizeProjectV27BeforeV28();ensurePhysicalValidationSettingsV28();};
      }
      const buildSceneBeforeV28=buildScene;
      buildScene=function(){buildSceneBeforeV28();updateDetectedWallHighlightsV28(true);validate();};

      ensurePhysicalValidationSettingsV28();syncValidationToggleV28();updateDetectedWallHighlightsV28(true);
