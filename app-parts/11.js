      // Elevation support for tabletop, console-top and wall-mounted decorative objects.
      if(!$('elevationField')){
        const label=document.createElement('label');
        label.textContent='Elevation (mm)';
        const input=document.createElement('input');
        input.id='elevationField';input.type='number';input.step='25';input.min='0';input.value='0';
        label.appendChild(input);
        const heightLabel=$('hField')?.closest('label');
        heightLabel?.insertAdjacentElement('afterend',label);
        input.addEventListener('change',rebuildSelected);
      }

      // Apply sensible default elevations to the small decorative prototypes.
      decorativeCatalog.forEach(item=>{
        if(item.model==='tv'&&item.elevation===undefined)item.elevation=500;
        if(item.model==='picture-frame'&&item.elevation===undefined)item.elevation=900;
        if(['fruit-bowl','phone','flask'].includes(item.model)&&item.elevation===undefined)item.elevation=760;
      });

      function makeBox(item,material,yBase=0){
        const radius=item.shape==='rounded'?Math.min(mm(item.w),mm(item.d))*.22:0;
        let geometry;
        if(radius>0){
          const shape=new THREE.Shape(),w=mm(item.w),d=mm(item.d),r=radius;
          shape.moveTo(-w/2+r,-d/2);shape.lineTo(w/2-r,-d/2);shape.quadraticCurveTo(w/2,-d/2,w/2,-d/2+r);
          shape.lineTo(w/2,d/2-r);shape.quadraticCurveTo(w/2,d/2,w/2-r,d/2);shape.lineTo(-w/2+r,d/2);
          shape.quadraticCurveTo(-w/2,d/2,-w/2,d/2-r);shape.lineTo(-w/2,-d/2+r);shape.quadraticCurveTo(-w/2,-d/2,-w/2+r,-d/2);
          geometry=new THREE.ExtrudeGeometry(shape,{depth:mm(item.h),bevelEnabled:true,bevelSize:.025,bevelThickness:.02,bevelSegments:2});
          geometry.rotateX(Math.PI/2);geometry.translate(0,mm(item.h),0);
        }else geometry=new THREE.BoxGeometry(mm(item.w),mm(item.h),mm(item.d));
        const mesh=new THREE.Mesh(geometry,material),c=worldCenter(item),elevation=Math.max(0,+item.elevation||0);
        mesh.position.set(c.x,yBase+mm(elevation)+mm(item.h)/2,c.z);
        mesh.rotation.y=THREE.MathUtils.degToRad(item.rotation||0);
        mesh.castShadow=false;mesh.receiveShadow=false;
        return mesh;
      }

      function finishDecorativeGroup(group,item){
        const c=worldCenter(item),elevation=Math.max(0,+item.elevation||0);
        group.position.set(c.x,mm(elevation),c.z);
        group.rotation.y=THREE.MathUtils.degToRad(item.rotation||0);
        group.userData={...item,elevation,furniture:true,positionBaseOffsetMm:0};
        markObjectChildren(group,item.id);
        return group;
      }

      function createFurnitureMesh(item){
        item.elevation=Math.max(0,+item.elevation||0);
        let object;
        if(item.model==='plant'){
          object=createPlantObject(item);object.position.y=mm(item.elevation);object.userData={...item,furniture:true,positionBaseOffsetMm:0};markObjectChildren(object,item.id);
        }
        else if(item.model==='glass-blocks'){
          const texture=glassBlockTexture(item),mat=new THREE.MeshStandardMaterial({color:item.color||palette.glass,map:texture,transparent:true,opacity:.62,roughness:.18,metalness:.02,side:THREE.DoubleSide});
          object=makeBox(item,mat);object.userData={...item,furniture:true,positionBaseOffsetMm:item.h/2};markObjectChildren(object,item.id);
        }
        else if(item.model==='tv')object=createTvObject(item);
        else if(item.model==='picture-frame')object=createPictureFrameObject(item);
        else if(item.model==='fruit-bowl')object=createFruitBowlObject(item);
        else if(item.model==='phone')object=createPhoneObject(item);
        else if(item.model==='flask')object=createFlaskObject(item);
        else{
          const roughness=item.category==='carpentry'?.86:.78,mat=new THREE.MeshStandardMaterial({color:item.color||palette.furniture,roughness,metalness:.02});
          object=makeBox(item,mat);object.userData={...item,furniture:true,positionBaseOffsetMm:item.h/2};markObjectChildren(object,item.id);
        }
        furnitureGroup.add(object);return object;
      }

      function updateSelectionPanel(){
        const empty=$('selectionEmpty'),fields=$('selectionFields');empty.hidden=!!selected;fields.hidden=!selected;
        $('selectionStatus').textContent=selected?`${selected.userData.name} · ${Math.round(selected.userData.x)}, ${Math.round(selected.userData.y)} mm`:'Nothing selected';
        if(!selected)return;
        const u=selected.userData,isDecorative=u.category==='decorative';
        $('nameField').value=u.name;$('xField').value=Math.round(u.x);$('yField').value=Math.round(u.y);$('wField').value=Math.round(u.w);$('dField').value=Math.round(u.d);$('hField').value=Math.round(u.h);$('rField').value=Math.round(u.rotation||0);$('elevationField').value=Math.round(u.elevation||0);
        $('wField').min=isDecorative?'10':'100';$('dField').min=isDecorative?'10':'100';$('hField').min=isDecorative?'5':'50';
      }

      function syncSelectedFromMesh(){
        if(!selected)return;const u=selected.userData,baseOffset=Number.isFinite(u.positionBaseOffsetMm)?u.positionBaseOffsetMm:(u.h||0)/2;
        u.x=selected.position.x/MM-u.w/2;u.y=selected.position.z/MM-u.d/2;u.elevation=Math.max(0,selected.position.y/MM-baseOffset);u.rotation=THREE.MathUtils.radToDeg(selected.rotation.y);
        const item=project.furniture.find(x=>x.id===u.id);Object.assign(item,u);updateSelectionPanel();validate();
      }

      function rebuildSelected(){
        if(!selected)return;pushHistory('edit furniture');const id=selected.userData.id,item=project.furniture.find(x=>x.id===id),isDecorative=item.category==='decorative';
        item.name=$('nameField').value;item.x=+$('xField').value;item.y=+$('yField').value;item.w=Math.max(isDecorative?10:100,+$('wField').value);item.d=Math.max(isDecorative?10:100,+$('dField').value);item.h=Math.max(isDecorative?5:50,+$('hField').value);item.elevation=Math.max(0,+$('elevationField').value||0);item.rotation=+$('rField').value;
        buildScene();selectById(id);
      }

      function objectBox3D(mesh){const box=new THREE.Box3().setFromObject(mesh);return{minX:box.min.x,maxX:box.max.x,minY:box.min.y,maxY:box.max.y,minZ:box.min.z,maxZ:box.max.z};}
      function intersects3D(a,b){return!(a.maxX<=b.minX||b.maxX<=a.minX||a.maxY<=b.minY||b.maxY<=a.minY||a.maxZ<=b.minZ||b.maxZ<=a.minZ);}

      function validate(){
        const warnings=[],meshes=furnitureGroup.children;meshes.forEach(m=>setObjectTint(m,m.userData.color||palette.furniture,selected===m?0x263225:0x000000));
        for(let i=0;i<meshes.length;i++)for(let j=i+1;j<meshes.length;j++)if(intersects3D(objectBox3D(meshes[i]),objectBox3D(meshes[j]))){warnings.push(`${meshes[i].userData.name} overlaps ${meshes[j].userData.name}`);setObjectTint(meshes[i],palette.collision);setObjectTint(meshes[j],palette.collision);}
        project.clearances.forEach(zone=>{const z={minX:mm(zone.x),minZ:mm(zone.y),maxX:mm(zone.x+zone.w),maxZ:mm(zone.y+zone.d)};meshes.forEach(m=>{if(intersect(rect2D(m),z)){warnings.push(`${m.userData.name} blocks ${zone.name}`);setObjectTint(m,palette.collision);}});});
        const fixedObstacles=[...physicalShellItemsV42().filter(x=>(x.h||0)>500),...(project.walls||[])];
        fixedObstacles.forEach(item=>{const z={minX:mm(item.x),minZ:mm(item.y),maxX:mm(item.x+item.w),maxZ:mm(item.y+item.d)};meshes.forEach(m=>{if(intersect(rect2D(m),z)){warnings.push(`${m.userData.name} intersects ${item.name}`);setObjectTint(m,palette.collision);}});});
        const entranceBlocked=warnings.some(x=>x.includes('Entrance route')),kitchenBlocked=warnings.some(x=>x.includes('Kitchen working aisle')),overlaps=warnings.some(x=>x.includes('overlaps'));
        $('entranceCheck').textContent=entranceBlocked?'Blocked':'Clear';$('kitchenCheck').textContent=kitchenBlocked?'Blocked':'Clear';$('overlapCheck').textContent=overlaps?'Review':'No overlaps';
        $('warningList').innerHTML=warnings.map(x=>`<li>${x}</li>`).join('');const status=$('collisionStatus');status.textContent=warnings.length?`${warnings.length} issue${warnings.length>1?'s':''}`:'No collisions';status.classList.toggle('warn',!!warnings.length);
      }
