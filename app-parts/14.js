      // Direct furniture length editing. Furniture gets two end handles; the
      // L-shaped wardrobe gets one handle at each free end of the L.
      let carpentryResizeMode=false,carpentryResizeDrag=null,carpentryResizeLastRender=0;
      const carpentryResizeGroup=new THREE.Group();carpentryResizeGroup.renderOrder=970;scene.add(carpentryResizeGroup);

      if(!$('resizeCarpentry')){
        const button=document.createElement('button');button.id='resizeCarpentry';button.textContent='Resize';button.hidden=true;button.title='Drag the blue end handles to extend or shorten this furniture item.';
        $('delete')?.parentElement?.insertBefore(button,$('delete'));
      }
      if(!$('carpentryResizeHint')&&$('selectionFields')){
        const hint=document.createElement('div');hint.id='carpentryResizeHint';hint.className='selected-wall-note';hint.hidden=true;hint.style.marginTop='10px';
        hint.innerHTML='Resize mode changes the furniture length. Drag either blue end handle; the opposite end stays fixed. L-shaped wardrobes have one handle on each free end.';
        $('selectionFields').appendChild(hint);
      }

      carpentryCatalog.push({category:'carpentry',name:'L-shaped wardrobe',w:2400,d:1800,h:2700,armDepth:600,model:'l-wardrobe',color:0xa99f94});

      function carpentryPlanAxes(rotation){const r=THREE.MathUtils.degToRad(rotation||0);return{u:{x:Math.cos(r),y:-Math.sin(r)},v:{x:Math.sin(r),y:Math.cos(r)}};}
      function carpentryItem(){if(!selected)return null;return project.furniture.find(item=>item.id===selected.userData.id)||null;}
      function createLWardrobeObject(item){
        const group=new THREE.Group(),w=Math.max(800,+item.w||2400),d=Math.max(800,+item.d||1800),h=Math.max(100,+item.h||2700),arm=Math.max(250,Math.min(+item.armDepth||600,w-200,d-200)),material=new THREE.MeshStandardMaterial({color:item.color||0xa99f94,roughness:.86,metalness:.02});
        const horizontal=new THREE.Mesh(new THREE.BoxGeometry(mm(w),mm(h),mm(arm)),material.clone());horizontal.position.set(0,mm(h)/2,mm(-d/2+arm/2));horizontal.userData={lWardrobePart:'horizontal',baseW:w,baseD:arm};group.add(horizontal);
        const verticalLength=Math.max(200,d-arm),vertical=new THREE.Mesh(new THREE.BoxGeometry(mm(arm),mm(h),mm(verticalLength)),material.clone());vertical.position.set(mm(-w/2+arm/2),mm(h)/2,mm(arm/2));vertical.userData={lWardrobePart:'vertical',baseW:arm,baseD:verticalLength};group.add(vertical);
        const c=worldCenter(item);group.position.set(c.x,mm(Math.max(0,+item.elevation||0)),c.z);group.rotation.y=THREE.MathUtils.degToRad(item.rotation||0);group.userData={...item,w,d,h,armDepth:arm,furniture:true,positionBaseOffsetMm:0};markObjectChildren(group,item.id);return group;
      }
      const createFurnitureMeshBeforeCarpentryResize=createFurnitureMesh;
      createFurnitureMesh=function(item){
        if(item.model!=='l-wardrobe')return createFurnitureMeshBeforeCarpentryResize(item);
        const object=createLWardrobeObject(item);furnitureGroup.add(object);return object;
      };

      function carpentryResizePoint(item,role){
        const c={x:item.x+item.w/2,y:item.y+item.d/2},axes=carpentryPlanAxes(item.rotation),arm=Math.max(250,Math.min(+item.armDepth||600,item.w-200,item.d-200));
        if(item.model==='l-wardrobe'){
          if(role==='l-x')return{x:c.x+axes.u.x*item.w/2+axes.v.x*(-item.d/2+arm/2),y:c.y+axes.u.y*item.w/2+axes.v.y*(-item.d/2+arm/2)};
          return{x:c.x+axes.u.x*(-item.w/2+arm/2)+axes.v.x*item.d/2,y:c.y+axes.u.y*(-item.w/2+arm/2)+axes.v.y*item.d/2};
        }
        const widthAxis=item.w>=item.d,axis=widthAxis?axes.u:axes.v,length=widthAxis?item.w:item.d,sign=role==='start'?-1:1;
        return{x:c.x+axis.x*length/2*sign,y:c.y+axis.y*length/2*sign};
      }
      function addCarpentryResizeHandle(item,role,point,top){
        const material=new THREE.MeshBasicMaterial({color:0x2f80ff,depthTest:false,depthWrite:false}),handle=new THREE.Mesh(new THREE.SphereGeometry(.15,16,10),material);handle.position.set(mm(point.x),top,mm(point.y));handle.renderOrder=975;handle.userData={carpentryResizeHandle:role,itemId:item.id};carpentryResizeGroup.add(handle);
      }
      function renderCarpentryResizeHandles(){
        clearGroup(carpentryResizeGroup);if(!carpentryResizeMode)return;const item=carpentryItem();if(!item)return;
        const top=mm((+item.elevation||0)+item.h)+.12,lineMaterial=new THREE.LineBasicMaterial({color:0x2f80ff,depthTest:false,transparent:true,opacity:.95});
        if(item.model==='l-wardrobe'){
          const px=carpentryResizePoint(item,'l-x'),py=carpentryResizePoint(item,'l-y'),c={x:item.x+item.w/2,y:item.y+item.d/2},axes=carpentryPlanAxes(item.rotation),arm=Math.max(250,Math.min(+item.armDepth||600,item.w-200,item.d-200));
          const cornerX={x:c.x+axes.u.x*(-item.w/2+arm/2)+axes.v.x*(-item.d/2+arm/2),y:c.y+axes.u.y*(-item.w/2+arm/2)+axes.v.y*(-item.d/2+arm/2)};
          [[cornerX,px],[cornerX,py]].forEach(pair=>{const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pair.map(p=>new THREE.Vector3(mm(p.x),top,mm(p.y)))),lineMaterial.clone());line.renderOrder=972;carpentryResizeGroup.add(line);});
          addCarpentryResizeHandle(item,'l-x',px,top);addCarpentryResizeHandle(item,'l-y',py,top);
        }else{
          const start=carpentryResizePoint(item,'start'),end=carpentryResizePoint(item,'end'),line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(mm(start.x),top,mm(start.y)),new THREE.Vector3(mm(end.x),top,mm(end.y))]),lineMaterial);line.renderOrder=972;carpentryResizeGroup.add(line);addCarpentryResizeHandle(item,'start',start,top);addCarpentryResizeHandle(item,'end',end,top);
        }
      }
      function setCarpentryResizeMode(enabled){
        const item=carpentryItem();carpentryResizeMode=!!enabled&&!!item;if(carpentryResizeMode)transform.detach();else if(selected&&!selectedArchitecture)transform.attach(selected);
        $('resizeCarpentry')?.classList.toggle('active',carpentryResizeMode);if($('carpentryResizeHint'))$('carpentryResizeHint').hidden=!carpentryResizeMode;renderCarpentryResizeHandles();
      }
      $('resizeCarpentry').onclick=()=>setCarpentryResizeMode(!carpentryResizeMode);

      function rotateSelectedFurnitureBy90(direction){
        if(!selected)return;const id=selected.userData.id,item=project.furniture.find(entry=>entry.id===id);if(!item)return;
        pushHistory(direction<0?'rotate furniture left 90 degrees':'rotate furniture right 90 degrees');
        item.rotation=((+(item.rotation||0)+direction*90)%360+360)%360;
        buildScene();selectById(id);$('selectionStatus').textContent=`${item.name} rotated ${direction<0?'left':'right'} 90°.`;
      }
      $('rotateLeft90').onclick=()=>rotateSelectedFurnitureBy90(-1);
      $('rotateRight90').onclick=()=>rotateSelectedFurnitureBy90(1);

      const updateSelectionPanelBeforeCarpentryResize=updateSelectionPanel;
      updateSelectionPanel=function(){
        updateSelectionPanelBeforeCarpentryResize();const item=carpentryItem(),button=$('resizeCarpentry');if(button)button.hidden=!item;if(!item&&carpentryResizeMode)setCarpentryResizeMode(false);if($('carpentryResizeHint')&&!carpentryResizeMode)$('carpentryResizeHint').hidden=true;
      };
      const selectBeforeCarpentryResize=select;
      select=function(mesh){const oldId=selected?.userData?.id||null,newId=mesh?.userData?.id||null;if(carpentryResizeMode&&oldId!==newId)setCarpentryResizeMode(false);selectBeforeCarpentryResize(mesh);updateSelectionPanel();if(carpentryResizeMode)renderCarpentryResizeHandles();};
      const buildSceneBeforeCarpentryResize=buildScene;
      buildScene=function(){buildSceneBeforeCarpentryResize();renderCarpentryResizeHandles();};
      const clearViewportInteractionBeforeCarpentryResize=clearViewportInteraction;
      clearViewportInteraction=function(){if(carpentryResizeMode)setCarpentryResizeMode(false);clearViewportInteractionBeforeCarpentryResize();};

      function beginCarpentryResize(role,event){
        const item=carpentryItem(),point=planPoint(event,25);if(!item||!point)return false;pushHistory('resize carpentry');
        carpentryResizeDrag={pointerId:event.pointerId,role,itemId:item.id,original:JSON.parse(JSON.stringify(item)),startPoint:point};orbit.enabled=false;transform.detach();renderer.domElement.setPointerCapture?.(event.pointerId);$('selectionStatus').textContent=`Resizing ${item.name}`;return true;
      }
      function resizedStraightCarpentry(original,role,point){
        const out={...original},axes=carpentryPlanAxes(original.rotation),widthAxis=original.w>=original.d,axis=widthAxis?axes.u:axes.v,length=widthAxis?original.w:original.d,c={x:original.x+original.w/2,y:original.y+original.d/2},start={x:c.x-axis.x*length/2,y:c.y-axis.y*length/2},end={x:c.x+axis.x*length/2,y:c.y+axis.y*length/2};let newLength,newCentre;
        if(role==='end'){newLength=Math.max(200,(point.x-start.x)*axis.x+(point.y-start.y)*axis.y);newCentre={x:start.x+axis.x*newLength/2,y:start.y+axis.y*newLength/2};}
        else{newLength=Math.max(200,(end.x-point.x)*axis.x+(end.y-point.y)*axis.y);newCentre={x:end.x-axis.x*newLength/2,y:end.y-axis.y*newLength/2};}
        newLength=Math.round(newLength/25)*25;if(widthAxis)out.w=newLength;else out.d=newLength;out.x=Math.round((newCentre.x-out.w/2)/25)*25;out.y=Math.round((newCentre.y-out.d/2)/25)*25;return out;
      }
      function resizedLWardrobe(original,role,point){
        const out={...original},axes=carpentryPlanAxes(original.rotation),c={x:original.x+original.w/2,y:original.y+original.d/2},arm=Math.max(250,Math.min(+original.armDepth||600,original.w-200,original.d-200));
        if(role==='l-x'){
          const fixed={x:c.x-axes.u.x*original.w/2,y:c.y-axes.u.y*original.w/2},newLength=Math.max(arm+200,(point.x-fixed.x)*axes.u.x+(point.y-fixed.y)*axes.u.y),length=Math.round(newLength/25)*25,newCentre={x:fixed.x+axes.u.x*length/2,y:fixed.y+axes.u.y*length/2};out.w=length;out.x=Math.round((newCentre.x-out.w/2)/25)*25;out.y=Math.round((newCentre.y-out.d/2)/25)*25;
        }else{
          const fixed={x:c.x-axes.v.x*original.d/2,y:c.y-axes.v.y*original.d/2},newLength=Math.max(arm+200,(point.x-fixed.x)*axes.v.x+(point.y-fixed.y)*axes.v.y),length=Math.round(newLength/25)*25,newCentre={x:fixed.x+axes.v.x*length/2,y:fixed.y+axes.v.y*length/2};out.d=length;out.x=Math.round((newCentre.x-out.w/2)/25)*25;out.y=Math.round((newCentre.y-out.d/2)/25)*25;
        }
        out.armDepth=Math.max(250,Math.min(arm,out.w-200,out.d-200));return out;
      }
      function previewCarpentryResize(item,original){
        if(!selected)return;selected.position.set(mm(item.x+item.w/2),selected.position.y,mm(item.y+item.d/2));selected.userData={...selected.userData,...item};
        if(item.model==='l-wardrobe'){
          const arm=Math.max(250,Math.min(+item.armDepth||600,item.w-200,item.d-200)),horizontal=selected.children.find(child=>child.userData.lWardrobePart==='horizontal'),vertical=selected.children.find(child=>child.userData.lWardrobePart==='vertical');
          if(horizontal){horizontal.scale.x=item.w/original.w;horizontal.position.z=mm(-item.d/2+arm/2);}
          if(vertical){vertical.scale.z=Math.max(200,item.d-arm)/Math.max(200,original.d-arm);vertical.position.x=mm(-item.w/2+arm/2);}
        }else{
          const widthAxis=original.w>=original.d;if(widthAxis)selected.scale.x=item.w/original.w;else selected.scale.z=item.d/original.d;
        }
      }
      function updateCarpentryResize(event){
        if(!carpentryResizeDrag||event.pointerId!==carpentryResizeDrag.pointerId)return;const point=planPoint(event,25),item=project.furniture.find(x=>x.id===carpentryResizeDrag.itemId);if(!point||!item)return;const original=carpentryResizeDrag.original,next=original.model==='l-wardrobe'?resizedLWardrobe(original,carpentryResizeDrag.role,point):resizedStraightCarpentry(original,carpentryResizeDrag.role,point);Object.assign(item,next);previewCarpentryResize(item,original);
        const now=performance.now();if(now-carpentryResizeLastRender>32){carpentryResizeLastRender=now;updateSelectionPanel();renderCarpentryResizeHandles();validate();}
      }
      function endCarpentryResize(event,cancel=false){
        if(!carpentryResizeDrag||event.pointerId!==undefined&&event.pointerId!==carpentryResizeDrag.pointerId)return;const id=carpentryResizeDrag.itemId;renderer.domElement.releasePointerCapture?.(carpentryResizeDrag.pointerId);carpentryResizeDrag=null;orbit.enabled=true;buildScene();selectById(id);setCarpentryResizeMode(!cancel);$('selectionStatus').textContent=cancel?'Carpentry resize ended.':'Carpentry length updated. Use Undo to restore the previous size.';
      }
      renderer.domElement.addEventListener('pointerdown',event=>{
        if(!carpentryResizeMode||event.button!==0)return;const rect=renderer.domElement.getBoundingClientRect();pointer.x=((event.clientX-rect.left)/rect.width)*2-1;pointer.y=-((event.clientY-rect.top)/rect.height)*2+1;raycaster.setFromCamera(pointer,camera);const hit=raycaster.intersectObjects(carpentryResizeGroup.children,false).find(result=>result.object.userData?.carpentryResizeHandle);if(!hit)return;if(beginCarpentryResize(hit.object.userData.carpentryResizeHandle,event)){event.preventDefault();event.stopImmediatePropagation();}
      },true);
      renderer.domElement.addEventListener('pointermove',event=>{if(carpentryResizeDrag){event.preventDefault();event.stopImmediatePropagation();updateCarpentryResize(event);}},true);
      renderer.domElement.addEventListener('pointerup',event=>{if(carpentryResizeDrag){event.preventDefault();event.stopImmediatePropagation();endCarpentryResize(event);}},true);
      renderer.domElement.addEventListener('pointercancel',event=>{if(carpentryResizeDrag)endCarpentryResize(event,true);},true);
