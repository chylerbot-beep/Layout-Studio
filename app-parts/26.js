      // Ruler calibration and guided, browser-only floor-plan review.
      // Calibration metadata is additive: older projects that only store basemap width
      // and depth remain valid and continue through the existing review workflow.
      const scaleStateV33={a:{u:.20,v:.13},b:{u:.80,v:.13},zoom:1,panX:0,panY:0,drag:null,pendingCheck:false};

      function calibratedBasemapSizeV33(){
        const b=project.basemap;if(!b||!(b.scaleMmPerPixel>0))return null;const crop=normalizedBasemapCrop(),sourceWidth=b.sourceWidth||basemapImage?.naturalWidth,sourceHeight=b.sourceHeight||basemapImage?.naturalHeight;if(!sourceWidth||!sourceHeight)return null;
        return{width:Math.max(100,Math.round(sourceWidth*(crop.right-crop.left)*b.scaleMmPerPixel)),depth:Math.max(100,Math.round(sourceHeight*(crop.bottom-crop.top)*b.scaleMmPerPixel))};
      }
      function applyCalibratedBasemapSizeV33(){
        const size=calibratedBasemapSizeV33();if(!size)return;project.basemap.width=size.width;project.basemap.depth=size.depth;project.basemap.lockRatio=true;project.plan=project.plan||{};project.plan.width=size.width;project.plan.depth=size.depth;project.plan.unit='mm';basemapAspectRatio=size.width/size.depth;
        $('planWidth').value=size.width;$('planDepth').value=size.depth;$('lockBasemapRatio').checked=true;wallDetectionCache=null;buildBasemap(true);renderArchitectureHighlight();
      }
      const autoFitBasemapBeforeScaleV33=autoFitBasemap;
      autoFitBasemap=function(){autoFitBasemapBeforeScaleV33();applyCalibratedBasemapSizeV33();};

      function scaleCanvasMetricsV33(){
        const canvas=$('scaleCanvas'),rect=canvas.getBoundingClientRect(),width=Math.max(320,Math.round(rect.width)),height=Math.max(220,Math.round(rect.height)),dpr=Math.min(2,window.devicePixelRatio||1);
        if(canvas.width!==Math.round(width*dpr)||canvas.height!==Math.round(height*dpr)){canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);}const image=basemapImage,base=image?Math.min(width/image.naturalWidth,height/image.naturalHeight):1,scale=base*scaleStateV33.zoom;
        return{canvas,width,height,dpr,scale,x:(width-(image?.naturalWidth||1)*scale)/2+scaleStateV33.panX,y:(height-(image?.naturalHeight||1)*scale)/2+scaleStateV33.panY};
      }
      function scalePointToCanvasV33(point,metrics){return{x:metrics.x+point.u*basemapImage.naturalWidth*metrics.scale,y:metrics.y+point.v*basemapImage.naturalHeight*metrics.scale};}
      function scaleCanvasToPointV33(x,y,metrics){return{u:Math.max(0,Math.min(1,(x-metrics.x)/(basemapImage.naturalWidth*metrics.scale))),v:Math.max(0,Math.min(1,(y-metrics.y)/(basemapImage.naturalHeight*metrics.scale)))};}
      function keepScaleRulerHorizontalV33(v){const row=Math.max(0,Math.min(1,v));scaleStateV33.a.v=row;scaleStateV33.b.v=row;}
      function scalePixelDistanceV33(){return basemapImage?Math.abs(scaleStateV33.b.u-scaleStateV33.a.u)*basemapImage.naturalWidth:0;}
      function updateScaleReadoutV33(){
        const pixels=scalePixelDistanceV33(),known=+$('scaleKnownMm').value||0,mmPerPixel=known>0&&pixels>0?known/pixels:0;$('scalePixelReading').textContent=pixels?`${Math.round(pixels).toLocaleString()} image pixels between ruler ends`:'Move the ruler ends';
        $('scaleResultReading').textContent=mmPerPixel?`${mmPerPixel.toFixed(3)} mm/pixel · plan image ${Math.round(basemapImage.naturalWidth*mmPerPixel).toLocaleString()} × ${Math.round(basemapImage.naturalHeight*mmPerPixel).toLocaleString()} mm`:'Scale not set';
      }
      function drawScaleCanvasV33(){
        if(!$('scaleModal').classList.contains('open')||!basemapImage?.complete)return;const m=scaleCanvasMetricsV33(),ctx=m.canvas.getContext('2d');ctx.setTransform(m.dpr,0,0,m.dpr,0,0);ctx.clearRect(0,0,m.width,m.height);ctx.fillStyle='#e5e5e3';ctx.fillRect(0,0,m.width,m.height);ctx.imageSmoothingEnabled=true;ctx.drawImage(basemapImage,m.x,m.y,basemapImage.naturalWidth*m.scale,basemapImage.naturalHeight*m.scale);
        const a=scalePointToCanvasV33(scaleStateV33.a,m),b=scalePointToCanvasV33(scaleStateV33.b,m),dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy)||1,nx=-dy/length,ny=dx/length;ctx.save();ctx.lineCap='round';ctx.strokeStyle='rgba(255,255,255,.96)';ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.strokeStyle='#2f80ff';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
        const ticks=Math.max(2,Math.min(24,Math.floor(length/28)));ctx.lineWidth=1.5;for(let i=1;i<ticks;i++){const t=i/ticks,x=a.x+dx*t,y=a.y+dy*t,major=i%5===0,s=major?9:5;ctx.beginPath();ctx.moveTo(x-nx*s,y-ny*s);ctx.lineTo(x+nx*s,y+ny*s);ctx.stroke();}
        [a,b].forEach(point=>{ctx.fillStyle='#fff';ctx.strokeStyle='#2f80ff';ctx.lineWidth=4;ctx.beginPath();ctx.arc(point.x,point.y,9,0,Math.PI*2);ctx.fill();ctx.stroke();});
        const label=(+$('scaleKnownMm').value||0).toLocaleString()+' mm',mx=(a.x+b.x)/2,my=(a.y+b.y)/2;ctx.font='600 13px Inter, system-ui, sans-serif';const tw=ctx.measureText(label).width;ctx.fillStyle='rgba(25,26,23,.9)';ctx.fillRect(mx-tw/2-8,my-30,tw+16,22);ctx.fillStyle='#fff';ctx.fillText(label,mx-tw/2,my-14);ctx.restore();updateScaleReadoutV33();
      }
      function resetScaleRulerV33(){scaleStateV33.a={u:.20,v:.13};scaleStateV33.b={u:.80,v:.13};scaleStateV33.zoom=1;scaleStateV33.panX=0;scaleStateV33.panY=0;drawScaleCanvasV33();}
      function openScaleCalibrationV33(pendingCheck=false){
        if(!project.basemap||!basemapImage?.complete){alert('Upload a floor-plan image first.');return;}scaleStateV33.pendingCheck=!!pendingCheck;const saved=project.basemap.scaleCalibration;if(saved?.a&&saved?.b){scaleStateV33.a={...saved.a};scaleStateV33.b={...saved.b};keepScaleRulerHorizontalV33(((+saved.a.v||0)+(+saved.b.v||0))/2);}else resetScaleRulerV33();$('scaleKnownMm').value=saved?.knownMm||12600;$('scaleModal').classList.add('open');requestAnimationFrame(drawScaleCanvasV33);
      }
      function closeScaleCalibrationV33(){$('scaleModal').classList.remove('open');scaleStateV33.drag=null;}
      function applyScaleCalibrationV33(){
        const knownMm=+$('scaleKnownMm').value,pixels=scalePixelDistanceV33();if(!(knownMm>=100)||pixels<10){$('scaleResultReading').textContent='Enter a valid millimetre length and extend the ruler farther.';return;}pushHistory('calibrate basemap ruler');const mmPerPixel=knownMm/pixels,b=project.basemap;b.scaleMmPerPixel=mmPerPixel;b.scaleCalibration={knownMm,a:{...scaleStateV33.a},b:{...scaleStateV33.b}};b.crop={left:0,top:0,right:1,bottom:1};project.settings=project.settings||{};project.settings.scaleCalibrationRequired=false;applyCalibratedBasemapSizeV33();syncBasemapControls();const shouldCheck=scaleStateV33.pendingCheck;closeScaleCalibrationV33();$('basemapStatus').textContent=`Scale set from ${Math.round(knownMm).toLocaleString()} mm · ${mmPerPixel.toFixed(3)} mm/pixel. ${shouldCheck?'Checking the floor plan…':'Select Check floor plan when ready.'}`;if(shouldCheck)checkFloorPlanV33();
      }

      const scaleCanvasV33=$('scaleCanvas');
      scaleCanvasV33.addEventListener('pointerdown',event=>{if(!basemapImage)return;event.preventDefault();const rect=scaleCanvasV33.getBoundingClientRect(),x=event.clientX-rect.left,y=event.clientY-rect.top,m=scaleCanvasMetricsV33(),a=scalePointToCanvasV33(scaleStateV33.a,m),b=scalePointToCanvasV33(scaleStateV33.b,m);if(event.altKey||event.button===1||event.button===2)scaleStateV33.drag={mode:'pan',x:event.clientX,y:event.clientY,panX:scaleStateV33.panX,panY:scaleStateV33.panY};else{const da=Math.hypot(x-a.x,y-a.y),db=Math.hypot(x-b.x,y-b.y),key=da<=db?'a':'b',point=scaleCanvasToPointV33(x,y,m);scaleStateV33[key]={u:point.u,v:point.v};keepScaleRulerHorizontalV33(point.v);scaleStateV33.drag={mode:key};}scaleCanvasV33.setPointerCapture(event.pointerId);drawScaleCanvasV33();});
      scaleCanvasV33.addEventListener('pointermove',event=>{if(!scaleStateV33.drag)return;event.preventDefault();if(scaleStateV33.drag.mode==='pan'){scaleStateV33.panX=scaleStateV33.drag.panX+event.clientX-scaleStateV33.drag.x;scaleStateV33.panY=scaleStateV33.drag.panY+event.clientY-scaleStateV33.drag.y;}else{const rect=scaleCanvasV33.getBoundingClientRect(),m=scaleCanvasMetricsV33(),point=scaleCanvasToPointV33(event.clientX-rect.left,event.clientY-rect.top,m);scaleStateV33[scaleStateV33.drag.mode]={u:point.u,v:point.v};keepScaleRulerHorizontalV33(point.v);}drawScaleCanvasV33();});
      ['pointerup','pointercancel'].forEach(type=>scaleCanvasV33.addEventListener(type,event=>{scaleStateV33.drag=null;try{scaleCanvasV33.releasePointerCapture(event.pointerId);}catch(_){}}));
      scaleCanvasV33.addEventListener('contextmenu',event=>event.preventDefault());
      scaleCanvasV33.addEventListener('wheel',event=>{event.preventDefault();const rect=scaleCanvasV33.getBoundingClientRect(),before=scaleCanvasMetricsV33(),x=event.clientX-rect.left,y=event.clientY-rect.top,imageX=(x-before.x)/before.scale,imageY=(y-before.y)/before.scale;scaleStateV33.zoom=Math.max(.6,Math.min(6,scaleStateV33.zoom*(event.deltaY<0?1.18:.85)));const after=scaleCanvasMetricsV33();scaleStateV33.panX+=x-(after.x+imageX*after.scale);scaleStateV33.panY+=y-(after.y+imageY*after.scale);drawScaleCanvasV33();},{passive:false});
      $('scaleKnownMm').addEventListener('input',drawScaleCanvasV33);$('scaleResetRuler').onclick=resetScaleRulerV33;$('scaleZoomIn').onclick=()=>{scaleStateV33.zoom=Math.min(6,scaleStateV33.zoom*1.25);drawScaleCanvasV33();};$('scaleZoomOut').onclick=()=>{scaleStateV33.zoom=Math.max(.6,scaleStateV33.zoom*.8);drawScaleCanvasV33();};$('scaleApply').onclick=applyScaleCalibrationV33;$('scaleCancel').onclick=closeScaleCalibrationV33;$('scaleCancelBottom').onclick=closeScaleCalibrationV33;window.addEventListener('resize',()=>requestAnimationFrame(drawScaleCanvasV33));

      function checkFloorPlanV33(){
        if(!project.basemap||!basemapImage?.complete){alert('Upload a floor-plan image first.');return;}if(project.settings?.scaleCalibrationRequired){openScaleCalibrationV33(true);return;}project.settings=project.settings||{};project.settings.architectureReviewConfirmed=false;wallReviewStartKeyV32='';beginWallReviewV32(true);
      }
      $('setScaleBasemap').onclick=()=>openScaleCalibrationV33(false);$('checkFloorPlan').onclick=checkFloorPlanV33;

      const scheduleWallReviewBeforeScaleV33=scheduleWallReviewV32;
      scheduleWallReviewV32=function(force=false){if(project.settings?.scaleCalibrationRequired){const run=()=>openScaleCalibrationV33(false);if(basemapImage?.complete&&basemapImage.naturalWidth)requestAnimationFrame(run);else basemapImage?.addEventListener('load',run,{once:true});return;}scheduleWallReviewBeforeScaleV33(force);};
      const loadBasemapBeforeScaleV33=loadBasemap;
      loadBasemap=function(file){project.settings=project.settings||{};project.settings.scaleCalibrationRequired=true;project.settings.architectureReviewConfirmed=false;loadBasemapBeforeScaleV33(file);};

      $('reviewAlignSelected').onclick=()=>{if(selectedArchitecture?.kind!=='wall'){$('wallReviewInstruction').textContent='Select a wall first, then choose Align selected.';return;}alignSelectedWallToBasemap();$('wallReviewInstruction').textContent='Selected wall aligned. Compare it with the basemap before confirming.';};
      $('reviewDeleteSelected').onclick=()=>{if(!selectedArchitecture){$('wallReviewInstruction').textContent='Select an incorrect wall, door or window first.';return;}$('deleteArchitecture').click();$('wallReviewInstruction').textContent='Incorrect architecture removed. Continue reviewing the plan.';};
      let originalOpacityV33=null;
      function showOriginalBasemapV33(){if(originalOpacityV33!==null||!project.basemap)return;originalOpacityV33=project.basemap.opacity??.48;project.basemap.opacity=1;basemapGroup.children.forEach(item=>{if(item.material)item.material.opacity=1;});$('reviewOriginal').classList.add('active');$('reviewOriginal').textContent='Release original';}
      function restoreOriginalBasemapV33(){if(originalOpacityV33===null||!project.basemap)return;project.basemap.opacity=originalOpacityV33;basemapGroup.children.forEach(item=>{if(item.material)item.material.opacity=originalOpacityV33;});originalOpacityV33=null;$('reviewOriginal').classList.remove('active');$('reviewOriginal').textContent='Hold original';}
      $('reviewOriginal').addEventListener('pointerdown',showOriginalBasemapV33);['pointerup','pointercancel','pointerleave'].forEach(type=>$('reviewOriginal').addEventListener(type,restoreOriginalBasemapV33));window.addEventListener('keydown',event=>{if((event.key==='y'||event.key==='Y')&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!event.repeat&&!$('wallReviewWorkflow').hidden)showOriginalBasemapV33();});window.addEventListener('keyup',event=>{if(event.key==='y'||event.key==='Y')restoreOriginalBasemapV33();});
