          const thickness=b.p1-b.p0+1,length=b.b-b.a+1;return thickness>=3&&thickness<=Math.max(28,primary*.07)&&length>=minRun&&length/thickness>=2.5;
        });
      }
      function detectedSegmentLength(segment){
        return Math.max(0,segment.b-segment.a);
      }
      function detectedSegmentsMeet(first,second,tolerance=180){
        if(first.horizontal===second.horizontal)return false;
        const horizontal=first.horizontal?first:second,vertical=first.horizontal?second:first;
        const x=vertical.p,y=horizontal.p;
        const crossesHorizontal=x>=horizontal.a-tolerance&&x<=horizontal.b+tolerance;
        const crossesVertical=y>=vertical.a-tolerance&&y<=vertical.b+tolerance;
        if(!crossesHorizontal||!crossesVertical)return false;
        const horizontalEnd=Math.min(Math.abs(x-horizontal.a),Math.abs(x-horizontal.b));
        const verticalEnd=Math.min(Math.abs(y-vertical.a),Math.abs(y-vertical.b));
        return horizontalEnd<=tolerance||verticalEnd<=tolerance;
      }
      function reliableDetectedSegment(segment,segments){
        const length=detectedSegmentLength(segment);
        if(length>=1250)return true;
        if(length<450)return false;
        // Short isolated bands are commonly room-name glyphs or dimension marks.
        // Keep them only when they terminate at a substantial perpendicular wall.
        return segments.some(other=>other!==segment&&detectedSegmentLength(other)>=1100&&detectedSegmentsMeet(segment,other,220));
      }
      function snapDetectedSegmentEnds(segments,tolerance=240){
        return segments.map(segment=>{
          const perpendicular=segments.filter(other=>other!==segment&&other.horizontal!==segment.horizontal&&segment.p>=other.a-tolerance&&segment.p<=other.b+tolerance&&(other.thickness>95||detectedSegmentLength(other)>=1250));
          const snap=endpoint=>{
            let best=endpoint,distance=tolerance+1;
            perpendicular.forEach(other=>{const gap=Math.abs(other.p-endpoint);if(gap<distance){best=other.p;distance=gap;}});
            return best;
          };
          const a=snap(segment.a),b=snap(segment.b);
          return {...segment,a:Math.min(a,b),b:Math.max(a,b)};
        });
      }
      function getDetectedWallSegments(force=false){
        if(!project.basemap||!basemapImage?.complete||!basemapImage.naturalWidth)return [];
        const key=basemapSignature();if(!force&&wallDetectionCache?.key===key)return wallDetectionCache.segments;
        // 195 includes the pale centre of common plan wall bands. At 190 only the
        // dark outer edge survived, which shifted suggested walls outside the basemap.
        const analysis=makeBasemapAnalysis(true,1100),masked=makeWallMask(analysis,195),horizontal=collectLineBands(masked.mask,analysis.w,analysis.h,true),vertical=collectLineBands(masked.mask,analysis.w,analysis.h,false),segments=[];
        horizontal.forEach(b=>{const s=analysisPixelToWorld(b.a,b.p,analysis),e=analysisPixelToWorld(b.b,b.p,analysis),t=Math.abs(analysisPixelToWorld(0,b.p1,analysis).y-analysisPixelToWorld(0,b.p0,analysis).y);segments.push({horizontal:true,a:s.x,b:e.x,p:s.y,thickness:t,pixel:b});});
        vertical.forEach(b=>{const s=analysisPixelToWorld(b.p,b.a,analysis),e=analysisPixelToWorld(b.p,b.b,analysis),t=Math.abs(analysisPixelToWorld(b.p1,0,analysis).x-analysisPixelToWorld(b.p0,0,analysis).x);segments.push({horizontal:false,a:s.y,b:e.y,p:s.x,thickness:t,pixel:b});});
        const clean=[];
        segments.sort((a,b)=>(b.b-b.a)-(a.b-a.a)).forEach(seg=>{
          if(!reliableDetectedSegment(seg,segments)||seg.thickness<35||seg.thickness>650)return;
          const duplicate=clean.some(x=>x.horizontal===seg.horizontal&&Math.abs(x.p-seg.p)<Math.max(90,(x.thickness+seg.thickness)*.55)&&Math.max(0,Math.min(x.b,seg.b)-Math.max(x.a,seg.a))/Math.min(x.b-x.a,seg.b-seg.a)>.72);
          if(!duplicate)clean.push({...seg,a:Math.round(seg.a/25)*25,b:Math.round(seg.b/25)*25,p:Math.round(seg.p/25)*25,thickness:Math.round(Math.max(70,Math.min(350,seg.thickness))/10)*10});
        });
        wallDetectionCache={key,segments:snapDetectedSegmentEnds(clean).slice(0,80),threshold:masked.threshold};return wallDetectionCache.segments;
      }
      function detectWalls(){
        if(!basemapImage){alert('Upload a floor-plan image first.');return;}
        const lines=getDetectedWallSegments(true);if(!lines.length){$('toolHint').textContent='No reliable thick wall bands were found. Try Auto-fit drawing β, verify the plan dimensions, or draw walls manually.';return;}
        pushHistory('auto-detect walls');const oldIds=new Set((project.walls||[]).filter(x=>x.detected).map(x=>x.id));project.walls=project.walls.filter(x=>!x.detected);project.openings=project.openings.filter(x=>!oldIds.has(x.wallId));const wh=+$('wallHeight').value||2700,stamp=Date.now();
        lines.slice(0,60).forEach((line,i)=>{const t=line.thickness||Math.max(80,+$('wallThickness').value||120);project.walls.push(line.horizontal?{id:`detected-${stamp}-${i}`,name:`Detected wall ${i+1}`,x:line.a,y:line.p-t/2,w:Math.max(200,line.b-line.a),d:t,h:wh,detected:true}:{id:`detected-${stamp}-${i}`,name:`Detected wall ${i+1}`,x:line.p-t/2,y:line.a,w:t,d:Math.max(200,line.b-line.a),h:wh,detected:true});});
        buildScene();$('toolHint').textContent=`Added ${Math.min(lines.length,60)} editable beta wall suggestions in amber. Existing authored walls were kept.`;
      }
      function bestSegmentForWall(wall,segments,used){
        const e=wallEndpoints(wall),wa=e.horizontal?[Math.min(e.x1,e.x2),Math.max(e.x1,e.x2)]:[Math.min(e.y1,e.y2),Math.max(e.y1,e.y2)],wp=e.horizontal?e.y1:e.x1,wlen=wa[1]-wa[0];let best=null;
        segments.forEach((s,index)=>{if(s.horizontal!==e.horizontal)return;const perp=Math.abs(s.p-wp);if(perp>1100)return;const slen=s.b-s.a,ratio=slen/wlen;if(ratio<.38||ratio>2.6)return;const overlap=Math.max(0,Math.min(wa[1],s.b)-Math.max(wa[0],s.a)),gap=overlap>0?0:Math.min(Math.abs(wa[0]-s.b),Math.abs(s.a-wa[1]));const overlapRatio=overlap/Math.max(1,Math.min(wlen,slen));if(overlapRatio<.15&&gap>700)return;const reuse=used?.has(index)?180:0,score=perp*1.8+gap*.65+Math.abs(Math.log(ratio))*520+(1-overlapRatio)*220+reuse;if(!best||score<best.score)best={segment:s,index,score};});
        return best&&best.score<1900?best:null;
      }
      function localStripMatch(wall){
        if(!project.basemap||!basemapImage?.complete||!basemapImage.naturalWidth)return null;
        const analysis=makeBasemapAnalysis(true,1100);if(!analysis)return null;
        const image=analysis.ctx.getImageData(0,0,analysis.w,analysis.h).data,b=project.basemap,ox=b.offsetX||0,oy=b.offsetY||0;
        const toPixel=(x,y)=>({x:(x-ox)/(b.width||PLAN_W)*analysis.w,y:(y-oy)/(b.depth||PLAN_H)*analysis.h});
        const e=wallEndpoints(wall),p1=toPixel(e.x1,e.y1),p2=toPixel(e.x2,e.y2),horizontal=e.horizontal;
        let axis0=horizontal?Math.min(p1.x,p2.x):Math.min(p1.y,p2.y),axis1=horizontal?Math.max(p1.x,p2.x):Math.max(p1.y,p2.y),center=horizontal?p1.y:p1.x;
        axis0=Math.max(1,Math.floor(axis0));axis1=Math.min((horizontal?analysis.w:analysis.h)-2,Math.ceil(axis1));if(axis1-axis0<8)return null;
        const pixelsPerMm=horizontal?analysis.h/(b.depth||PLAN_H):analysis.w/(b.width||PLAN_W),search=Math.max(8,Math.round(950*pixelsPerMm)),thicknessMm=wallMetrics(wall).thickness,bandHalf=Math.max(1,Math.min(9,Math.round(thicknessMm*pixelsPerMm*.45))),step=Math.max(1,Math.floor((axis1-axis0)/260));
        const qMin=Math.max(1,Math.floor(center-search)),qMax=Math.min((horizontal?analysis.h:analysis.w)-2,Math.ceil(center+search));let best=null;
        for(let q=qMin;q<=qMax;q++){
          let strong=0,total=0,darkness=0;
          for(let a=axis0;a<=axis1;a+=step){let dark=0,count=0,sum=0;for(let k=-bandHalf;k<=bandHalf;k++){const x=horizontal?Math.round(a):q+k,y=horizontal?q+k:Math.round(a);if(x<0||x>=analysis.w||y<0||y>=analysis.h)continue;const idx=(y*analysis.w+x)*4,g=image[idx]*.2126+image[idx+1]*.7152+image[idx+2]*.0722;sum+=g;count++;if(g<178)dark++;}if(!count)continue;const fraction=dark/count;if(fraction>=.42)strong++;darkness+=1-Math.min(1,(sum/count)/245);total++;}
          if(!total)continue;const density=strong/total,contrast=darkness/total,score=density*.82+contrast*.18;if(!best||score>best.score)best={q,score,density};
        }
        if(!best||best.score<.16||best.density<.07)return null;
        const p=horizontal?analysisPixelToWorld(0,best.q,analysis).y:analysisPixelToWorld(best.q,0,analysis).x,a=horizontal?Math.min(e.x1,e.x2):Math.min(e.y1,e.y2),end=horizontal?Math.max(e.x1,e.x2):Math.max(e.y1,e.y2);
        return {segment:{horizontal,a,b:end,p,thickness:thicknessMm,local:true,confidence:best.score},index:-1,score:(1-best.score)*1000};
      }
      function alignWallToSegment(wall,segment){
        const e=wallMetrics(wall),wlen=e.length,slen=segment.b-segment.a,ratio=slen/wlen,t=e.thickness;let a=segment.a,b=segment.b;
        const authored=!wall.detected&&!wall.autoDetected,hasOpening=(project.openings||[]).some(opening=>opening.wallId===wall.id);
        if(authored||hasOpening){a=e.horizontal?Math.min(e.x1,e.x2):Math.min(e.y1,e.y2);b=e.horizontal?Math.max(e.x1,e.x2):Math.max(e.y1,e.y2);}
        else if(ratio>1.7||ratio<.55){const oldA=e.horizontal?Math.min(e.x1,e.x2):Math.min(e.y1,e.y2),oldB=e.horizontal?Math.max(e.x1,e.x2):Math.max(e.y1,e.y2),center=(oldA+oldB)/2;a=Math.max(segment.a,center-wlen/2);b=Math.min(segment.b,a+wlen);if(b-a<wlen*.75){a=center-wlen/2;b=center+wlen/2;}}
        if(e.horizontal)setWallFromEndpoints(wall,a,segment.p,b,segment.p,t);else setWallFromEndpoints(wall,segment.p,a,segment.p,b,t);
      }
      function alignSelectedWallToBasemap(){
        const wall=selectedArchitecture?.kind==='wall'?(project.walls||[]).find(w=>w.id===selectedArchitecture.id):null;if(!wall||!project.basemap)return;
        const match=bestSegmentForWall(wall,getDetectedWallSegments(true))||localStripMatch(wall);if(!match){$('toolHint').textContent='No sufficiently similar wall line was found near the selected wall. Adjust the basemap crop/offset or edit the wall endpoints manually.';return;}
        pushHistory('align selected wall');alignWallToSegment(wall,match.segment);buildScene();$('toolHint').textContent=match.segment.local?`Aligned “${wall.name}” to the strongest nearby basemap wall line while preserving its length. Review the blue overlay before continuing.`:`Aligned “${wall.name}” to the nearest detected wall band in the basemap. Review the blue overlay before continuing.`;
      }
      function alignAllWallsToBasemap(includeDetected=false){
        includeDetected=includeDetected===true;
        if(!project.basemap)return;const segments=getDetectedWallSegments(true),walls=(project.walls||[]).filter(w=>includeDetected||!w.detected),used=new Set(),matches=[];
        walls.sort((a,b)=>Math.max(b.w,b.d)-Math.max(a.w,a.d)).forEach(w=>{const m=bestSegmentForWall(w,segments,used)||localStripMatch(w);if(m){matches.push({wall:w,match:m});if(m.index>=0)used.add(m.index);}});
        if(!matches.length){$('toolHint').textContent='No authored walls could be matched. Run Auto-fit drawing β and confirm the plan width/depth first.';return;}
        pushHistory('align all walls');matches.forEach(x=>alignWallToSegment(x.wall,x.match.segment));buildScene();const label=includeDetected?'review walls':'authored walls';$('toolHint').textContent=matches.length===walls.length?`Aligned all ${walls.length} ${label} to centred basemap wall bands. Review the result before continuing.`:`Aligned ${matches.length} of ${walls.length} ${label}. Unmatched walls were left unchanged for manual review.`;
      }

      function select(mesh){
        selected=mesh||null;transform.detach();furnitureGroup.children.forEach(m=>setObjectTint(m,m.userData.color||palette.furniture,0x000000));
        if(selected){selectedArchitecture=null;clearGroup(selectionOverlayGroup);updateArchitecturePanel();renderArchitectureList();transform.attach(selected);setObjectTint(selected,selected.userData.color||palette.furniture,0x263225);}
        updateSelectionPanel();renderObjectList();
      }
      function selectById(id){select(id?furnitureGroup.children.find(m=>m.userData.id===id):null);}
      function sceneObjectFromHit(object){let current=object;while(current&&current.parent!==furnitureGroup)current=current.parent;return current?.parent===furnitureGroup?current:null;}
      function focusById(id){const m=furnitureGroup.children.find(x=>x.userData.id===id);if(!m)return;const box=new THREE.Box3().setFromObject(m),centre=box.getCenter(new THREE.Vector3());orbit.target.copy(centre);camera.position.set(centre.x+4,centre.y+4,centre.z+4);orbit.update();select(m);}

      function updateSelectionPanel(){
        const empty=document.getElementById('selectionEmpty'), fields=document.getElementById('selectionFields');
        empty.hidden=!!selected; fields.hidden=!selected;
        document.getElementById('selectionStatus').textContent=selected?`${selected.userData.name} · ${Math.round(selected.userData.x)}, ${Math.round(selected.userData.y)} mm`:'Nothing selected';
        if(!selected)return;
        const u=selected.userData;
        $('nameField').value=u.name; $('xField').value=Math.round(u.x); $('yField').value=Math.round(u.y); $('wField').value=Math.round(u.w); $('dField').value=Math.round(u.d); $('hField').value=Math.round(u.h); $('rField').value=Math.round(u.rotation||0);
      }
      function syncSelectedFromMesh(){
        if(!selected)return; const u=selected.userData;
        u.x=selected.position.x/MM-u.w/2; u.y=selected.position.z/MM-u.d/2; u.rotation=THREE.MathUtils.radToDeg(selected.rotation.y);
        const item=project.furniture.find(x=>x.id===u.id); Object.assign(item,u); updateSelectionPanel(); validate();
      }
      function rebuildSelected(){
        if(!selected)return; pushHistory('edit furniture'); const id=selected.userData.id; const item=project.furniture.find(x=>x.id===id);
        item.name=$('nameField').value; item.x=+$('xField').value; item.y=+$('yField').value; item.w=Math.max(100,+$('wField').value); item.d=Math.max(100,+$('dField').value); item.h=Math.max(50,+$('hField').value); item.rotation=+$('rField').value;
        buildScene(); selectById(id);
      }

      function rect2D(mesh){ const box=new THREE.Box3().setFromObject(mesh); return {minX:box.min.x,minZ:box.min.z,maxX:box.max.x,maxZ:box.max.z}; }
      function intersect(a,b){return !(a.maxX<=b.minX||b.maxX<=a.minX||a.maxZ<=b.minZ||b.maxZ<=a.minZ);}
      function validate(){
        const warnings=[],meshes=furnitureGroup.children;meshes.forEach(m=>setObjectTint(m,m.userData.color||palette.furniture,selected===m?0x263225:0x000000));
        for(let i=0;i<meshes.length;i++)for(let j=i+1;j<meshes.length;j++)if(intersect(rect2D(meshes[i]),rect2D(meshes[j]))){warnings.push(`${meshes[i].userData.name} overlaps ${meshes[j].userData.name}`);setObjectTint(meshes[i],palette.collision);setObjectTint(meshes[j],palette.collision);}
        project.clearances.forEach(zone=>{const z={minX:mm(zone.x),minZ:mm(zone.y),maxX:mm(zone.x+zone.w),maxZ:mm(zone.y+zone.d)};meshes.forEach(m=>{if(intersect(rect2D(m),z)){warnings.push(`${m.userData.name} blocks ${zone.name}`);setObjectTint(m,palette.collision);}});});
        const fixedObstacles=[...physicalShellItemsV42().filter(x=>(x.h||0)>500),...(project.walls||[])];
        fixedObstacles.forEach(item=>{const z={minX:mm(item.x),minZ:mm(item.y),maxX:mm(item.x+item.w),maxZ:mm(item.y+item.d)};meshes.forEach(m=>{if(intersect(rect2D(m),z)){warnings.push(`${m.userData.name} intersects ${item.name}`);setObjectTint(m,palette.collision);}});});
        const entranceBlocked=warnings.some(x=>x.includes('Entrance route')); const kitchenBlocked=warnings.some(x=>x.includes('Kitchen working aisle')); const overlaps=warnings.some(x=>x.includes('overlaps'));
        $('entranceCheck').textContent=entranceBlocked?'Blocked':'Clear'; $('kitchenCheck').textContent=kitchenBlocked?'Blocked':'Clear'; $('overlapCheck').textContent=overlaps?'Review':'No overlaps';
        $('warningList').innerHTML=warnings.map(x=>`<li>${x}</li>`).join('');
        const status=document.getElementById('collisionStatus'); status.textContent=warnings.length?`${warnings.length} issue${warnings.length>1?'s':''}`:'No collisions'; status.classList.toggle('warn',!!warnings.length);
      }

      function viewTop(){ camera.fov=35; camera.updateProjectionMatrix(); camera.position.set(mm(PLAN_W)/2,18,mm(PLAN_H)/2+.001); orbit.target.set(mm(PLAN_W)/2,0,mm(PLAN_H)/2); camera.up.set(0,0,-1); orbit.update(); setViewButton('viewTop'); }
      function viewBird(){ camera.up.set(0,1,0); camera.fov=50; camera.updateProjectionMatrix(); camera.position.set(19,13,15); orbit.target.set(8,0,4.8); orbit.update(); setViewButton('viewBird'); }
      function viewEye(){ camera.up.set(0,1,0); camera.fov=58; camera.updateProjectionMatrix(); camera.position.set(mm(11200),1.6,mm(8500)); orbit.target.set(mm(9000),1.1,mm(3200)); orbit.update(); setViewButton('viewEye'); }
