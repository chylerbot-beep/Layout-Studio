      // Conservative furniture realignment after architectural walls are corrected.
      // Explicit placement metadata is preferred; otherwise the app infers room, wall,
      // support and dining-group relationships from the current layout.

      const furnitureAlignRow=$('clearDetected')?.parentElement;
      if(furnitureAlignRow&&!$('alignFurniture')){
        const button=document.createElement('button');button.id='alignFurniture';button.textContent='Align furniture';
        button.title='Conservatively repair furniture and flush carpentry to its nearest intended wall without crossing to the other side. One undo restores the previous layout.';
        furnitureAlignRow.appendChild(button);
      }
      if(!$('furnitureAlignStatus')&&$('basemapStatus')){
        const status=document.createElement('p');status.id='furnitureAlignStatus';status.className='small';
        status.textContent='Align furniture preserves room, wall side, support and dining-group intent. Carpentry is flushed to its intended wall without crossing through it.';
        $('basemapStatus').insertAdjacentElement('afterend',status);
      }

      function alignAngle180(value){let a=((value%180)+180)%180;return a>90?a-180:a;}
      function closestEquivalentAngle(target,current){
        let best=target,bestDelta=Infinity;for(let k=-3;k<=3;k++){const value=target+k*180,delta=Math.abs(value-current);if(delta<bestDelta){best=value;bestDelta=delta;}}return best;
      }
      function angleDifference180(a,b){return Math.abs(alignAngle180(a-b));}
      function furnitureCentre(item){return{x:item.x+item.w/2,y:item.y+item.d/2};}
      function furnitureVerticalSpan(item){const min=Math.max(0,+item.elevation||0);return{min,max:min+Math.max(1,+item.h||1)};}
      function furnitureAabb(item,x=item.x,y=item.y,rotation=item.rotation||0){
        const r=THREE.MathUtils.degToRad(rotation),c=Math.abs(Math.cos(r)),s=Math.abs(Math.sin(r)),halfX=c*item.w/2+s*item.d/2,halfY=s*item.w/2+c*item.d/2,cx=x+item.w/2,cy=y+item.d/2;
        return{minX:cx-halfX,maxX:cx+halfX,minY:cy-halfY,maxY:cy+halfY,cx,cy,halfX,halfY};
      }
      function boxesOverlap2D(a,b,tolerance=0){return!(a.maxX<=b.minX+tolerance||b.maxX<=a.minX+tolerance||a.maxY<=b.minY+tolerance||b.maxY<=a.minY+tolerance);}
      function spansOverlap(a,b,tolerance=1){return!(a.max<=b.min+tolerance||b.max<=a.min+tolerance);}
      function roomForFurniture(item){
        const explicit=(project.rooms||[]).find(room=>room.id===item.placement?.roomId);if(explicit)return explicit;
        const c=furnitureCentre(item),inside=(project.rooms||[]).filter(room=>c.x>=room.x&&c.x<=room.x+room.w&&c.y>=room.y&&c.y<=room.y+room.d);
        if(inside.length)return inside.sort((a,b)=>a.w*a.d-b.w*b.d)[0];
        let best=null,bestDistance=Infinity;(project.rooms||[]).forEach(room=>{const rx=room.x+room.w/2,ry=room.y+room.d/2,d=Math.hypot(c.x-rx,c.y-ry);if(d<bestDistance){best=room;bestDistance=d;}});return best;
      }
      function roomOverflow(box,room,margin=35){
        if(!room)return 0;return Math.max(0,room.x+margin-box.minX)+Math.max(0,box.maxX-(room.x+room.w-margin))+Math.max(0,room.y+margin-box.minY)+Math.max(0,box.maxY-(room.y+room.d-margin));
      }
      function wallObstacleBox(wall,extra=8){
        const e=wallMetrics(wall),half=e.thickness/2+extra;return{minX:Math.min(e.x1,e.x2)-half,maxX:Math.max(e.x1,e.x2)+half,minY:Math.min(e.y1,e.y2)-half,maxY:Math.max(e.y1,e.y2)+half};
      }
      function itemProjectionHalf(item,rotation,nx,ny){
        const r=THREE.MathUtils.degToRad(rotation),wx=Math.cos(r),wy=Math.sin(r),dx=-wy,dy=wx;
        return Math.abs(nx*wx+ny*wy)*item.w/2+Math.abs(nx*dx+ny*dy)*item.d/2;
      }
      function nearestWallForFurniture(item,walls,preferredId=null){
        const preferred=preferredId&&walls.find(w=>w.id===preferredId);if(preferred)return{wall:preferred,...wallDistanceForItem(item,preferred)};
        const anchored=isWallAnchoredFurniture(item);let best=null;(walls||[]).forEach(wall=>{const data=wallDistanceForItem(item,wall),e=wallMetrics(wall),wallDeg=THREE.MathUtils.radToDeg(e.angle),target=item.w>=item.d?-wallDeg:90-wallDeg,orientation=angleDifference180(item.rotation||0,target),score=data.surfaceDistance+(anchored?orientation*35:0)+Math.min(600,data.centreDistance*.04);if(!best||score<best.score)best={wall,...data,score};});return best;
      }
      function wallDistanceForItem(item,wall){
        const e=wallMetrics(wall),c=furnitureCentre(item),vx=c.x-e.x1,vy=c.y-e.y1,along=Math.max(0,Math.min(e.length,vx*e.ux+vy*e.uy)),px=e.x1+e.ux*along,py=e.y1+e.uy*along,nx=-e.uy,ny=e.ux,signed=(c.x-px)*nx+(c.y-py)*ny,half=itemProjectionHalf(item,item.rotation||0,nx,ny);
        return{along,px,py,nx,ny,signed,surfaceDistance:Math.max(0,Math.abs(signed)-e.thickness/2-half),centreDistance:Math.hypot(c.x-px,c.y-py)};
      }
      function wallAlignedCandidate(item,wall,room,sideSign=null){
        const e=wallMetrics(wall),wallDeg=THREE.MathUtils.radToDeg(e.angle),targetBase=item.w>=item.d?-wallDeg:90-wallDeg,rotation=closestEquivalentAngle(targetBase,item.rotation||0),c=furnitureCentre(item),nx=-e.uy,ny=e.ux;
        let signed=(c.x-e.x1)*nx+(c.y-e.y1)*ny,sign=sideSign||Math.sign(signed)||1;
        if(!sideSign&&Math.abs(signed)<1&&room){const rc={x:room.x+room.w/2,y:room.y+room.d/2};sign=Math.sign((rc.x-e.x1)*nx+(rc.y-e.y1)*ny)||1;}
        const halfNormal=itemProjectionHalf(item,rotation,nx,ny),halfTangent=itemProjectionHalf(item,rotation,e.ux,e.uy),savedGap=Number.isFinite(+item.placement?.gap)?Math.max(0,+item.placement.gap):20,gap=item.category==='carpentry'?0:savedGap,desired=sign*(e.thickness/2+halfNormal+gap);
        let along=(c.x-e.x1)*e.ux+(c.y-e.y1)*e.uy;along=Math.max(halfTangent+25,Math.min(e.length-halfTangent-25,along));
        const cx=e.x1+e.ux*along+nx*desired,cy=e.y1+e.uy*along+ny*desired;
        return{x:Math.round((cx-item.w/2)/5)*5,y:Math.round((cy-item.d/2)/5)*5,rotation:Math.round(rotation*10)/10,wallId:wall.id};
      }
      function doorClearanceBoxes(){
        const boxes=[];(project.openings||[]).filter(op=>op.type==='door').forEach(op=>{const wall=(project.walls||[]).find(w=>w.id===op.wallId);if(!wall)return;const e=wallMetrics(wall),cx=e.x1+e.ux*op.offset,cy=e.y1+e.uy*op.offset,nx=-e.uy,ny=e.ux,halfW=op.width/2+80,depth=Math.max(750,Math.min(1100,op.width));const corners=[];[-halfW,halfW].forEach(t=>[-depth,depth].forEach(n=>corners.push({x:cx+e.ux*t+nx*n,y:cy+e.uy*t+ny*n})));boxes.push({minX:Math.min(...corners.map(p=>p.x)),maxX:Math.max(...corners.map(p=>p.x)),minY:Math.min(...corners.map(p=>p.y)),maxY:Math.max(...corners.map(p=>p.y)),name:op.name});});return boxes;
      }
      function openingObstaclesV45(){
        const out=[];(project.openings||[]).forEach(opening=>{const wall=(project.walls||[]).find(item=>item.id===opening.wallId);if(!wall)return;const e=wallMetrics(wall),cx=e.x1+e.ux*(+opening.offset||0),cy=e.y1+e.uy*(+opening.offset||0),halfAlong=(+opening.width||0)/2,halfNormal=e.thickness/2+15,corners=[];[-halfAlong,halfAlong].forEach(a=>[-halfNormal,halfNormal].forEach(n=>corners.push({x:cx+e.ux*a-e.uy*n,y:cy+e.uy*a+e.ux*n})));out.push({minX:Math.min(...corners.map(p=>p.x)),maxX:Math.max(...corners.map(p=>p.x)),minY:Math.min(...corners.map(p=>p.y)),maxY:Math.max(...corners.map(p=>p.y)),vertical:{min:+opening.sill||0,max:(+opening.sill||0)+(+opening.height||0)},opening});});return out;
      }
      function wallMountedOpeningIssuesV45(item,candidate){
        if(item.placement?.mode!=='wall'||!item.placement?.wallId)return[];const wall=(project.walls||[]).find(entry=>entry.id===item.placement.wallId);if(!wall)return[];const e=wallMetrics(wall),cx=candidate.x+item.w/2,cy=candidate.y+item.d/2,along=(cx-e.x1)*e.ux+(cy-e.y1)*e.uy,half=itemProjectionHalf(item,candidate.rotation,e.ux,e.uy),vertical=furnitureVerticalSpan(item);
        return (project.openings||[]).filter(opening=>opening.wallId===wall.id&&along+half>(+opening.offset||0)-(+opening.width||0)/2+5&&along-half<(+opening.offset||0)+(+opening.width||0)/2-5&&spansOverlap(vertical,{min:+opening.sill||0,max:(+opening.sill||0)+(+opening.height||0)},5));
      }
      function candidateIssues(item,candidate,items,excludeIds,context){
        const box=furnitureAabb(item,candidate.x,candidate.y,candidate.rotation),vertical=furnitureVerticalSpan(item),issues=[];
        if(box.minX<0||box.minY<0||box.maxX>context.planWidth||box.maxY>context.planDepth)issues.push('outside plan');
        context.walls.forEach(wall=>{const extra=candidate.flushWallId===wall.id?0:8;if(spansOverlap(vertical,{min:0,max:wall.h||2700})&&boxesOverlap2D(box,wallObstacleBox(wall,extra)))issues.push('wall');});
        context.shell.forEach(obstacle=>{const ob={minX:obstacle.x,maxX:obstacle.x+obstacle.w,minY:obstacle.y,maxY:obstacle.y+obstacle.d},ov={min:0,max:obstacle.h||0};if(spansOverlap(vertical,ov)&&boxesOverlap2D(box,ob))issues.push('fixed');});
        context.openings.forEach(obstacle=>{if(spansOverlap(vertical,obstacle.vertical)&&boxesOverlap2D(box,obstacle))issues.push(obstacle.opening.type);});
        wallMountedOpeningIssuesV45(item,candidate).forEach(opening=>issues.push(opening.type));
        if((+item.elevation||0)<1200){context.doors.forEach(door=>{if(boxesOverlap2D(box,door))issues.push('door');});context.clearances.forEach(zone=>{const z={minX:zone.x,maxX:zone.x+zone.w,minY:zone.y,maxY:zone.y+zone.d};if(boxesOverlap2D(box,z))issues.push('clearance');});}
        items.forEach(other=>{if(other.id===item.id||excludeIds.has(other.id))return;const otherBox=furnitureAabb(other),otherVertical=furnitureVerticalSpan(other);if(spansOverlap(vertical,otherVertical)&&boxesOverlap2D(box,otherBox,2))issues.push('furniture');});
        return issues;
      }
      function candidateScore(item,candidate,origin,room,items,excludeIds,context,wallTarget=null){
        const issues=candidateIssues(item,candidate,items,excludeIds,context);if(issues.length)return{score:1e9+issues.length*1e6,issues};
        const box=furnitureAabb(item,candidate.x,candidate.y,candidate.rotation),distance=Math.hypot(candidate.x-origin.x,candidate.y-origin.y),rotationPenalty=angleDifference180(candidate.rotation,origin.rotation||0)*5,overflow=roomOverflow(box,room)*6;
        let score=distance+rotationPenalty+overflow;
        if(wallTarget){const test={...item,x:candidate.x,y:candidate.y,rotation:candidate.rotation},wd=wallDistanceForItem(test,wallTarget);score+=Math.min(1200,wd.surfaceDistance)*1.8;}
        return{score,issues:[]};
      }
      function sortedGridOffsets(radius=1200,step=100){
        const out=[];for(let dx=-radius;dx<=radius;dx+=step)for(let dy=-radius;dy<=radius;dy+=step){const d=Math.hypot(dx,dy);if(d<=radius)out.push({dx,dy,d});}return out.sort((a,b)=>a.d-b.d);
      }
      const furnitureAlignOffsets=sortedGridOffsets(1200,100);
      function isWallAnchoredFurniture(item){
        if(item.placement?.mode==='wall'||item.placement?.wallId)return true;
        return item.category==='carpentry'||/wardrobe|cabinet|worktop|tv console|hosting console|\bconsole\b/i.test(item.name||'');
      }
      function isBedFurniture(item){return /\bbed\b/i.test(item.name||'');}
      function inferredGroupId(item){if(item.placement?.groupId)return item.placement.groupId;return /dining/i.test(item.name||'')?'dining-set':null;}
      function inferSupportLinks(items){
        const links=[];items.forEach(child=>{if((+child.elevation||0)<=0)return;let support=null;
          const explicit=child.placement?.supportId&&items.find(item=>item.id===child.placement.supportId);if(explicit)support=explicit;
          if(!support){const cc=furnitureCentre(child);let bestArea=Infinity;items.forEach(candidate=>{if(candidate.id===child.id)return;const top=(+candidate.elevation||0)+(+candidate.h||0);if(Math.abs(top-(+child.elevation||0))>55)return;const box=furnitureAabb(candidate);if(cc.x<box.minX-35||cc.x>box.maxX+35||cc.y<box.minY-35||cc.y>box.maxY+35)return;const area=candidate.w*candidate.d;if(area<bestArea){support=candidate;bestArea=area;}});}
          if(!support)return;const sc=furnitureCentre(support),cc=furnitureCentre(child);links.push({childId:child.id,supportId:support.id,oldSupport:{...sc,rotation:support.rotation||0},oldChild:{...cc,rotation:child.rotation||0}});});return links;
      }
      function carrySupportedObjects(items,links){
        let carried=0;links.forEach(link=>{const support=items.find(item=>item.id===link.supportId),child=items.find(item=>item.id===link.childId);if(!support||!child)return;const sc=furnitureCentre(support),delta=THREE.MathUtils.degToRad((support.rotation||0)-link.oldSupport.rotation),vx=link.oldChild.x-link.oldSupport.x,vy=link.oldChild.y-link.oldSupport.y,rx=vx*Math.cos(delta)-vy*Math.sin(delta),ry=vx*Math.sin(delta)+vy*Math.cos(delta),cx=sc.x+rx,cy=sc.y+ry;
          child.x=Math.round((cx-child.w/2)/25)*25;child.y=Math.round((cy-child.d/2)/25)*25;child.rotation=Math.round((link.oldChild.rotation+THREE.MathUtils.radToDeg(delta))*10)/10;child.elevation=Math.max(0,(+support.elevation||0)+(+support.h||0));child.placement={...(child.placement||{}),mode:'support',supportId:support.id,roomId:support.placement?.roomId||child.placement?.roomId};carried++;});return carried;
      }
      function groupPlacementIssues(group,items,dx,dy,context){
        const ids=new Set(group.map(item=>item.id));let count=0;group.forEach(item=>{const candidate={x:item.x+dx,y:item.y+dy,rotation:item.rotation||0};count+=candidateIssues(item,candidate,items,ids,context).length;});return count;
      }
      function alignFurnitureGroup(group,items,context){
        const anchor=group.find(item=>/table/i.test(item.name||''))||group[0],room=roomForFurniture(anchor),origin={x:0,y:0};let best={dx:0,dy:0,issues:groupPlacementIssues(group,items,0,0,context),score:Infinity};
        if(!best.issues)return{moved:0,unresolved:0};
        furnitureAlignOffsets.forEach(offset=>{const issues=groupPlacementIssues(group,items,offset.dx,offset.dy,context);if(issues)return;let overflow=0;group.forEach(item=>overflow+=roomOverflow(furnitureAabb(item,item.x+offset.dx,item.y+offset.dy,item.rotation||0),room));const score=offset.d+overflow*5;if(score<best.score)best={...offset,issues:0,score};});
        if(best.issues)return{moved:0,unresolved:1};group.forEach(item=>{item.x+=best.dx;item.y+=best.dy;item.placement={...(item.placement||{}),groupId:inferredGroupId(item),roomId:room?.id||item.placement?.roomId,mode:item.placement?.mode||'free'};});return{moved:group.length,unresolved:0};
      }
      function alignSingleFurniture(item,items,context){
        const wallDecor=item.category==='decorative'&&item.placement?.mode==='wall'&&item.placement?.wallId;
        if(((+item.elevation||0)>25||item.category==='decorative')&&!wallDecor)return{moved:false,rotated:false,unresolved:false};
        const room=roomForFurniture(item);if(room)item.placement={...(item.placement||{}),roomId:room.id};
        const walls=context.walls,preferredWall=item.placement?.wallId||null,nearest=nearestWallForFurniture(item,walls,preferredWall),wallAnchored=isWallAnchoredFurniture(item),bed=isBedFurniture(item),original={x:item.x,y:item.y,rotation:item.rotation||0};
        const originalIssues=candidateIssues(item,original,items,new Set([item.id]),context),shouldSnap=!!nearest&&(wallAnchored||(bed&&nearest.surfaceDistance<=900));
        const alreadyAligned=shouldSnap&&nearest.surfaceDistance<=80&&angleDifference180(original.rotation,item.w>=item.d?-THREE.MathUtils.radToDeg(wallMetrics(nearest.wall).angle):90-THREE.MathUtils.radToDeg(wallMetrics(nearest.wall).angle))<=6;
        if(!originalIssues.length&&(!shouldSnap||alreadyAligned))return{moved:false,rotated:false,unresolved:false};
        let originalSide=nearest?Math.sign(nearest.signed):0;if(!originalSide&&nearest&&room){const e=wallMetrics(nearest.wall),nx=-e.uy,ny=e.ux,rc={x:room.x+room.w/2,y:room.y+room.d/2};originalSide=Math.sign((rc.x-e.x1)*nx+(rc.y-e.y1)*ny);}if(!originalSide)originalSide=1;
        const bases=[original];if(shouldSnap)bases.push(wallAlignedCandidate(item,nearest.wall,room,originalSide));
        let best={candidate:original,...candidateScore(item,original,original,room,items,new Set([item.id]),context,shouldSnap?nearest.wall:null)};
        bases.forEach(base=>{if(shouldSnap&&base!==original){const e=wallMetrics(nearest.wall),limit=wallDecor?Math.min(3000,e.length):600;for(let shift=-limit;shift<=limit;shift+=50){const candidate={x:base.x+e.ux*shift,y:base.y+e.uy*shift,rotation:base.rotation,flushWallId:base.wallId},result=candidateScore(item,candidate,original,room,items,new Set([item.id]),context,nearest.wall);if(result.score<best.score)best={candidate,...result};}return;}if(shouldSnap)return;furnitureAlignOffsets.forEach(offset=>{const candidate={x:base.x+offset.dx,y:base.y+offset.dy,rotation:base.rotation},result=candidateScore(item,candidate,original,room,items,new Set([item.id]),context,null);if(result.score<best.score)best={candidate,...result};});});
        if(best.score>=1e9)return{moved:false,rotated:false,unresolved:true};const changed=Math.hypot(best.candidate.x-original.x,best.candidate.y-original.y)>1||angleDifference180(best.candidate.rotation,original.rotation)>1;
        if(!changed)return{moved:false,rotated:false,unresolved:false};item.x=Math.round(best.candidate.x);item.y=Math.round(best.candidate.y);item.rotation=Math.round(best.candidate.rotation*10)/10;
        if(shouldSnap)item.placement={...(item.placement||{}),mode:'wall',wallId:nearest.wall.id,gap:item.category==='carpentry'?0:(Number.isFinite(+item.placement?.gap)?Math.max(0,+item.placement.gap):20)};else item.placement={...(item.placement||{}),mode:item.placement?.mode||'free'};
        return{moved:true,rotated:angleDifference180(item.rotation,original.rotation)>1,unresolved:false};
      }
      function autoAlignFurniture(){
        if(!(project.furniture||[]).length){$('furnitureAlignStatus').textContent='No furniture is available to align.';return;}
        const working=JSON.parse(JSON.stringify(project.furniture)),before=JSON.stringify(working),supportLinks=inferSupportLinks(working),planWidth=project.basemap?.width||project.plan?.width||PLAN_W,planDepth=project.basemap?.depth||project.plan?.depth||PLAN_H;
        const context={planWidth,planDepth,walls:(project.walls||[]).filter(w=>!w.detected),shell:physicalShellItemsV42().filter(x=>(x.h||0)>80),doors:doorClearanceBoxes(),openings:openingObstaclesV45(),clearances:project.clearances||[]};
        let moved=0,rotated=0,unresolved=0;
        const grouped=new Map();working.forEach(item=>{const groupId=inferredGroupId(item);if(!groupId||(+item.elevation||0)>25)return;if(!grouped.has(groupId))grouped.set(groupId,[]);grouped.get(groupId).push(item);});
        const groupedIds=new Set();grouped.forEach(group=>{if(group.length<2)return;group.forEach(item=>groupedIds.add(item.id));const result=alignFurnitureGroup(group,working,context);moved+=result.moved;unresolved+=result.unresolved;});
        working.filter(item=>!groupedIds.has(item.id)).sort((a,b)=>Number(isWallAnchoredFurniture(b))-Number(isWallAnchoredFurniture(a))||(b.w*b.d-a.w*a.d)).forEach(item=>{const result=alignSingleFurniture(item,working,context);if(result.moved)moved++;if(result.rotated)rotated++;if(result.unresolved)unresolved++;});
        const carried=carrySupportedObjects(working,supportLinks),changed=JSON.stringify(working)!==before;
        if(!changed){$('furnitureAlignStatus').textContent=unresolved?`No safe automatic move was found for ${unresolved} placement${unresolved===1?'':'s'}. The layout was left unchanged.`:'Furniture already satisfies the conservative alignment rules. No objects were moved.';return;}
        pushHistory('align furniture');project.furniture=working;select(null);buildScene();$('furnitureAlignStatus').textContent=`Aligned ${moved} floor object${moved===1?'':'s'}${rotated?`, rotated ${rotated}`:''}${carried?`, and carried ${carried} supported decorative object${carried===1?'':'s'}`:''}.${unresolved?` ${unresolved} placement${unresolved===1?' remains':'s remain'} for manual review.`:' Review the result, then use Undo if the design intent changed.'}`;
      }
      if($('alignFurniture'))$('alignFurniture').onclick=autoAlignFurniture;
