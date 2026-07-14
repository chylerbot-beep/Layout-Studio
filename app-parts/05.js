        clearGroup(shellGroup);clearGroup(openingGroup);clearGroup(architectureLabelGroup);
        const floor=new THREE.Mesh(new THREE.PlaneGeometry(mm(PLAN_W),mm(PLAN_H)),new THREE.MeshStandardMaterial({color:palette.floor,roughness:.9}));
        floor.rotation.x=-Math.PI/2;floor.position.set(mm(PLAN_W)/2,-.015,mm(PLAN_H)/2);floor.receiveShadow=true;shellGroup.add(floor);
        physicalShellItemsV42().forEach(item=>{const h=item.h||100,mat=new THREE.MeshStandardMaterial({color:item.color||palette.fixed,roughness:.88,transparent:true,opacity:.88}),mesh=makeBox({...item,h},mat);mesh.userData={...item,fixed:true};shellGroup.add(mesh);});
        (project.walls||[]).forEach(buildWall);
      }
      function buildCeiling(){
        clearGroup(ceilingGroup);
        const settings=project.settings||{},height=Math.max(2100,Math.min(5000,+settings.ceilingHeight||2600));
        const material=new THREE.MeshStandardMaterial({color:0xf2efe9,roughness:1,side:THREE.DoubleSide});
        const ceiling=new THREE.Mesh(new THREE.BoxGeometry(mm(PLAN_W),.05,mm(PLAN_H)),material);
        ceiling.position.set(mm(PLAN_W)/2,mm(height)+.025,mm(PLAN_H)/2);
        ceiling.userData={ceiling:true,height};ceilingGroup.add(ceiling);
        ceilingGroup.visible=!!settings.ceilingVisible;
        $('ceilingHeight').value=Math.round(height);
        $('toggleCeiling').classList.toggle('active',ceilingGroup.visible);
      }
      function refreshArchitectureVisuals(refreshPanels=true){
        buildShellLayer();validate();renderArchitectureHighlight();
        if(refreshPanels){renderArchitectureList();updateArchitecturePanel();}
      }
      function buildScene(){
        [roomGroup,clearanceGroup,furnitureGroup,labelGroup,architectureLabelGroup,selectionOverlayGroup].forEach(clearGroup);
        if(grid)scene.remove(grid);
        grid=new THREE.GridHelper(Math.max(mm(PLAN_W),mm(PLAN_H)),Math.ceil(PLAN_W/500),0x77756f,0xb7b3ac);
        grid.position.set(mm(PLAN_W)/2,.005,mm(PLAN_H)/2);scene.add(grid);

        buildBasemap();buildShellLayer();buildCeiling();
        (project.rooms||[]).forEach(item=>{const geo=new THREE.PlaneGeometry(mm(item.w),mm(item.d)),mesh=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:item.color||0xe4ded6,transparent:true,opacity:.28,side:THREE.DoubleSide,depthWrite:false})),c=worldCenter(item);mesh.rotation.x=-Math.PI/2;mesh.position.set(c.x,.006,c.z);mesh.userData={...item,room:true};roomGroup.add(mesh);});
        project.clearances.forEach(item=>{const geo=new THREE.PlaneGeometry(mm(item.w),mm(item.d)),mat=new THREE.MeshBasicMaterial({color:palette.clearance,transparent:true,opacity:.20,depthWrite:false,side:THREE.DoubleSide}),mesh=new THREE.Mesh(geo,mat),c=worldCenter(item);mesh.rotation.x=-Math.PI/2;mesh.position.set(c.x,.018,c.z);mesh.userData={...item,clearance:true};clearanceGroup.add(mesh);});
        project.furniture.forEach(item=>{const object=createFurnitureMesh(item);labelGroup.add(makeObjectLabel(item,object));});
        labelGroup.visible=labelVisible;architectureLabelGroup.visible=labelVisible;
        selectById(selected?.userData?.id||null);validate();renderObjectList();renderArchitectureList();updateArchitecturePanel();renderArchitectureHighlight();
      }

      function markObjectChildren(object,id){
        object.traverse(child=>{child.userData.objectId=id;child.castShadow=false;child.receiveShadow=false;});
      }
      function glassBlockTexture(item){
        const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;const c=canvas.getContext('2d');
        c.fillStyle='rgba(180,220,230,.72)';c.fillRect(0,0,256,256);c.strokeStyle='rgba(255,255,255,.9)';c.lineWidth=5;
        const cols=Math.max(3,Math.min(10,Math.round(item.w/220))),rows=Math.max(3,Math.min(12,Math.round(item.h/220)));
        for(let x=0;x<=cols;x++){const px=x*256/cols;c.beginPath();c.moveTo(px,0);c.lineTo(px,256);c.stroke();}
        for(let y=0;y<=rows;y++){const py=y*256/rows;c.beginPath();c.moveTo(0,py);c.lineTo(256,py);c.stroke();}
        const texture=new THREE.CanvasTexture(canvas);texture.encoding=THREE.sRGBEncoding;texture.minFilter=THREE.LinearFilter;texture.magFilter=THREE.LinearFilter;return texture;
      }
      function createPlantObject(item){
        const group=new THREE.Group(),w=mm(item.w),d=mm(item.d),h=mm(item.h),base=Math.min(w,d),potH=Math.min(h*.34,.48),potR=Math.max(.08,base*.24);
        const pot=new THREE.Mesh(new THREE.CylinderGeometry(potR*.78,potR,Math.max(.12,potH),12),new THREE.MeshStandardMaterial({color:0x9b7662,roughness:.9}));pot.position.y=Math.max(.12,potH)/2;pot.userData.keepMaterialColor=true;group.add(pot);
        const stemH=Math.max(.12,h-potH),stem=new THREE.Mesh(new THREE.CylinderGeometry(Math.max(.012,base*.025),Math.max(.015,base*.035),stemH*.64,8),new THREE.MeshStandardMaterial({color:0x536a4e,roughness:.9}));stem.position.y=potH+stemH*.32;stem.userData.keepMaterialColor=true;group.add(stem);
        const crown=new THREE.Mesh(new THREE.SphereGeometry(.5,10,8),new THREE.MeshStandardMaterial({color:item.color||0x71866c,roughness:.88}));crown.scale.set(Math.max(.18,w*.48),Math.max(.2,stemH*.52),Math.max(.18,d*.48));crown.position.y=potH+stemH*.64;group.add(crown);
        const c=worldCenter(item);group.position.set(c.x,0,c.z);group.rotation.y=THREE.MathUtils.degToRad(item.rotation||0);group.userData={...item,furniture:true};markObjectChildren(group,item.id);return group;
      }
      function createFurnitureMesh(item){
        let object;
        if(item.model==='plant')object=createPlantObject(item);
        else if(item.model==='glass-blocks'){
          const texture=glassBlockTexture(item),mat=new THREE.MeshStandardMaterial({color:item.color||palette.glass,map:texture,transparent:true,opacity:.62,roughness:.18,metalness:.02,side:THREE.DoubleSide});
          object=makeBox(item,mat);object.userData={...item,furniture:true};markObjectChildren(object,item.id);
        }else{
          const roughness=item.category==='carpentry'?.86:.78,mat=new THREE.MeshStandardMaterial({color:item.color||palette.furniture,roughness,metalness:.02});
          object=makeBox(item,mat);object.userData={...item,furniture:true};markObjectChildren(object,item.id);
        }
        furnitureGroup.add(object);return object;
      }
      function setObjectTint(object,color,emissive=0x000000){
        object.traverse(child=>{const mat=child.material;if(!mat)return;const materials=Array.isArray(mat)?mat:[mat];materials.forEach(m=>{if(m.color&&!child.userData.keepMaterialColor)m.color.setHex(color);if(m.emissive)m.emissive.setHex(emissive);});});
      }

      function labelTexture(text){
        const canvas=document.createElement('canvas');canvas.width=640;canvas.height=128;const c=canvas.getContext('2d');
        const fontSize=text.length>28?42:text.length>19?48:54;c.clearRect(0,0,640,128);c.font=`700 ${fontSize}px system-ui`;c.textAlign='center';c.textBaseline='middle';c.fillStyle='#ffffff';c.fillText(text,320,64,616);
        const texture=new THREE.CanvasTexture(canvas);texture.minFilter=THREE.LinearFilter;texture.magFilter=THREE.LinearFilter;return texture;
      }
      function makeLabelSprite(text,position,footprint,targetIds=[]){
        const texture=labelTexture(text),material=new THREE.SpriteMaterial({map:texture,color:0x24231f,transparent:true,depthTest:false,depthWrite:false}),sprite=new THREE.Sprite(material);
        sprite.position.copy(position);sprite.scale.set(Math.max(1.55,Math.min(4.6,footprint*1.9)),.70,1);sprite.renderOrder=1000;sprite.userData={label:true,ignoreIds:[...new Set(targetIds)],normalColor:0x24231f,blockedColor:0xdf352d,labelTextures:[texture]};return sprite;
      }
      function makeObjectLabel(item,object){
        const box=new THREE.Box3().setFromObject(object),position=new THREE.Vector3((box.min.x+box.max.x)/2,box.max.y+.09,(box.min.z+box.max.z)/2),footprint=Math.max(mm(item.w),mm(item.d));
        return makeLabelSprite(item.name,position,footprint,[item.id]);
      }
      function makeOpeningLabel(op,wall,world){
        const top=Math.min((wall.h||2700)+140,(op.sill||0)+(op.height||2100)+140),position=new THREE.Vector3(mm(world.x),mm(top),mm(world.y));
        return makeLabelSprite(op.name,position,Math.max(.9,mm(op.width)),[op.id,wall.id]);
      }
      function updateLabelOcclusion(){
        if(!labelVisible)return;const targets=[...shellGroup.children,...openingGroup.children,...furnitureGroup.children,...(ceilingGroup.visible?ceilingGroup.children:[])],labels=[...labelGroup.children,...architectureLabelGroup.children];
        labels.forEach(label=>{const direction=label.position.clone().sub(camera.position),distance=direction.length();labelRaycaster.set(camera.position,direction.normalize());const hits=labelRaycaster.intersectObjects(targets,true),ignore=new Set(label.userData.ignoreIds||[]);const blocked=hits.some(hit=>{const id=hit.object.userData.objectId||hit.object.userData.id;return hit.distance<distance-.06&&!ignore.has(id);});const wanted=blocked?label.userData.blockedColor:label.userData.normalColor;if(label.material.color.getHex()!==wanted)label.material.color.setHex(wanted);});
      }

      function renderCatalogGroup(elementId,countId,items){
        const el=$(elementId);el.innerHTML='';$(countId).textContent=`${items.length} items`;
        items.forEach(proto=>{const b=document.createElement('button');b.innerHTML=`${proto.name}<span>${proto.w}×${proto.d}×${proto.h}</span>`;b.onclick=()=>addFurniture(proto);el.appendChild(b);});
      }
      function renderCatalog(){
        renderCatalogGroup('catalog','catalogCount',furnitureCatalog);renderCatalogGroup('carpentryCatalog','carpentryCatalogCount',carpentryCatalog);renderCatalogGroup('decorativeCatalog','decorativeCatalogCount',decorativeCatalog);
      }
      function addFurniture(proto){
        pushHistory(`add ${proto.category||'furniture'}`);const id='item-'+Date.now(),item={...proto,id,name:proto.name,x:7500,y:5000,rotation:0};project.furniture.push(item);buildScene();selectById(id);
      }
      function objectRow(item){
        const row=document.createElement('div');row.className='object-row'+(selected?.userData.id===item.id?' selected':'');
        const pick=document.createElement('button');pick.textContent=item.name;if(item.custom||item.model==='custom-box'){const badge=document.createElement('span');badge.className='custom-object-badge';badge.textContent='Custom';pick.appendChild(badge);pick.title=item.description||'Custom project element';}pick.onclick=()=>selectById(item.id);
        const eye=document.createElement('button');eye.className='eye';eye.textContent='◎';eye.title='Focus camera';eye.onclick=()=>focusById(item.id);row.append(pick,eye);return row;
      }
      function renderObjectList(){
        const el=$('objectList');el.innerHTML='';$('sceneObjectCount').textContent=`${project.furniture.length} items`;
        const groups=[['Furniture','furniture'],['Carpentry','carpentry'],['Decorative','decorative']];
        groups.forEach(([title,category],index)=>{const items=project.furniture.filter(item=>(item.category||'furniture')===category);if(!items.length)return;const details=document.createElement('details');details.className='subgroup';details.open=index===0;const summary=document.createElement('summary');summary.innerHTML=`<span>${title}</span><span>${items.length}</span>`;details.appendChild(summary);const body=document.createElement('div');body.className='objects';items.forEach(item=>body.appendChild(objectRow(item)));details.appendChild(body);el.appendChild(details);});
