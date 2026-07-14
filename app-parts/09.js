      function syncProjectCameraV27(){
        syncSelectedFromMesh();
        project.camera={position:camera.position.toArray(),target:orbit.target.toArray(),fov:camera.fov};
        project.meta=project.meta||{};project.meta.updatedAt=new Date().toISOString();project.meta.appVersion=APP_VERSION;
      }
      function safeFileName(value,fallback='project'){
        return String(value||fallback).trim().replace(/[^a-z0-9._-]+/gi,'-').replace(/^-+|-+$/g,'').toLowerCase()||fallback;
      }
      function projectDownloadName(extension){return `${safeFileName(project.meta?.name,'layout-studio-project')}.${extension}`;}
      function saveProjectV27(){
        syncProjectCameraV27();
        downloadBlob(new Blob([JSON.stringify(project,null,2)],{type:'application/json'}),projectDownloadName('json'));
      }
      function normalizeProjectV27(){
        project.meta=project.meta||{};project.meta.name=project.meta.name||'Untitled layout';project.meta.brief=project.meta.brief||'';project.meta.createdAt=project.meta.createdAt||new Date().toISOString();project.meta.updatedAt=project.meta.updatedAt||new Date().toISOString();project.meta.appVersion=APP_VERSION;
        project.references=Array.isArray(project.references)?project.references:[];
        project.rooms=project.rooms||[];project.walls=project.walls||[];project.openings=project.openings||[];project.shell=project.shell||[];project.clearances=project.clearances||[];project.furniture=project.furniture||[];
        project.settings=project.settings||{};if(project.settings.ceilingVisible===undefined)project.settings.ceilingVisible=false;project.settings.ceilingHeight=Math.max(2100,Math.min(5000,+project.settings.ceilingHeight||2600));
        project.walls.forEach((w,i)=>{w.id=w.id||`wall-imported-${i}`;const e=wallEndpoints(w);if(![w.x1,w.y1,w.x2,w.y2].every(Number.isFinite)){w.x1=e.x1;w.y1=e.y1;w.x2=e.x2;w.y2=e.y2;}w.thickness=wallThickness(w);syncWallLegacyBounds(w);});
        project.openings.forEach((o,i)=>o.id=o.id||`opening-imported-${i}`);
        project.furniture.forEach((item,i)=>{item.id=item.id||`item-imported-${i}`;item.category=item.category||'furniture';item.elevation=Math.max(0,+item.elevation||0);});
        project.references.forEach((item,i)=>{item.id=item.id||`reference-${i}`;item.name=item.name||`Reference ${i+1}`;item.mimeType=item.mimeType||'image/jpeg';});
        if(project.basemap){project.basemap.width=project.basemap.width||PLAN_W;project.basemap.depth=project.basemap.depth||PLAN_H;project.basemap.offsetX=project.basemap.offsetX||0;project.basemap.offsetY=project.basemap.offsetY||0;project.basemap.crop=project.basemap.crop||{left:0,top:0,right:1,bottom:1};if(project.basemap.lockRatio===undefined)project.basemap.lockRatio=true;project.basemap.sourceName=project.basemap.sourceName||'basemap.png';project.basemap.mimeType=project.basemap.mimeType||'image/png';}
      }
      function createBlankProjectV27(){
        const width=Math.max(100,+$('planWidth').value||PLAN_W),depth=Math.max(100,+$('planDepth').value||PLAN_H),now=new Date().toISOString();
        return {meta:{name:'Untitled layout',brief:'',createdAt:now,updatedAt:now,appVersion:APP_VERSION},references:[],basemap:null,rooms:[],walls:[],openings:[],shell:[],clearances:[],furniture:[],settings:{ceilingVisible:false,ceilingHeight:2600},camera:null,plan:{width,depth,unit:'mm'}};
      }
      function applyProjectDataV27(nextProject,historyLabel='load project'){
        if(historyLabel)pushHistory(historyLabel);
        project=nextProject;normalizeProjectV27();selected=null;selectedArchitecture=null;transform.detach();wallDetectionCache=null;basemapRenderSignature='';basemapImage=null;
        if(project.basemap?.dataUrl){basemapImage=new Image();basemapImage.onload=()=>{buildBasemap(true);renderArchitectureHighlight();};basemapImage.src=project.basemap.dataUrl;}
        buildScene();syncBasemapControls();updateProjectWorkspace();
        if(project.camera?.position&&project.camera?.target){camera.position.fromArray(project.camera.position);orbit.target.fromArray(project.camera.target);camera.fov=project.camera.fov||50;camera.updateProjectionMatrix();orbit.update();}
      }
      function loadProjectV27(file){
        const reader=new FileReader();reader.onload=()=>{try{applyProjectDataV27(JSON.parse(reader.result),'load JSON project');setPackageStatus(`Loaded ${file.name}.`,'ok');}catch(e){console.error(e);setPackageStatus(`This project JSON could not be read: ${e.message}`,'error');alert(`This project JSON could not be read.\n\n${e.message}`);}};reader.readAsText(file);
      }
      function blobToDataUrl(blob){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob);});}
      function dataUrlPayload(dataUrl){const match=String(dataUrl||'').match(/^data:([^;,]+)?(?:;[^,]*)?;base64,(.*)$/);return match?{mimeType:match[1]||'application/octet-stream',base64:match[2]}:null;}
      function extensionForMime(mimeType,name=''){
        const fromName=String(name).match(/\.([a-z0-9]{2,5})$/i);if(fromName)return fromName[1].toLowerCase();
        return ({'image/png':'png','image/jpeg':'jpg','image/webp':'webp','application/json':'json'})[mimeType]||'bin';
      }
      function setPackageStatus(message,state=''){$('packageStatus').textContent=message;$('packageStatus').className=`small package-status ${state}`.trim();}
      function setPackageBusy(busy,message){packageBusy=busy;['newBlankProject','openPackage','exportPackage','addReferences','openLibraryProject'].forEach(id=>$(id).disabled=busy);if(message)setPackageStatus(message,busy?'busy':'');}
      function updateProjectWorkspace(){
        if(!$('projectName'))return;$('projectName').value=project.meta?.name||'Untitled layout';$('projectBrief').value=project.meta?.brief||'';renderReferenceList();
      }
      function renderReferenceList(){
        const refs=project.references||[],container=$('referenceList');$('referenceCount').textContent=`${refs.length} image${refs.length===1?'':'s'}`;container.innerHTML='';
        if(!refs.length){container.innerHTML='<div class="reference-empty">No reference images added. These are included in exported project ZIP files.</div>';return;}
        refs.forEach(ref=>{const card=document.createElement('div');card.className='reference-card';const img=document.createElement('img');img.src=ref.dataUrl||'';img.alt=ref.name;img.loading='lazy';const name=document.createElement('div');name.className='reference-name';name.textContent=ref.name;const remove=document.createElement('button');remove.className='reference-remove';remove.textContent='×';remove.title='Remove reference';remove.onclick=()=>{pushHistory('remove reference image');project.references=project.references.filter(x=>x.id!==ref.id);renderReferenceList();};card.append(img,name,remove);container.appendChild(card);});
      }
      async function addReferenceFiles(files){
        const accepted=[...files].filter(file=>file.type.startsWith('image/'));if(!accepted.length)return;pushHistory('add reference images');setPackageBusy(true,`Adding ${accepted.length} reference image${accepted.length===1?'':'s'}…`);
        try{for(const file of accepted){project.references.push({id:`reference-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,name:file.name,mimeType:file.type||'image/jpeg',size:file.size,addedAt:new Date().toISOString(),dataUrl:await blobToDataUrl(file)});}project.meta.updatedAt=new Date().toISOString();renderReferenceList();setPackageStatus(`Added ${accepted.length} reference image${accepted.length===1?'':'s'}.`,'ok');}catch(error){console.error(error);setPackageStatus('One or more reference images could not be added.','error');}finally{setPackageBusy(false);$('referenceFiles').value='';}
      }
      async function exportProjectPackage(){
        if(packageBusy)return;if(typeof JSZip==='undefined'){setPackageStatus('JSZip did not load. Check the internet connection and reload.','error');return;}
        syncProjectCameraV27();setPackageBusy(true,'Preparing standard ZIP project package…');
        try{
          const zip=new JSZip(),portable=JSON.parse(JSON.stringify(project)),manifest={format:PROJECT_PACKAGE_FORMAT,formatVersion:1,appVersion:APP_VERSION,name:portable.meta?.name||'Untitled layout',createdAt:new Date().toISOString(),projectFile:'project.json',notesFile:'project-notes.json',basemap:null,references:[]};
          if(portable.basemap?.dataUrl){const payload=dataUrlPayload(portable.basemap.dataUrl);if(payload){const ext=extensionForMime(portable.basemap.mimeType||payload.mimeType,portable.basemap.sourceName),path=`assets/basemap.${ext}`;zip.file(path,payload.base64,{base64:true});portable.basemap.assetPath=path;delete portable.basemap.dataUrl;manifest.basemap={path,mimeType:portable.basemap.mimeType||payload.mimeType,sourceName:portable.basemap.sourceName};}}
          portable.references=(portable.references||[]).map((ref,index)=>{const payload=dataUrlPayload(ref.dataUrl),ext=extensionForMime(ref.mimeType||payload?.mimeType,ref.name),path=`references/${String(index+1).padStart(2,'0')}-${safeFileName(ref.name||`reference-${index+1}.${ext}`)}`;if(payload)zip.file(path,payload.base64,{base64:true});const metadata={...ref,assetPath:path};delete metadata.dataUrl;manifest.references.push({path,name:metadata.name,mimeType:metadata.mimeType});return metadata;});
          zip.file('manifest.json',JSON.stringify(manifest,null,2));zip.file('project.json',JSON.stringify(portable,null,2));zip.file('project-notes.json',JSON.stringify(portable.meta||{},null,2));
          const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:6}},progress=>setPackageStatus(`Compressing project ZIP… ${Math.round(progress.percent)}%`,'busy'));
          downloadBlob(blob,projectDownloadName('zip'));setPackageStatus('Standard ZIP exported with project JSON, basemap, reference images and notes.','ok');
        }catch(error){console.error(error);setPackageStatus(`ZIP export failed: ${error.message}`,'error');}finally{setPackageBusy(false);}
      }
      function looksLikeProjectData(value){
        return !!value&&typeof value==='object'&&!Array.isArray(value)&&(['walls','rooms','openings','furniture','basemap','meta','plan'].some(key=>key in value));
      }
      function chooseProjectJsonEntry(zip,manifest){
        const requested=manifest?.projectFile&&zip.file(manifest.projectFile);if(requested)return requested;
        const exact=zip.file('project.json');if(exact)return exact;
        const candidates=Object.values(zip.files).filter(entry=>!entry.dir&&/\.json$/i.test(entry.name)&&!/manifest|notes?/i.test(entry.name));
        candidates.sort((a,b)=>{const ap=/project|layout/i.test(a.name)?0:1,bp=/project|layout/i.test(b.name)?0:1;return ap-bp||a.name.length-b.name.length;});
        return candidates[0]||null;
      }
      async function restorePackageAssets(zip,next,manifest){
        const basemapPath=next.basemap?.assetPath||manifest?.basemap?.path;
        if(basemapPath&&next.basemap){const asset=zip.file(basemapPath);if(asset){const bytes=await asset.async('uint8array'),blob=new Blob([bytes],{type:next.basemap.mimeType||manifest?.basemap?.mimeType||'image/png'});next.basemap.dataUrl=await blobToDataUrl(blob);}}
        for(const ref of next.references||[]){if(!ref.assetPath)continue;const asset=zip.file(ref.assetPath);if(!asset)continue;const bytes=await asset.async('uint8array'),blob=new Blob([bytes],{type:ref.mimeType||'image/jpeg'});ref.dataUrl=await blobToDataUrl(blob);}
      }
      async function readProjectFromZip(file){
        const zip=await JSZip.loadAsync(file),manifestEntry=zip.file('manifest.json');let manifest=null;
        if(manifestEntry){manifest=JSON.parse(await manifestEntry.async('string'));if(manifest.format&&manifest.format!==PROJECT_PACKAGE_FORMAT)throw new Error(`Unsupported package format: ${manifest.format}`);}
        const projectEntry=chooseProjectJsonEntry(zip,manifest);if(!projectEntry)throw new Error('No project JSON file was found inside the ZIP');
        const next=JSON.parse(await projectEntry.async('string'));if(!looksLikeProjectData(next))throw new Error(`${projectEntry.name} does not look like a Layout Studio project`);
        await restorePackageAssets(zip,next,manifest);return{next,projectFileName:projectEntry.name};
      }
      async function readProjectFromPlainJson(file){
        const text=await file.text();const next=JSON.parse(text);if(!looksLikeProjectData(next))throw new Error('The file contains JSON, but it is not a Layout Studio project');return next;
      }
      async function importProjectPackage(file,sourceLabel=file?.name||'project ZIP'){
        if(packageBusy)return;if(typeof JSZip==='undefined'){setPackageStatus('JSZip did not load. Check the internet connection and reload.','error');return;}
        setPackageBusy(true,`Opening ${sourceLabel}…`);let zipError=null;
        try{
          let next,detail='';
          try{const result=await readProjectFromZip(file);next=result.next;detail=` from ${result.projectFileName}`;}
          catch(error){zipError=error;next=await readProjectFromPlainJson(file);detail=' as a plain JSON project';}
          applyProjectDataV27(next,'open project package');setPackageStatus(`Opened ${sourceLabel}${detail}.`,'ok');
        }catch(error){
          console.error('ZIP read error:',zipError);console.error('Fallback read error:',error);
          const detail=zipError&&zipError.message!==error.message?`${zipError.message}; fallback: ${error.message}`:error.message;
          setPackageStatus(`Project could not be opened: ${detail}`,'error');
          alert(`This file is not a readable project ZIP or Layout Studio JSON.\n\n${detail}\n\nA valid ZIP should contain project.json, or another JSON file containing the Layout Studio project data.`);
        }finally{setPackageBusy(false);$('packageFile').value='';}
      }
      function newBlankProject(){
        if((project.walls?.length||project.furniture?.length||project.basemap)&&!confirm('Start a blank project? The current project remains available only if you save or export it first.'))return;
        applyProjectDataV27(createBlankProjectV27(),'new blank project');undoStack.length=0;redoStack.length=0;$('undo').disabled=true;$('redo').disabled=true;viewTop();setPackageStatus('Blank millimetre-based project created. Upload a basemap and add reference images.','ok');
      }
      async function refreshProjectLibrary(){
        $('libraryStatus').textContent='Loading project library…';$('projectLibrary').innerHTML='<option value="">Loading…</option>';
        try{const response=await fetch(`${PROJECT_LIBRARY_URL}?v=${Date.now()}`,{cache:'no-store'});if(!response.ok)throw new Error(`HTTP ${response.status}`);const data=await response.json();projectLibraryItems=Array.isArray(data)?data:(data.projects||[]);$('projectLibrary').innerHTML='';if(!projectLibraryItems.length){$('projectLibrary').innerHTML='<option value="">No hosted projects yet</option>';$('libraryStatus').textContent='The project library is ready but currently empty.';}else{projectLibraryItems.forEach((item,index)=>{const option=document.createElement('option');option.value=String(index);option.textContent=item.name||item.id||`Project ${index+1}`;$('projectLibrary').appendChild(option);});$('libraryStatus').textContent=`${projectLibraryItems.length} hosted project${projectLibraryItems.length===1?'':'s'} available.`;}$('libraryCount').textContent=projectLibraryItems.length?String(projectLibraryItems.length):'';}catch(error){console.error(error);projectLibraryItems=[];$('projectLibrary').innerHTML='<option value="">Library unavailable</option>';$('libraryStatus').textContent='Could not read projects/index.json. The rest of the app still works.';$('libraryCount').textContent='';}
      }
      async function openSelectedLibraryProject(){
        const index=Number($('projectLibrary').value),entry=projectLibraryItems[index];if(!entry?.package)return;
        setPackageBusy(true,`Downloading ${entry.name||'hosted project'}…`);
        try{const url=new URL(entry.package,new URL(PROJECT_LIBRARY_URL,location.href));const response=await fetch(url);if(!response.ok)throw new Error(`HTTP ${response.status}`);const blob=await response.blob();setPackageBusy(false);await importProjectPackage(blob,entry.name||url.pathname.split('/').pop());}catch(error){console.error(error);setPackageBusy(false);setPackageStatus(`Hosted project could not be opened: ${error.message}`,'error');}
      }
      async function openPackageFromUrl(urlValue){
        try{const url=new URL(urlValue,location.href),response=await fetch(url);if(!response.ok)throw new Error(`HTTP ${response.status}`);await importProjectPackage(await response.blob(),url.pathname.split('/').pop()||'linked project');}catch(error){console.error(error);setPackageStatus(`Linked project could not be opened: ${error.message}`,'error');}
      }

      queueMicrotask(()=>{
        $('saveJson').onclick=saveProjectV27;$('jsonFile').onchange=e=>e.target.files[0]&&loadProjectV27(e.target.files[0]);
        $('newBlankProject').onclick=newBlankProject;$('openPackage').onclick=()=>$('packageFile').click();$('packageFile').onchange=e=>e.target.files[0]&&importProjectPackage(e.target.files[0]);$('exportPackage').onclick=exportProjectPackage;
        $('addReferences').onclick=()=>$('referenceFiles').click();$('referenceFiles').onchange=e=>addReferenceFiles(e.target.files);
        $('projectName').onchange=()=>{pushHistory('rename project');project.meta=project.meta||{};project.meta.name=$('projectName').value.trim()||'Untitled layout';project.meta.updatedAt=new Date().toISOString();};
        $('projectBrief').onchange=()=>{pushHistory('edit project brief');project.meta=project.meta||{};project.meta.brief=$('projectBrief').value;project.meta.updatedAt=new Date().toISOString();};
        $('refreshLibrary').onclick=refreshProjectLibrary;$('openLibraryProject').onclick=openSelectedLibraryProject;
        normalizeProjectV27();updateProjectWorkspace();refreshProjectLibrary();
        const params=new URLSearchParams(location.search),linkedPackage=params.get('package')||params.get('project');if(linkedPackage)openPackageFromUrl(linkedPackage);
      });
