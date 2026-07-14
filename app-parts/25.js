      // Architecture-first startup cleanup. A newly uploaded or legacy basemap project
      // enters wall review, hides furniture, replaces overlapping wall suggestions,
      // detects likely door symbols, then reveals and aligns furniture after confirmation.
      let wallReviewActiveV32=false,wallReviewStartKeyV32='';

      function wallReviewUiSectionsV32(){
        return [$('catalog'),$('carpentryCatalog'),$('decorativeCatalog'),$('objectList')].map(node=>node?.closest('.section')).filter((node,index,list)=>node&&list.indexOf(node)===index);
      }
      function setFurnitureReviewVisibilityV32(visible){
        if(!visible&&selected)select(null);
        furnitureGroup.visible=visible;
        wallReviewUiSectionsV32().forEach(section=>section.hidden=!visible);
        if($('alignFurniture'))$('alignFurniture').hidden=!visible;
      }
      function setWallReviewStatusV32(message,complete=false){
        if($('wallReviewStatus'))$('wallReviewStatus').textContent=message;
        $('wallReviewWorkflow')?.classList.toggle('review-complete',complete);
      }
      function expandArchitectureReviewV32(){
        const section=[...document.querySelectorAll('.panel.left > .section')].find(node=>node.querySelector(':scope > h2')?.textContent.trim()==='Architecture');
        const body=section?.querySelector(':scope > .section-collapse-body');if(body)body.hidden=false;
        section?.classList.remove('section-collapsed');
        const toggle=section?.querySelector(':scope > h2 > .section-collapse-toggle');if(toggle){toggle.setAttribute('aria-expanded','true');toggle.textContent='Hide';}
        const walls=section?.querySelector('details.toggle-group');if(walls)walls.open=true;
      }

      function wallLineMatchV32(wall,segment){
        const e=wallMetrics(wall);if(e.horizontal!==segment.horizontal)return null;
        const a=e.horizontal?Math.min(e.x1,e.x2):Math.min(e.y1,e.y2),b=e.horizontal?Math.max(e.x1,e.x2):Math.max(e.y1,e.y2),p=e.horizontal?e.y1:e.x1;
        const overlap=Math.max(0,Math.min(b,segment.b)-Math.max(a,segment.a)),gap=overlap?0:Math.max(segment.a-b,a-segment.b,0),shorter=Math.max(1,Math.min(b-a,segment.b-segment.a)),perp=Math.abs(p-segment.p);
        if(perp>Math.max(300,(e.thickness+(segment.thickness||120))*1.2)||overlap/shorter<.28&&gap>220)return null;
        return{score:perp*2+gap+Math.abs((b-a)-(segment.b-segment.a))*.08-overlap*.03,overlap};
      }
      function remapOpeningToWallV32(opening,oldWall,newWall){
        const old=wallMetrics(oldWall),next=wallMetrics(newWall),cx=old.x1+old.ux*(+opening.offset||0),cy=old.y1+old.uy*(+opening.offset||0);
        opening.wallId=newWall.id;opening.offset=Math.max((+opening.width||750)/2+25,Math.min(next.length-(+opening.width||750)/2-25,(cx-next.x1)*next.ux+(cy-next.y1)*next.uy));
      }
      function mergeWallPairV32(keep,remove){
        const a=wallMetrics(keep),b=wallMetrics(remove),origin={x:a.x1,y:a.y1},values=[0,a.length,(b.x1-origin.x)*a.ux+(b.y1-origin.y)*a.uy,(b.x2-origin.x)*a.ux+(b.y2-origin.y)*a.uy],min=Math.min(...values),max=Math.max(...values),thickness=Math.max(a.thickness,b.thickness);
        const oldKeep={...keep};setWallFromEndpoints(keep,origin.x+a.ux*min,origin.y+a.uy*min,origin.x+a.ux*max,origin.y+a.uy*max,thickness);keep.detected=!!(keep.detected||remove.detected);keep.autoDetected=!!(keep.autoDetected||remove.autoDetected);
        (project.openings||[]).forEach(opening=>{if(opening.wallId===oldKeep.id)remapOpeningToWallV32(opening,oldKeep,keep);else if(opening.wallId===remove.id)remapOpeningToWallV32(opening,remove,keep);});
        project.walls=project.walls.filter(wall=>wall.id!==remove.id);
        const seen=[];project.openings=project.openings.filter(opening=>{if(opening.wallId!==keep.id)return true;const duplicate=seen.some(other=>other.type===opening.type&&Math.abs(other.offset-opening.offset)<140);if(!duplicate)seen.push(opening);return !duplicate;});
      }
      function overlappingAlignedWallV32(wall){
        const a=wallMetrics(wall);let best=null;(project.walls||[]).forEach(other=>{if(other.id===wall.id)return;const b=wallMetrics(other),parallel=Math.abs(a.ux*b.ux+a.uy*b.uy);if(parallel<.996)return;const perp=Math.abs((b.cx-a.cx)*(-a.uy)+(b.cy-a.cy)*a.ux);if(perp>Math.max(90,(a.thickness+b.thickness)*.65))return;const aa=[0,a.length],bb=[(b.x1-a.x1)*a.ux+(b.y1-a.y1)*a.uy,(b.x2-a.x1)*a.ux+(b.y2-a.y1)*a.uy].sort((m,n)=>m-n),overlap=Math.min(aa[1],bb[1])-Math.max(aa[0],bb[0]);if(overlap<80)return;const score=perp-overlap*.01;if(!best||score<best.score)best={wall:other,score};});return best?.wall||null;
      }
      function mergeAllWallOverlapsV32(){
        let merged=0,changed=true;while(changed){changed=false;for(const wall of [...project.walls]){const other=overlappingAlignedWallV32(wall);if(!other)continue;mergeWallPairV32(wall,other);merged++;changed=true;break;}}return merged;
      }

      detectWalls=function(){
        if(!basemapImage){alert('Upload a floor-plan image first.');return;}
        const lines=getDetectedWallSegments(true);if(!lines.length){$('toolHint').textContent='No reliable wall bands were found. Confirm the plan dimensions or edit the walls manually.';setWallReviewStatusV32('No reliable wall bands found · manual review required');return;}
        pushHistory('replace walls from basemap');const candidates=[...(project.walls||[])],used=new Set(),kept=new Set(),wh=+$('wallHeight').value||2700,stamp=Date.now();let replaced=0,added=0;
        lines.slice(0,60).forEach((line,index)=>{let best=null;candidates.forEach(wall=>{if(used.has(wall.id))return;const match=wallLineMatchV32(wall,line);if(match&&(!best||match.score<best.score))best={wall,...match};});
          const thickness=line.thickness||Math.max(80,+$('wallThickness').value||120);let wall;
          if(best){wall=best.wall;used.add(wall.id);kept.add(wall.id);const name=wall.name,id=wall.id,h=wall.h||wh;if(line.horizontal)setWallFromEndpoints(wall,line.a,line.p,line.b,line.p,thickness);else setWallFromEndpoints(wall,line.p,line.a,line.p,line.b,thickness);wall.id=id;wall.name=name;wall.h=h;wall.detected=true;wall.autoDetected=true;replaced++;}
          else{wall={id:`detected-${stamp}-${index}`,name:`Detected wall ${index+1}`,h:wh,detected:true,autoDetected:true};if(line.horizontal)setWallFromEndpoints(wall,line.a,line.p,line.b,line.p,thickness);else setWallFromEndpoints(wall,line.p,line.a,line.p,line.b,thickness);project.walls.push(wall);kept.add(wall.id);added++;}
        });
        const removedIds=new Set(candidates.filter(wall=>wall.detected&&!kept.has(wall.id)).map(wall=>wall.id));project.walls=project.walls.filter(wall=>!removedIds.has(wall.id));project.openings=(project.openings||[]).filter(opening=>!removedIds.has(opening.wallId));const merged=mergeAllWallOverlapsV32();
        buildScene();setWallReviewStatusV32(`${replaced} walls replaced · ${added} missing walls added${merged?` · ${merged} overlaps merged`:''}`);$('toolHint').textContent=`Basemap cleanup replaced ${replaced} matching walls and added ${added} missing walls without stacking duplicates. Review the red unconfirmed-wall outlines before confirming.`;
      };

      function sampleDoorGapsForWallV32(wall,analysis,gray){
        const e=wallMetrics(wall),p1=worldToBasemapPixel(e.x1,e.y1,analysis),p2=worldToBasemapPixel(e.x2,e.y2,analysis);if(!p1||!p2)return[];const dx=p2.x-p1.x,dy=p2.y-p1.y,lengthPx=Math.hypot(dx,dy);if(lengthPx<30)return[];
        const ux=dx/lengthPx,uy=dy/lengthPx,nx=-uy,ny=ux,mmPerPx=e.length/lengthPx,half=Math.max(1,Math.min(10,Math.round(e.thickness/mmPerPx*.45))),step=2,count=Math.floor(lengthPx/step),density=[];
        for(let i=0;i<=count;i++){const along=i*step;let dark=0,total=0;for(let n=-half;n<=half;n++){const x=Math.round(p1.x+ux*along+nx*n),y=Math.round(p1.y+uy*along+ny*n);if(x<0||x>=analysis.w||y<0||y>=analysis.h)continue;total++;if(gray[y*analysis.w+x]<188)dark++;}density.push(total?dark/total:1);}
        const smoothed=density.map((_,i)=>{let sum=0,n=0;for(let k=Math.max(0,i-2);k<=Math.min(density.length-1,i+2);k++){sum+=density[k];n++;}return sum/n;}),runs=[];let start=-1;
        for(let i=1;i<smoothed.length-1;i++){if(smoothed[i]<.24){if(start<0)start=i;}else if(start>=0){runs.push([start,i-1]);start=-1;}}if(start>=0)runs.push([start,smoothed.length-2]);
        return runs.map(([a,b])=>{const width=(b-a+1)*step*mmPerPx,centre=(a+b)/2*step*mmPerPx,before=density.slice(Math.max(0,a-8),a),after=density.slice(b+1,Math.min(density.length,b+9)),avg=list=>list.length?list.reduce((s,v)=>s+v,0)/list.length:0;if(width<600||width>1350||avg(before)<.3||avg(after)<.3)return null;
          const centrePx=(a+b)/2*step,sidePx=Math.max(5,Math.round(900/mmPerPx)),spanPx=Math.max(4,Math.round(width/mmPerPx/2)),sideDensity=sign=>{let dark=0,total=0;for(let t=-spanPx;t<=spanPx;t+=2)for(let n=half+2;n<=sidePx;n+=2){const x=Math.round(p1.x+ux*(centrePx+t)+nx*n*sign),y=Math.round(p1.y+uy*(centrePx+t)+ny*n*sign);if(x<0||x>=analysis.w||y<0||y>=analysis.h)continue;total++;if(gray[y*analysis.w+x]<178)dark++;}return total?dark/total:0;};const symbol=Math.max(sideDensity(1),sideDensity(-1));if(symbol<.012||symbol>.34)return null;return{wallId:wall.id,offset:Math.round(centre/25)*25,width:Math.round(Math.max(650,Math.min(1200,width))/50)*50,score:symbol};}).filter(Boolean);
      }
      function doorSymbolInkV32(centre,direction,width,thickness,analysis,gray){
        const p=worldToBasemapPixel(centre.x,centre.y,analysis),q=worldToBasemapPixel(centre.x+direction.x*1000,centre.y+direction.y*1000,analysis);if(!p||!q)return 0;const vx=q.x-p.x,vy=q.y-p.y,length=Math.hypot(vx,vy);if(!length)return 0;const ux=vx/length,uy=vy/length,nx=-uy,ny=ux,pxPerMm=length/1000,span=Math.max(4,Math.round(width*pxPerMm/2)),inner=Math.max(2,Math.round(thickness*pxPerMm/2)+2),outer=Math.max(inner+3,Math.round(900*pxPerMm));
        const density=sign=>{let dark=0,total=0;for(let t=-span;t<=span;t+=2)for(let n=inner;n<=outer;n+=2){const x=Math.round(p.x+ux*t+nx*n*sign),y=Math.round(p.y+uy*t+ny*n*sign);if(x<0||x>=analysis.w||y<0||y>=analysis.h)continue;total++;if(gray[y*analysis.w+x]<178)dark++;}return total?dark/total:0;};return Math.max(density(1),density(-1));
      }
      function doorGapPairsV32(analysis,gray){
        const out=[],walls=project.walls||[];for(let i=0;i<walls.length;i++)for(let j=i+1;j<walls.length;j++){
          const first=walls[i],second=walls[j],a=wallMetrics(first),b=wallMetrics(second),parallel=Math.abs(a.ux*b.ux+a.uy*b.uy);if(parallel<.996)continue;const perpendicular=Math.abs((b.cx-a.cx)*(-a.uy)+(b.cy-a.cy)*a.ux);if(perpendicular>Math.max(100,(a.thickness+b.thickness)*.7))continue;
          const interval=[(b.x1-a.x1)*a.ux+(b.y1-a.y1)*a.uy,(b.x2-a.x1)*a.ux+(b.y2-a.y1)*a.uy].sort((m,n)=>m-n);let start,end;if(interval[0]>a.length){start=a.length;end=interval[0];}else if(interval[1]<0){start=interval[1];end=0;}else continue;const width=end-start;if(width<600||width>1350)continue;
          const along=(start+end)/2,centre={x:a.x1+a.ux*along,y:a.y1+a.uy*along},symbol=doorSymbolInkV32(centre,{x:a.ux,y:a.uy},width,Math.max(a.thickness,b.thickness),analysis,gray);if(symbol<.012||symbol>.34)continue;
          out.push({wallAId:first.id,wallBId:second.id,centre,width:Math.round(Math.max(650,Math.min(1200,width))/50)*50,score:symbol,pair:true});
        }return out;
      }
      function doorCandidateCentreV32(candidate){if(candidate.pair)return candidate.centre;const wall=(project.walls||[]).find(item=>item.id===candidate.wallId);if(!wall)return null;const e=wallMetrics(wall);return{x:e.x1+e.ux*candidate.offset,y:e.y1+e.uy*candidate.offset};}
      function doorWorldCentreV32(door){const wall=(project.walls||[]).find(item=>item.id===door.wallId);if(!wall)return null;const e=wallMetrics(wall);return{x:e.x1+e.ux*(+door.offset||0),y:e.y1+e.uy*(+door.offset||0)};}
      function detectDoorsV32(){
        if(!basemapImage?.complete||!project.basemap){alert('Upload a floor-plan image first.');return;}const analysis=makeBasemapAnalysis(true,1400),mask=analysis&&makeWallMask(analysis,195);if(!analysis||!mask)return;
        const candidates=doorGapPairsV32(analysis,mask.gray);(project.walls||[]).forEach(wall=>candidates.push(...sampleDoorGapsForWallV32(wall,analysis,mask.gray)));const unique=[];candidates.sort((a,b)=>Number(b.pair)-Number(a.pair)||b.score-a.score).forEach(candidate=>{const centre=doorCandidateCentreV32(candidate);if(!centre||unique.some(item=>{const other=doorCandidateCentreV32(item);return other&&Math.hypot(other.x-centre.x,other.y-centre.y)<450;}))return;unique.push(candidate);});
        if(!unique.length){$('toolHint').textContent='No reliable door symbols were found. Existing doors were kept for manual review.';setWallReviewStatusV32('Walls detected · no reliable door symbols found');return;}
        pushHistory('auto-detect doors');const doors=(project.openings||[]).filter(item=>item.type==='door'),used=new Set(),wallRemap=new Map();let moved=0,added=0,joined=0;
        const resolveWall=id=>{let current=id;while(wallRemap.has(current))current=wallRemap.get(current);return project.walls.find(item=>item.id===current)||null;};
        unique.forEach((candidate,index)=>{let wall,centre;if(candidate.pair){const first=resolveWall(candidate.wallAId),second=resolveWall(candidate.wallBId);if(!first||!second||first.id===second.id)return;mergeWallPairV32(first,second);wallRemap.set(second.id,first.id);wall=first;centre=candidate.centre;joined++;}else{wall=resolveWall(candidate.wallId);if(!wall)return;const metrics=wallMetrics(wall);centre={x:metrics.x1+metrics.ux*candidate.offset,y:metrics.y1+metrics.uy*candidate.offset};}const metrics=wallMetrics(wall),offset=Math.max(candidate.width/2+25,Math.min(metrics.length-candidate.width/2-25,(centre.x-metrics.x1)*metrics.ux+(centre.y-metrics.y1)*metrics.uy));let best=null;doors.forEach(door=>{if(used.has(door.id))return;const current=doorWorldCentreV32(door);if(!current)return;const distance=Math.hypot(current.x-centre.x,current.y-centre.y);if(distance<1500&&(!best||distance<best.distance))best={door,distance};});
          if(best){best.door.wallId=wall.id;best.door.offset=offset;best.door.width=candidate.width;best.door.height=best.door.height||2100;best.door.sill=0;best.door.autoDetected=true;used.add(best.door.id);moved++;}
          else{const door={id:`door-auto-${Date.now()}-${index}`,name:`Detected door ${index+1}`,type:'door',wallId:wall.id,offset,width:candidate.width,height:2100,sill:0,swing:'left',autoDetected:true};project.openings.push(door);used.add(door.id);added++;}
        });
        project.openings=project.openings.filter(opening=>opening.type!=='door'||!opening.autoDetected||used.has(opening.id));buildScene();setWallReviewStatusV32(`${unique.length} door symbols reviewed · ${moved} doors realigned · ${added} added${joined?` · ${joined} wall gaps joined`:''}`);$('toolHint').textContent=`Auto-detect doors realigned ${moved} existing doors and added ${added}.${joined?` ${joined} split wall pair${joined===1?' was':'s were'} joined around detected openings.`:''} Review every opening against the basemap.`;
      }
      $('autoDoors').onclick=detectDoorsV32;

      function beginWallReviewV32(force=false){
        if(!project.basemap||!basemapImage?.complete||!basemapImage.naturalWidth)return;if(project.settings?.architectureReviewConfirmed===true&&!force){wallReviewActiveV32=false;$('wallReviewWorkflow').hidden=true;setFurnitureReviewVisibilityV32(true);return;}
        const key=`${project.basemap.sourceName||''}:${project.basemap.dataUrl?.length||0}:${project.meta?.updatedAt||''}`;if(!force&&wallReviewStartKeyV32===key)return;wallReviewStartKeyV32=key;project.settings=project.settings||{};project.settings.architectureReviewConfirmed=false;wallReviewActiveV32=true;$('wallReviewWorkflow').hidden=false;$('confirmWallReview').hidden=false;setFurnitureReviewVisibilityV32(false);expandArchitectureReviewV32();viewBird();setWallReviewStatusV32('Auto-fitting basemap and checking walls…');
        autoFitBasemap();detectWalls();detectDoorsV32();setFurnitureReviewVisibilityV32(false);
      }
      function scheduleWallReviewV32(force=false){
        const run=()=>requestAnimationFrame(()=>beginWallReviewV32(force));if(basemapImage?.complete&&basemapImage.naturalWidth)run();else basemapImage?.addEventListener('load',run,{once:true});
      }
      const applyProjectDataBeforeV32=applyProjectDataV27;
      applyProjectDataV27=function(nextProject,historyLabel='load project'){applyProjectDataBeforeV32(nextProject,historyLabel);wallReviewStartKeyV32='';scheduleWallReviewV32(false);};
      const loadBasemapBeforeV32=loadBasemap;
      loadBasemap=function(file){project.settings=project.settings||{};project.settings.architectureReviewConfirmed=false;wallReviewStartKeyV32='';loadBasemapBeforeV32(file);let attempts=0;const wait=setInterval(()=>{attempts++;if(basemapImage?.complete&&project.basemap?.dataUrl){clearInterval(wait);scheduleWallReviewV32(true);}else if(attempts>80)clearInterval(wait);},50);};

      $('confirmWallReview').onclick=()=>{
        pushHistory('confirm architecture review');project.settings=project.settings||{};project.settings.architectureReviewConfirmed=true;(project.walls||[]).forEach(wall=>{if(wall.detected){wall.detected=false;wall.autoDetected=true;}});wallReviewActiveV32=false;setFurnitureReviewVisibilityV32(true);$('confirmWallReview').hidden=true;setWallReviewStatusV32('Walls confirmed · furniture revealed and conservatively aligned',true);buildScene();if((project.furniture||[]).length)autoAlignFurniture();if(typeof updateDetectedWallHighlightsV28==='function')updateDetectedWallHighlightsV28(false);$('toolHint').textContent='Architecture confirmed. Furniture is visible and has been conservatively aligned to the reviewed walls.';
      };

      renderer.domElement.addEventListener('dblclick',event=>{
        if(event.button!==0||activeTool!=='select')return;const rect=renderer.domElement.getBoundingClientRect();pointer.x=((event.clientX-rect.left)/rect.width)*2-1;pointer.y=-((event.clientY-rect.top)/rect.height)*2+1;raycaster.setFromCamera(pointer,camera);const hit=raycaster.intersectObjects(shellGroup.children,false).find(result=>result.object.userData?.wall);if(!hit)return;const wall=project.walls.find(item=>item.id===hit.object.userData.id),overlap=wall&&overlappingAlignedWallV32(wall);if(!overlap){$('toolHint').textContent='This wall has no aligned overlapping wall to merge.';return;}event.preventDefault();event.stopImmediatePropagation();pushHistory('merge overlapping walls');mergeWallPairV32(wall,overlap);buildScene();selectArchitecture('wall',wall.id);$('toolHint').textContent=`Merged the aligned overlap into “${wall.name}”. Openings were kept on the merged wall.`;
      },true);

      const buildSceneBeforeV32=buildScene;
      buildScene=function(){
        buildSceneBeforeV32();const confirmed=project.settings?.architectureReviewConfirmed===true;
        if(wallReviewStartKeyV32&&project.basemap&&!confirmed){wallReviewActiveV32=true;$('wallReviewWorkflow').hidden=false;$('confirmWallReview').hidden=false;$('wallReviewWorkflow').classList.remove('review-complete');}
        else if(confirmed&&wallReviewActiveV32){wallReviewActiveV32=false;$('wallReviewWorkflow').hidden=true;}
        setFurnitureReviewVisibilityV32(!wallReviewActiveV32);
      };
      if(project.basemap)scheduleWallReviewV32(false);
