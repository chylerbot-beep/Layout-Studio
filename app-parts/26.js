      // Horizontal ruler calibration. Metadata is additive, so projects that only
      // contain basemap width and depth remain compatible.
      const scaleStateV33 = {
        a: {u:.20, v:.13},
        b: {u:.80, v:.13},
        zoom: 1,
        panX: 0,
        panY: 0,
        drag: null,
        pendingCheck: false
      };
      const scaleCanvasV33 = $('scaleCanvas');
      let scaleLaunchRequestV41 = 0;

      function calibratedBasemapSizeV33(){
        const basemap = project.basemap;
        if(!basemap || !(basemap.scaleMmPerPixel > 0))return null;
        const crop = normalizedBasemapCrop();
        const sourceWidth = basemap.sourceWidth || basemapImage?.naturalWidth;
        const sourceHeight = basemap.sourceHeight || basemapImage?.naturalHeight;
        if(!sourceWidth || !sourceHeight)return null;
        return {
          width: Math.max(100, Math.round(sourceWidth * (crop.right - crop.left) * basemap.scaleMmPerPixel)),
          depth: Math.max(100, Math.round(sourceHeight * (crop.bottom - crop.top) * basemap.scaleMmPerPixel))
        };
      }

      function applyCalibratedBasemapSizeV33(){
        const size = calibratedBasemapSizeV33();
        if(!size)return;
        project.basemap.width = size.width;
        project.basemap.depth = size.depth;
        project.basemap.lockRatio = true;
        project.plan = project.plan || {};
        Object.assign(project.plan, {width:size.width, depth:size.depth, unit:'mm'});
        basemapAspectRatio = size.width / size.depth;
        $('planWidth').value = size.width;
        $('planDepth').value = size.depth;
        $('lockBasemapRatio').checked = true;
        wallDetectionCache = null;
        buildBasemap(true);
        renderArchitectureHighlight();
      }

      const autoFitBasemapBeforeScaleV33 = autoFitBasemap;
      autoFitBasemap = function(){
        autoFitBasemapBeforeScaleV33();
        applyCalibratedBasemapSizeV33();
      };

      function scaleCanvasMetricsV33(){
        const rect = scaleCanvasV33.getBoundingClientRect();
        const width = Math.max(320, Math.round(rect.width));
        const height = Math.max(220, Math.round(rect.height));
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        if(scaleCanvasV33.width !== Math.round(width * dpr) || scaleCanvasV33.height !== Math.round(height * dpr)){
          scaleCanvasV33.width = Math.round(width * dpr);
          scaleCanvasV33.height = Math.round(height * dpr);
        }
        const image = basemapImage;
        const baseScale = image ? Math.min(width / image.naturalWidth, height / image.naturalHeight) : 1;
        const scale = baseScale * scaleStateV33.zoom;
        return {
          canvas: scaleCanvasV33,
          width,
          height,
          dpr,
          scale,
          x: (width - (image?.naturalWidth || 1) * scale) / 2 + scaleStateV33.panX,
          y: (height - (image?.naturalHeight || 1) * scale) / 2 + scaleStateV33.panY
        };
      }

      function scalePointToCanvasV33(point, metrics){
        return {
          x: metrics.x + point.u * basemapImage.naturalWidth * metrics.scale,
          y: metrics.y + point.v * basemapImage.naturalHeight * metrics.scale
        };
      }

      function scaleCanvasToPointV33(x, y, metrics){
        return {
          u: Math.max(0, Math.min(1, (x - metrics.x) / (basemapImage.naturalWidth * metrics.scale))),
          v: Math.max(0, Math.min(1, (y - metrics.y) / (basemapImage.naturalHeight * metrics.scale)))
        };
      }

      function keepScaleRulerHorizontalV33(v){
        const row = Math.max(0, Math.min(1, v));
        scaleStateV33.a.v = row;
        scaleStateV33.b.v = row;
      }

      function scalePixelDistanceV33(){
        return basemapImage
          ? Math.abs(scaleStateV33.b.u - scaleStateV33.a.u) * basemapImage.naturalWidth
          : 0;
      }

      function updateScaleReadoutV33(){
        const pixels = scalePixelDistanceV33();
        const knownMm = +$('scaleKnownMm').value || 0;
        const mmPerPixel = knownMm > 0 && pixels > 0 ? knownMm / pixels : 0;
        $('scalePixelReading').textContent = pixels
          ? `${Math.round(pixels).toLocaleString()} image pixels between ruler ends`
          : 'Move the ruler ends';
        $('scaleResultReading').textContent = mmPerPixel
          ? `${mmPerPixel.toFixed(3)} mm/pixel · plan image ${Math.round(basemapImage.naturalWidth * mmPerPixel).toLocaleString()} × ${Math.round(basemapImage.naturalHeight * mmPerPixel).toLocaleString()} mm`
          : 'Scale not set';
      }

      function longestHorizontalScaleSpanV40(){
        if(!basemapImage?.complete || !basemapImage.naturalWidth)return null;
        const maxDimension = 1200;
        const scale = Math.min(1, maxDimension / Math.max(basemapImage.naturalWidth, basemapImage.naturalHeight));
        const width = Math.max(2, Math.round(basemapImage.naturalWidth * scale));
        const height = Math.max(2, Math.round(basemapImage.naturalHeight * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', {willReadFrequently:true});
        ctx.drawImage(basemapImage, 0, 0, width, height);
        const pixels = ctx.getImageData(0, 0, width, height).data;
        const maxGap = Math.max(3, Math.round(width * .012));
        let best = null;

        function considerSpan(start, end, y, darkPixels){
          if(start < 0 || end < start)return;
          const span = end - start + 1;
          const density = darkPixels / span;
          if(span < width * .35 || density < .42)return;
          const score = span * (.85 + .15 * density);
          if(!best || score > best.score)best = {start, end, y, score};
        }

        for(let y = 2; y < height - 2; y++){
          let start = -1;
          let end = -1;
          let gap = 0;
          let darkPixels = 0;
          for(let x = 1; x < width - 1; x++){
            const index = (y * width + x) * 4;
            const gray = pixels[index] * .2126 + pixels[index + 1] * .7152 + pixels[index + 2] * .0722;
            const dark = pixels[index + 3] > 32 && gray < 180;
            if(dark){
              if(start < 0){start = x; darkPixels = 0;}
              end = x;
              gap = 0;
              darkPixels++;
            }else if(start >= 0){
              gap++;
              if(gap > maxGap){
                considerSpan(start, end, y, darkPixels);
                start = -1;
                end = -1;
                gap = 0;
                darkPixels = 0;
              }
            }
          }
          considerSpan(start, end, y, darkPixels);
        }
        if(!best)return null;
        return {
          a: {u:(best.start + .5) / width, v:(best.y + .5) / height},
          b: {u:(best.end + .5) / width, v:(best.y + .5) / height}
        };
      }

      function autoPositionScaleRulerV40(){
        const span = longestHorizontalScaleSpanV40();
        if(!span){
          $('scaleAutoStatus').textContent = 'No reliable overall horizontal span was found. Position the ruler manually.';
          return false;
        }
        scaleStateV33.a = span.a;
        scaleStateV33.b = span.b;
        keepScaleRulerHorizontalV33(span.a.v);
        $('scaleAutoStatus').textContent = 'Ruler placed on the longest horizontal span. Verify both endpoints before applying the scale.';
        drawScaleCanvasV33();
        return true;
      }

      function drawScaleLineV33(ctx, from, to, width, color){
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
      }

      function drawScaleCanvasV33(){
        if(!$('scaleModal').classList.contains('open') || !basemapImage?.complete)return;
        const metrics = scaleCanvasMetricsV33();
        const ctx = metrics.canvas.getContext('2d');
        ctx.setTransform(metrics.dpr, 0, 0, metrics.dpr, 0, 0);
        ctx.clearRect(0, 0, metrics.width, metrics.height);
        ctx.fillStyle = '#e5e5e3';
        ctx.fillRect(0, 0, metrics.width, metrics.height);
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(
          basemapImage,
          metrics.x,
          metrics.y,
          basemapImage.naturalWidth * metrics.scale,
          basemapImage.naturalHeight * metrics.scale
        );

        const a = scalePointToCanvasV33(scaleStateV33.a, metrics);
        const b = scalePointToCanvasV33(scaleStateV33.b, metrics);
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const length = Math.hypot(dx, dy) || 1;
        const normal = {x:-dy / length, y:dx / length};
        ctx.save();
        ctx.lineCap = 'round';
        drawScaleLineV33(ctx, a, b, 8, 'rgba(255,255,255,.96)');
        drawScaleLineV33(ctx, a, b, 4, '#2f80ff');

        const ticks = Math.max(2, Math.min(24, Math.floor(length / 28)));
        for(let i = 1; i < ticks; i++){
          const ratio = i / ticks;
          const point = {x:a.x + dx * ratio, y:a.y + dy * ratio};
          const size = i % 5 === 0 ? 9 : 5;
          drawScaleLineV33(
            ctx,
            {x:point.x - normal.x * size, y:point.y - normal.y * size},
            {x:point.x + normal.x * size, y:point.y + normal.y * size},
            1.5,
            '#2f80ff'
          );
        }

        [a, b].forEach(point => {
          ctx.fillStyle = '#fff';
          ctx.strokeStyle = '#2f80ff';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(point.x, point.y, 9, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        });

        const label = `${(+$('scaleKnownMm').value || 0).toLocaleString()} mm`;
        const labelX = (a.x + b.x) / 2;
        const labelY = (a.y + b.y) / 2;
        ctx.font = '600 13px Inter, system-ui, sans-serif';
        const textWidth = ctx.measureText(label).width;
        ctx.fillStyle = 'rgba(25,26,23,.9)';
        ctx.fillRect(labelX - textWidth / 2 - 8, labelY - 30, textWidth + 16, 22);
        ctx.fillStyle = '#fff';
        ctx.fillText(label, labelX - textWidth / 2, labelY - 14);
        ctx.restore();
        updateScaleReadoutV33();
      }

      function resetScaleRulerV33(){
        scaleStateV33.a = {u:.20, v:.13};
        scaleStateV33.b = {u:.80, v:.13};
        scaleStateV33.zoom = 1;
        scaleStateV33.panX = 0;
        scaleStateV33.panY = 0;
        $('scaleAutoStatus').textContent = 'Ruler reset. Drag either endpoint; both remain on one horizontal plane.';
        drawScaleCanvasV33();
      }

      function openScaleCalibrationV33(pendingCheck = false){
        if(!project.basemap || !basemapImage?.complete){
          alert('Upload a floor-plan image first.');
          return;
        }
        scaleStateV33.pendingCheck = !!pendingCheck;
        const saved = project.basemap.scaleCalibration;
        const overallWidth = project.plan?.width || project.basemap?.width || saved?.knownMm || 12600;
        $('scaleKnownMm').value = overallWidth;
        $('scaleModal').classList.add('open');
        if(!autoPositionScaleRulerV40()){
          if(saved?.a && saved?.b){
            scaleStateV33.a = {...saved.a};
            scaleStateV33.b = {...saved.b};
            keepScaleRulerHorizontalV33(((+saved.a.v || 0) + (+saved.b.v || 0)) / 2);
            $('scaleKnownMm').value = saved.knownMm || overallWidth;
            $('scaleAutoStatus').textContent = 'Using the saved ruler position because no reliable automatic span was found.';
          }else{
            resetScaleRulerV33();
          }
        }
        requestAnimationFrame(drawScaleCanvasV33);
      }

      function closeScaleCalibrationV33(){
        $('scaleModal').classList.remove('open');
        scaleStateV33.drag = null;
      }

      function scheduleScaleCalibrationV41(pendingCheck = true){
        const request = ++scaleLaunchRequestV41;
        let attempts = 0;
        const tryOpen = () => {
          if(request !== scaleLaunchRequestV41 || !project.settings?.scaleCalibrationRequired || !project.basemap)return;
          if(basemapImage?.complete && basemapImage.naturalWidth){
            if(!$('scaleModal').classList.contains('open'))openScaleCalibrationV33(pendingCheck);
            return;
          }
          attempts++;
          if(attempts < 120)setTimeout(tryOpen, 50);
          else{
            $('basemapStatus').textContent = 'The basemap image could not be opened. Upload the matching floor plan to verify the project scale.';
            $('missingBasemapModal').classList.add('open');
          }
        };
        basemapImage?.addEventListener('load', tryOpen, {once:true});
        requestAnimationFrame(tryOpen);
      }

      function showMissingBasemapStepV41(){
        closeScaleCalibrationV33();
        $('missingBasemapModal').classList.add('open');
        $('basemapStatus').textContent = 'This ZIP has no basemap image. Upload the matching floor plan to verify scale, or continue with its JSON measurements.';
      }

      function startImportedProjectReviewV41(){
        scaleLaunchRequestV41++;
        wallReviewActiveV32 = false;
        wallReviewStartKeyV32 = '';
        reviewWorkflowV36.hidden = true;
        document.body.classList.remove('architecture-review-mode');
        setFurnitureReviewVisibilityV32(true);
        viewBird();
        if(!project.basemap?.dataUrl){
          project.settings.scaleCalibrationRequired = false;
          showMissingBasemapStepV41();
          return;
        }
        project.settings.scaleCalibrationRequired = true;
        project.settings.architectureReviewConfirmed = false;
        scheduleScaleCalibrationV41(true);
      }

      function applyScaleCalibrationV33(){
        const knownMm = +$('scaleKnownMm').value;
        const pixels = scalePixelDistanceV33();
        if(!(knownMm >= 100) || pixels < 10){
          $('scaleResultReading').textContent = 'Enter a valid millimetre length and extend the ruler farther.';
          return;
        }
        pushHistory('calibrate basemap ruler');
        const mmPerPixel = knownMm / pixels;
        project.basemap.scaleMmPerPixel = mmPerPixel;
        project.basemap.scaleCalibration = {
          knownMm,
          a: {...scaleStateV33.a},
          b: {...scaleStateV33.b}
        };
        // Calibrate the detected plan drawing, not the white page margins. Applying
        // mm/pixel to the full source image enlarged and shifted later wall scans.
        project.basemap.crop = typeof detectedBasemapCropV42 === 'function'
          ? (detectedBasemapCropV42() || {left:0, top:0, right:1, bottom:1})
          : {left:0, top:0, right:1, bottom:1};
        project.settings = project.settings || {};
        project.settings.scaleCalibrationRequired = false;
        applyCalibratedBasemapSizeV33();
        syncBasemapControls();
        const shouldCheck = scaleStateV33.pendingCheck;
        closeScaleCalibrationV33();
        $('basemapStatus').textContent = `Scale set from ${Math.round(knownMm).toLocaleString()} mm · ${mmPerPixel.toFixed(3)} mm/pixel. ${shouldCheck ? 'Checking the floor plan…' : 'Select Check floor plan when ready.'}`;
        if(shouldCheck)checkFloorPlanV33();
      }

      function startScaleDragV33(event){
        if(!basemapImage)return;
        event.preventDefault();
        $('scaleAutoStatus').textContent = 'Manual ruler position. Both endpoints remain locked to one horizontal plane.';
        const rect = scaleCanvasV33.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const metrics = scaleCanvasMetricsV33();
        const a = scalePointToCanvasV33(scaleStateV33.a, metrics);
        const b = scalePointToCanvasV33(scaleStateV33.b, metrics);
        if(event.altKey || event.button === 1 || event.button === 2){
          scaleStateV33.drag = {
            mode:'pan',
            x:event.clientX,
            y:event.clientY,
            panX:scaleStateV33.panX,
            panY:scaleStateV33.panY
          };
        }else{
          const key = Math.hypot(x - a.x, y - a.y) <= Math.hypot(x - b.x, y - b.y) ? 'a' : 'b';
          const point = scaleCanvasToPointV33(x, y, metrics);
          scaleStateV33[key] = {u:point.u, v:point.v};
          keepScaleRulerHorizontalV33(point.v);
          scaleStateV33.drag = {mode:key};
        }
        scaleCanvasV33.setPointerCapture(event.pointerId);
        drawScaleCanvasV33();
      }

      function moveScaleDragV33(event){
        const drag = scaleStateV33.drag;
        if(!drag)return;
        event.preventDefault();
        if(drag.mode === 'pan'){
          scaleStateV33.panX = drag.panX + event.clientX - drag.x;
          scaleStateV33.panY = drag.panY + event.clientY - drag.y;
        }else{
          const rect = scaleCanvasV33.getBoundingClientRect();
          const metrics = scaleCanvasMetricsV33();
          const point = scaleCanvasToPointV33(event.clientX - rect.left, event.clientY - rect.top, metrics);
          scaleStateV33[drag.mode] = {u:point.u, v:point.v};
          keepScaleRulerHorizontalV33(point.v);
        }
        drawScaleCanvasV33();
      }

      function endScaleDragV33(event){
        scaleStateV33.drag = null;
        try{
          scaleCanvasV33.releasePointerCapture(event.pointerId);
        }catch(_){
          // The pointer may already have been released by the browser.
        }
      }

      function zoomScaleCanvasV33(event){
        event.preventDefault();
        const rect = scaleCanvasV33.getBoundingClientRect();
        const before = scaleCanvasMetricsV33();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const imageX = (x - before.x) / before.scale;
        const imageY = (y - before.y) / before.scale;
        scaleStateV33.zoom = Math.max(.6, Math.min(6, scaleStateV33.zoom * (event.deltaY < 0 ? 1.18 : .85)));
        const after = scaleCanvasMetricsV33();
        scaleStateV33.panX += x - (after.x + imageX * after.scale);
        scaleStateV33.panY += y - (after.y + imageY * after.scale);
        drawScaleCanvasV33();
      }

      scaleCanvasV33.addEventListener('pointerdown', startScaleDragV33);
      scaleCanvasV33.addEventListener('pointermove', moveScaleDragV33);
      ['pointerup', 'pointercancel'].forEach(type => scaleCanvasV33.addEventListener(type, endScaleDragV33));
      scaleCanvasV33.addEventListener('contextmenu', event => event.preventDefault());
      scaleCanvasV33.addEventListener('wheel', zoomScaleCanvasV33, {passive:false});
      $('scaleKnownMm').addEventListener('input', drawScaleCanvasV33);
      $('scaleResetRuler').onclick = resetScaleRulerV33;
      $('scaleAutoRuler').onclick = autoPositionScaleRulerV40;
      $('scaleZoomIn').onclick = () => { scaleStateV33.zoom = Math.min(6, scaleStateV33.zoom * 1.25); drawScaleCanvasV33(); };
      $('scaleZoomOut').onclick = () => { scaleStateV33.zoom = Math.max(.6, scaleStateV33.zoom * .8); drawScaleCanvasV33(); };
      $('scaleApply').onclick = applyScaleCalibrationV33;
      $('scaleCancel').onclick = closeScaleCalibrationV33;
      $('scaleCancelBottom').onclick = closeScaleCalibrationV33;
      window.addEventListener('resize', () => requestAnimationFrame(drawScaleCanvasV33));

      function checkFloorPlanV33(){
        if(!project.basemap || !basemapImage?.complete){
          alert('Upload a floor-plan image first.');
          return;
        }
        if(project.settings?.scaleCalibrationRequired){
          openScaleCalibrationV33(true);
          return;
        }
        project.settings = project.settings || {};
        project.settings.architectureReviewConfirmed = false;
        wallReviewStartKeyV32 = '';
        beginWallReviewV32(true);
      }

      $('setScaleBasemap').onclick = () => openScaleCalibrationV33(false);
      $('checkFloorPlan').onclick = checkFloorPlanV33;

      const scheduleWallReviewBeforeScaleV33 = scheduleWallReviewV32;
      scheduleWallReviewV32 = function(force = false){
        if(project.settings?.scaleCalibrationRequired){
          scheduleScaleCalibrationV41(true);
          return;
        }
        scheduleWallReviewBeforeScaleV33(force);
      };

      const loadBasemapBeforeScaleV33 = loadBasemap;
      loadBasemap = function(file){
        $('missingBasemapModal').classList.remove('open');
        project.settings = project.settings || {};
        project.settings.scaleCalibrationRequired = true;
        project.settings.architectureReviewConfirmed = false;
        loadBasemapBeforeScaleV33(file);
      };

      $('missingBasemapUpload').onclick = () => {
        $('missingBasemapModal').classList.remove('open');
        $('basemapFile').click();
      };
      $('missingBasemapContinue').onclick = () => {
        $('missingBasemapModal').classList.remove('open');
        project.settings.scaleCalibrationRequired = false;
        project.settings.architectureReviewConfirmed = true;
        viewBird();
        buildScene();
        setPackageStatus('Project opened without a basemap. JSON millimetre measurements remain authoritative.','ok');
      };
