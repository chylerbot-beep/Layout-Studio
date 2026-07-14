      function syncWallLegacyBounds(wall){
        const e=wallEndpoints(wall),t=wallThickness(wall),half=t/2;
        wall.x=Math.min(e.x1,e.x2)-half;wall.y=Math.min(e.y1,e.y2)-half;
        wall.w=Math.max(t,Math.abs(e.x2-e.x1)+t);wall.d=Math.max(t,Math.abs(e.y2-e.y1)+t);wall.thickness=t;
      }
      function openingWorldPositions(wall){
        const e=wallMetrics(wall);
        return (project.openings||[]).filter(op=>op.wallId===wall.id).map(op=>({op,world:{x:e.x1+e.ux*op.offset,y:e.y1+e.uy*op.offset}}));
      }
      function setWallFromEndpoints(wall,x1,y1,x2,y2,thickness,preserveOpenings=true){
        const saved=preserveOpenings?openingsSafe(wall):null,dx=x2-x1,dy=y2-y1,length=Math.hypot(dx,dy);
        if(length<200){const angle=wallEndpoints(wall).angle;x2=x1+Math.cos(angle)*200;y2=y1+Math.sin(angle)*200;}
        wall.x1=Math.round(x1);wall.y1=Math.round(y1);wall.x2=Math.round(x2);wall.y2=Math.round(y2);
        wall.thickness=Math.max(50,thickness||wallThickness(wall)||120);
        syncWallLegacyBounds(wall);if(saved)restoreOpeningOffsets(wall,saved);
      }
      function openingsSafe(wall){ return openingWorldPositions(wall).map(x=>({id:x.op.id,x:x.world.x,y:x.world.y})); }
      function restoreOpeningOffsets(wall,saved){
        const e=wallMetrics(wall),length=e.length;
        saved.forEach(s=>{const op=(project.openings||[]).find(x=>x.id===s.id);if(!op)return;const raw=(s.x-e.x1)*e.ux+(s.y-e.y1)*e.uy;op.offset=Math.max(op.width/2+20,Math.min(length-op.width/2-20,raw));});
      }
      function selectedArchitectureItem(){
        if(!selectedArchitecture)return null;
        const list=selectedArchitecture.kind==='wall'?project.walls:project.openings;
        return list.find(x=>x.id===selectedArchitecture.id)||null;
      }
      function physicalShellItemsV42(){
        return (project.shell||[]).filter(item=>{
          if(item.fixed===false||(+item.h||0)<=0)return false;
          const name=String(item.name||'').toLowerCase();
          // A shelter is a room enclosed by authoritative walls, not a solid room-size
          // block. Older handoffs sometimes included both representations.
          const redundantShelter=/\b(household|bomb)\s+shelter\b/.test(name)&&(+item.w||0)>=800&&(+item.d||0)>=800&&(+item.h||0)>=1800;
          return !redundantShelter;
        });
      }
      function makeWallPrism(wall,material,yBase=0,height=wall.h,from=0,to=null){
        const e=wallMetrics(wall),end=to==null?e.length:to,length=Math.max(1,end-from),mid=from+length/2;
        const mesh=new THREE.Mesh(new THREE.BoxGeometry(mm(length),mm(height),mm(e.thickness)),material);
        mesh.position.set(mm(e.x1+e.ux*mid),yBase+mm(height)/2,mm(e.y1+e.uy*mid));
        mesh.rotation.y=-e.angle;mesh.castShadow=false;mesh.receiveShadow=false;return mesh;
      }
      function renderArchitectureHighlight(){
        clearGroup(selectionOverlayGroup);
        const item=selectedArchitectureItem();
        if(!item)return;
        const blue=new THREE.MeshBasicMaterial({color:0x2f80ff,transparent:true,opacity:.38,depthTest:false,depthWrite:false,side:THREE.DoubleSide});
        if(selectedArchitecture.kind==='wall'){
          const e=wallMetrics(item),mesh=makeWallPrism(item,blue,.025,item.h);mesh.renderOrder=950;mesh.userData={wallControl:'move',wallId:item.id};selectionOverlayGroup.add(mesh);
          const top=mm(item.h)+.12;
          const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(mm(e.x1),top,mm(e.y1)),new THREE.Vector3(mm(e.x2),top,mm(e.y2))]),new THREE.LineBasicMaterial({color:0x1769ff,depthTest:false,transparent:true,opacity:.95}));line.renderOrder=951;selectionOverlayGroup.add(line);
          const handleMaterial=new THREE.MeshBasicMaterial({color:0x2f80ff,depthTest:false,depthWrite:false});
          [['start',e.x1,e.y1],['end',e.x2,e.y2]].forEach(([role,x,y])=>{const h=new THREE.Mesh(new THREE.SphereGeometry(.13,16,10),handleMaterial.clone());h.position.set(mm(x),top,mm(y));h.renderOrder=953;h.userData={wallControl:role,wallId:item.id};selectionOverlayGroup.add(h);});
          const normal={x:-e.uy,y:e.ux},rotateDistance=Math.max(450,e.thickness*2.5),rx=e.cx+normal.x*rotateDistance,ry=e.cy+normal.y*rotateDistance;
          const rotateLine=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(mm(e.cx),top,mm(e.cy)),new THREE.Vector3(mm(rx),top,mm(ry))]),new THREE.LineBasicMaterial({color:0x45a85a,depthTest:false,transparent:true,opacity:.9}));rotateLine.renderOrder=952;selectionOverlayGroup.add(rotateLine);
          const rotateHandle=new THREE.Mesh(new THREE.SphereGeometry(.14,16,10),new THREE.MeshBasicMaterial({color:0x63c174,depthTest:false,depthWrite:false}));rotateHandle.position.set(mm(rx),top,mm(ry));rotateHandle.renderOrder=954;rotateHandle.userData={wallControl:'rotate',wallId:item.id};selectionOverlayGroup.add(rotateHandle);
        }else{
          const wall=(project.walls||[]).find(w=>w.id===item.wallId);if(!wall)return;
          const e=wallMetrics(wall),c={x:e.x1+e.ux*item.offset,y:e.y1+e.uy*item.offset};
          const geo=new THREE.BoxGeometry(mm(item.width),mm(item.height),mm(Math.max(50,e.thickness+30)));
          const mesh=new THREE.Mesh(geo,blue);mesh.position.set(mm(c.x),mm(item.sill+item.height/2)+.02,mm(c.y));mesh.rotation.y=-e.angle;mesh.renderOrder=950;selectionOverlayGroup.add(mesh);
        }
      }
      function roomForArchitecture(item,kind){
        const wall=kind==='wall'?item:(project.walls||[]).find(w=>w.id===item.wallId);
        if(!wall)return 'Unassigned';
        const e=wallMetrics(wall),cx=e.cx,cy=e.cy;
        let best=null,bestScore=Infinity;
        (project.rooms||[]).forEach(room=>{
          const ex=250,inside=cx>=room.x-ex&&cx<=room.x+room.w+ex&&cy>=room.y-ex&&cy<=room.y+room.d+ex;
          const rx=room.x+room.w/2,ry=room.y+room.d/2,dist=Math.hypot(cx-rx,cy-ry)-(inside?100000:0);
          if(dist<bestScore){bestScore=dist;best=room;}
        });
        return best?.name||'Unassigned';
      }
      function buildWall(wall){
        const e=wallMetrics(wall),length=e.length,openings=(project.openings||[]).filter(x=>x.wallId===wall.id).sort((a,b)=>a.offset-b.offset);
        const mat=new THREE.MeshStandardMaterial({color:wall.detected?0xc39a5d:palette.wall,roughness:.94,transparent:!!wall.detected,opacity:wall.detected?.82:1});
        const addSegment=(from,to,yBase,height)=>{if(to-from<20||height<20)return;const mesh=makeWallPrism(wall,mat,yBase,height,from,to);mesh.userData={...wall,id:wall.id,fixed:true,wall:true};shellGroup.add(mesh);};
        let cursor=0;
        openings.forEach(op=>{
          const left=Math.max(cursor,op.offset-op.width/2),right=Math.min(length,op.offset+op.width/2);addSegment(cursor,left,0,wall.h);if(op.sill>0)addSegment(left,right,0,op.sill);const top=op.sill+op.height;if(top<wall.h)addSegment(left,right,mm(top),wall.h-top);cursor=Math.max(cursor,right);
          const c={x:e.x1+e.ux*op.offset,y:e.y1+e.uy*op.offset};
          if(op.type==='window'){
            const geo=new THREE.BoxGeometry(mm(op.width),mm(op.height),.025),glass=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:palette.glass,transparent:true,opacity:.38,roughness:.12,metalness:.05}));glass.position.set(mm(c.x),mm(op.sill+op.height/2),mm(c.y));glass.rotation.y=-e.angle;glass.userData={...op,opening:true};openingGroup.add(glass);
          }else{
            const geo=new THREE.PlaneGeometry(mm(op.width),mm(op.width)),leaf=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:0xc49a61,transparent:true,opacity:.48,side:THREE.DoubleSide}));leaf.rotation.x=-Math.PI/2;leaf.rotation.y=-e.angle;leaf.position.set(mm(c.x),.028,mm(c.y));leaf.userData={...op,opening:true};openingGroup.add(leaf);
          }
          architectureLabelGroup.add(makeOpeningLabel(op,wall,c));
        });
        addSegment(cursor,length,0,wall.h);
      }

      function normalizedBasemapCrop(){
        const c=project.basemap?.crop||{left:0,top:0,right:1,bottom:1};
        const left=Math.max(0,Math.min(.98,+c.left||0)),top=Math.max(0,Math.min(.98,+c.top||0));
        const right=Math.max(left+.01,Math.min(1,+c.right||1)),bottom=Math.max(top+.01,Math.min(1,+c.bottom||1));
        return {left,top,right,bottom};
      }
      function ensureBasemapImage(callback){
        if(!project.basemap?.dataUrl)return;
        if(basemapImage?.complete&&basemapImage.naturalWidth){callback(basemapImage);return;}
        const img=new Image();
        img.onload=()=>{basemapImage=img;callback(img);};
        img.src=project.basemap.dataUrl;
      }
      function basemapSignature(){
        if(!project.basemap)return '';
        const b=project.basemap,c=normalizedBasemapCrop();
        return [b.dataUrl?.length||0,b.width,b.depth,b.opacity,b.offsetX||0,b.offsetY||0,c.left,c.top,c.right,c.bottom].join('|');
      }
      function buildBasemap(force=false){
        if(!project.basemap?.dataUrl){clearGroup(basemapGroup);basemapRenderSignature='';return;}
        const sig=basemapSignature();
        if(!force&&sig===basemapRenderSignature&&basemapGroup.children.length)return;
        clearGroup(basemapGroup);basemapRenderSignature=sig;
        ensureBasemapImage(image=>{
          if(!project.basemap||sig!==basemapSignature())return;
          const crop=normalizedBasemapCrop();
          const sx=Math.round(crop.left*image.naturalWidth),sy=Math.round(crop.top*image.naturalHeight);
