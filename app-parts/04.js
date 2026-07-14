          const sw=Math.max(2,Math.round((crop.right-crop.left)*image.naturalWidth)),sh=Math.max(2,Math.round((crop.bottom-crop.top)*image.naturalHeight));
          const maxTexture=2048,scale=Math.min(1,maxTexture/Math.max(sw,sh));
          const canvas=document.createElement('canvas');canvas.width=Math.max(2,Math.round(sw*scale));canvas.height=Math.max(2,Math.round(sh*scale));
          const ctx=canvas.getContext('2d');ctx.drawImage(image,sx,sy,sw,sh,0,0,canvas.width,canvas.height);
          const texture=new THREE.CanvasTexture(canvas);texture.encoding=THREE.sRGBEncoding;texture.minFilter=THREE.LinearFilter;texture.magFilter=THREE.LinearFilter;
          const w=project.basemap.width||PLAN_W,d=project.basemap.depth||PLAN_H,ox=project.basemap.offsetX||0,oy=project.basemap.offsetY||0;
          const mesh=new THREE.Mesh(new THREE.PlaneGeometry(mm(w),mm(d)),new THREE.MeshBasicMaterial({map:texture,transparent:true,opacity:project.basemap.opacity??.48,depthWrite:false,side:THREE.DoubleSide}));
          mesh.rotation.x=-Math.PI/2;mesh.position.set(mm(ox+w/2),.002,mm(oy+d/2));mesh.userData={basemap:true};basemapGroup.add(mesh);
        });
      }
      function worldToBasemapPixel(x,y,analysis){
        if(!project.basemap)return null;
        const b=project.basemap,ox=b.offsetX||0,oy=b.offsetY||0;
        const u=(x-ox)/(b.width||PLAN_W),v=(y-oy)/(b.depth||PLAN_H);
        if(u<0||u>1||v<0||v>1)return null;
        return {x:u*analysis.w,y:v*analysis.h};
      }
      function analysisPixelToWorld(x,y,analysis){
        const b=project.basemap,ox=b.offsetX||0,oy=b.offsetY||0;
        return {x:ox+x/analysis.w*(b.width||PLAN_W),y:oy+y/analysis.h*(b.depth||PLAN_H)};
      }
      function makeBasemapAnalysis(useCrop=true,maxDimension=1100){
        if(!basemapImage?.complete||!basemapImage.naturalWidth)return null;
        const crop=useCrop?normalizedBasemapCrop():{left:0,top:0,right:1,bottom:1};
        const iw=basemapImage.naturalWidth,ih=basemapImage.naturalHeight;
        const sx=Math.round(crop.left*iw),sy=Math.round(crop.top*ih),sw=Math.max(2,Math.round((crop.right-crop.left)*iw)),sh=Math.max(2,Math.round((crop.bottom-crop.top)*ih));
        const scale=Math.min(1,maxDimension/Math.max(sw,sh)),w=Math.max(2,Math.round(sw*scale)),h=Math.max(2,Math.round(sh*scale));
        const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(basemapImage,sx,sy,sw,sh,0,0,w,h);
        return {canvas,ctx,w,h,crop,sx,sy,sw,sh,scale};
      }
      function otsuThreshold(gray){
        const hist=new Uint32Array(256);for(let i=0;i<gray.length;i++)hist[gray[i]]++;
        let total=gray.length,sum=0;for(let i=0;i<256;i++)sum+=i*hist[i];
        let sumB=0,wB=0,max=-1,threshold=180;
        for(let i=0;i<256;i++){wB+=hist[i];if(!wB)continue;const wF=total-wB;if(!wF)break;sumB+=i*hist[i];const mB=sumB/wB,mF=(sum-sumB)/wF,between=wB*wF*(mB-mF)*(mB-mF);if(between>max){max=between;threshold=i;}}
        return Math.max(135,Math.min(220,threshold+12));
      }
      function makeWallMask(analysis,thresholdOverride){
        const data=analysis.ctx.getImageData(0,0,analysis.w,analysis.h).data,n=analysis.w*analysis.h,gray=new Uint8Array(n);
        for(let i=0,j=0;i<data.length;i+=4,j++)gray[j]=Math.round(data[i]*.2126+data[i+1]*.7152+data[i+2]*.0722);
        const threshold=thresholdOverride||Math.min(205,otsuThreshold(gray));
        const raw=new Uint8Array(n);for(let i=0;i<n;i++)raw[i]=gray[i]<threshold?1:0;
        const eroded=new Uint8Array(n),opened=new Uint8Array(n),w=analysis.w,h=analysis.h;
        for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){let keep=1;for(let yy=-1;yy<=1&&keep;yy++)for(let xx=-1;xx<=1;xx++)if(!raw[(y+yy)*w+x+xx]){keep=0;break;}eroded[y*w+x]=keep;}
        for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){let on=0;for(let yy=-1;yy<=1&&!on;yy++)for(let xx=-1;xx<=1;xx++)if(eroded[(y+yy)*w+x+xx]){on=1;break;}opened[y*w+x]=on;}
        return {gray,raw,mask:opened,threshold};
      }
      function largestMaskBounds(mask,w,h){
        const visited=new Uint8Array(mask.length),queue=new Int32Array(mask.length);let best=null;
        for(let start=0;start<mask.length;start++){
          if(!mask[start]||visited[start])continue;
          let head=0,tail=0;queue[tail++]=start;visited[start]=1;let count=0,minX=w,minY=h,maxX=0,maxY=0;
          while(head<tail){const idx=queue[head++],x=idx%w,y=(idx/w)|0;count++;if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;
            const ns=[idx-1,idx+1,idx-w,idx+w];for(const ni of ns){if(ni<0||ni>=mask.length||visited[ni]||!mask[ni])continue;const nx=ni%w;if(Math.abs(nx-x)>1)continue;visited[ni]=1;queue[tail++]=ni;}
          }
          if(!best||count>best.count)best={count,minX,minY,maxX,maxY};
        }
        return best;
      }
      function autoFitBasemap(){
        if(!basemapImage){alert('Upload a floor-plan image first.');return;}
        const analysis=makeBasemapAnalysis(false,1200),masked=analysis&&makeWallMask(analysis,210),bounds=analysis&&largestMaskBounds(masked.mask,analysis.w,analysis.h);
        if(!bounds||bounds.count<200){$('basemapStatus').textContent='Auto-fit could not isolate the plan drawing. Keep the full image and use Offset X/Y for manual alignment.';return;}
        // Use the detected drawing boundary itself. Decorative padding changes the
        // physical width after ruler calibration and shifts walls off their bands.
        const padX=0,padY=0;
        const left=Math.max(0,bounds.minX-padX)/analysis.w,top=Math.max(0,bounds.minY-padY)/analysis.h,right=Math.min(analysis.w-1,bounds.maxX+padX)/analysis.w,bottom=Math.min(analysis.h-1,bounds.maxY+padY)/analysis.h;
        pushHistory('auto-fit basemap');project.basemap.crop={left,top,right,bottom};wallDetectionCache=null;buildBasemap(true);
        $('basemapStatus').textContent=`Auto-fit cropped ${Math.round(left*100)}% left, ${Math.round(top*100)}% top, ${Math.round((1-right)*100)}% right and ${Math.round((1-bottom)*100)}% bottom. Review against the walls before tracing.`;
      }


      function loadTesseract(){
        if(window.Tesseract)return Promise.resolve(window.Tesseract);
        if(tesseractLoader)return tesseractLoader;
        tesseractLoader=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=TESSERACT_CDN;script.async=true;script.onload=()=>resolve(window.Tesseract);script.onerror=()=>reject(new Error('Could not load Tesseract.js from the CDN. Check the internet connection.'));document.head.appendChild(script);});
        return tesseractLoader;
      }
      function makeOcrCanvas(rotate=false){
        if(!basemapImage?.complete||!basemapImage.naturalWidth)return null;
        const maxDimension=2400,scale=Math.min(1,maxDimension/Math.max(basemapImage.naturalWidth,basemapImage.naturalHeight)),w=Math.max(2,Math.round(basemapImage.naturalWidth*scale)),h=Math.max(2,Math.round(basemapImage.naturalHeight*scale));
        const source=document.createElement('canvas');source.width=w;source.height=h;const ctx=source.getContext('2d',{willReadFrequently:true});ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);ctx.drawImage(basemapImage,0,0,w,h);
        const image=ctx.getImageData(0,0,w,h),data=image.data;for(let i=0;i<data.length;i+=4){const g=data[i]*.2126+data[i+1]*.7152+data[i+2]*.0722,v=g<218?0:255;data[i]=data[i+1]=data[i+2]=v;data[i+3]=255;}ctx.putImageData(image,0,0);
        if(!rotate)return source;
        const out=document.createElement('canvas');out.width=h;out.height=w;const o=out.getContext('2d');o.fillStyle='#fff';o.fillRect(0,0,out.width,out.height);o.translate(out.width/2,out.height/2);o.rotate(Math.PI/2);o.drawImage(source,-w/2,-h/2);return out;
      }
      function extractDimensionCandidates(text){
        const counts=new Map();(String(text||'').match(/\b\d{3,6}\b/g)||[]).forEach(raw=>{const value=Number(raw);if(value>=500&&value<=30000)counts.set(value,(counts.get(value)||0)+1);});
        return [...counts.entries()].map(([value,count])=>({value,count})).sort((a,b)=>b.count-a.count||b.value-a.value).slice(0,18);
      }
      function fillOcrSelect(id,candidates,fallback){
        const el=$(id);el.innerHTML='';const values=candidates.length?candidates:fallback;values.forEach((entry,index)=>{const option=document.createElement('option');option.value=entry.value;option.textContent=`${entry.value.toLocaleString()} mm${entry.count>1?` · read ${entry.count}×`:''}`;if(index===0)option.selected=true;el.appendChild(option);});
      }
      function setOcrProgress(status,progress){$('ocrStatus').textContent=status;$('ocrProgressBar').style.width=`${Math.max(0,Math.min(100,Math.round(progress*100)))}%`;}
      async function readDimensionsWithOcr(){
        if(ocrBusy)return;if(!basemapImage){alert('Upload a floor-plan image first.');return;}ocrBusy=true;$('ocrDimensions').disabled=true;$('ocrPanel').hidden=false;setOcrProgress('Loading browser OCR…',.03);let worker=null;
        try{
          const Tesseract=await loadTesseract();worker=await Tesseract.createWorker('eng',1,{logger:m=>{if(m.status)setOcrProgress(`${m.status}${Number.isFinite(m.progress)?` · ${Math.round(m.progress*100)}%`:''}`,Math.min(.45,(m.progress||0)*.45));}});await worker.setParameters({tessedit_char_whitelist:'0123456789',preserve_interword_spaces:'1'});
          setOcrProgress('Reading horizontal dimension text…',.48);const horizontal=await worker.recognize(makeOcrCanvas(false));setOcrProgress('Reading vertical dimension text…',.73);const vertical=await worker.recognize(makeOcrCanvas(true));
          ocrCandidates={horizontal:extractDimensionCandidates(horizontal.data.text),vertical:extractDimensionCandidates(vertical.data.text)};const combined=[...ocrCandidates.horizontal,...ocrCandidates.vertical].sort((a,b)=>b.count-a.count||b.value-a.value);
          fillOcrSelect('ocrWidthCandidate',ocrCandidates.horizontal,combined);fillOcrSelect('ocrDepthCandidate',ocrCandidates.vertical,combined);
          if(!$('ocrWidthCandidate').options.length||!$('ocrDepthCandidate').options.length)throw new Error('No reliable 3–6 digit dimension values were found.');
          setOcrProgress('OCR complete. Confirm the width and depth candidates before applying them.',1);
        }catch(error){console.error(error);setOcrProgress(`OCR could not finish: ${error.message}`,0);}
        finally{if(worker)await worker.terminate().catch(()=>{});ocrBusy=false;$('ocrDimensions').disabled=false;}
      }
      function applyOcrDimensions(){
        if(!project.basemap)return;const width=Number($('ocrWidthCandidate').value),depth=Number($('ocrDepthCandidate').value);if(!width||!depth)return;
        pushHistory('apply OCR dimensions');$('planWidth').value=width;$('planDepth').value=depth;basemapAspectRatio=width/depth;project.basemap.width=width;project.basemap.depth=depth;project.basemap.lockRatio=$('lockBasemapRatio').checked;wallDetectionCache=null;buildBasemap(true);renderArchitectureHighlight();$('basemapStatus').textContent=`Applied ${width.toLocaleString()} × ${depth.toLocaleString()} mm from confirmed OCR candidates. Run Auto-fit drawing β, then review wall alignment.`;
      }

      function buildShellLayer(){
