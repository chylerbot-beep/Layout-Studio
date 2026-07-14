      // Compatibility and interaction refinements: broader standard-ZIP imports,
      // keyboard deletion, detected-wall display toggle, unlimited eye-level labels,
      // full wall cutaway, and new camera defaults.

      // Accept older and third-party standard ZIP layouts. Search every JSON entry,
      // accept nested folders/wrappers, ignore non-authoritative manifest format labels,
      // and inspect one nested ZIP when an archive was wrapped during download.
      function unwrapProjectDataV29(value){
        if(looksLikeProjectData(value))return value;
        if(!value||typeof value!=='object'||Array.isArray(value))return null;
        for(const key of ['project','data','layout','scene']){
          const candidate=value[key];
          if(looksLikeProjectData(candidate))return candidate;
          if(typeof candidate==='string')try{const parsed=JSON.parse(candidate);if(looksLikeProjectData(parsed))return parsed;}catch{}
        }
        return null;
      }
      function normaliseZipPathV29(value){return String(value||'').replace(/\\/g,'/').replace(/^\.\//,'').replace(/^\/+|\/+$/g,'');}
      function zipDirectoryV29(path){const clean=normaliseZipPathV29(path),index=clean.lastIndexOf('/');return index>=0?clean.slice(0,index+1):'';}
      function findZipEntryV29(zip,path,...baseDirs){
        const clean=normaliseZipPathV29(path);if(!clean)return null;
        const candidates=[clean,...baseDirs.filter(Boolean).map(base=>normaliseZipPathV29(base+clean))];
        for(const candidate of candidates){const exact=zip.file(candidate);if(exact)return exact;}
        const lowerCandidates=new Set(candidates.map(value=>value.toLowerCase()));
        const entries=Object.values(zip.files).filter(entry=>!entry.dir);
        const caseMatch=entries.find(entry=>lowerCandidates.has(normaliseZipPathV29(entry.name).toLowerCase()));if(caseMatch)return caseMatch;
        const basename=clean.split('/').pop().toLowerCase();
        const basenameMatches=entries.filter(entry=>normaliseZipPathV29(entry.name).split('/').pop().toLowerCase()===basename);
        return basenameMatches.length===1?basenameMatches[0]:null;
      }
      function projectEntryScoreV29(name,project){
        const lower=String(name||'').toLowerCase();let score=0;
        if(/(^|\/)project\.json$/.test(lower))score+=1000;
        if(/approved|project|layout|bto/.test(lower))score+=200;
        if(Array.isArray(project.walls))score+=120;
        if(Array.isArray(project.furniture))score+=100;
        if(Array.isArray(project.openings))score+=80;
        if(project.plan)score+=50;if(project.basemap)score+=30;if(project.meta)score+=20;
        return score;
      }
      async function findProjectEntryV29(zip,manifest){
        const requested=manifest?.projectFile?findZipEntryV29(zip,manifest.projectFile):null;
        const entries=Object.values(zip.files).filter(entry=>!entry.dir&&/\.json$/i.test(entry.name));
        const ordered=[];if(requested)ordered.push(requested);
        entries.filter(entry=>/(^|\/)project\.json$/i.test(entry.name)).forEach(entry=>ordered.push(entry));
        entries.filter(entry=>!/manifest|notes?|reference/i.test(entry.name)).forEach(entry=>ordered.push(entry));
        entries.forEach(entry=>ordered.push(entry));
        const seen=new Set(),valid=[];
        for(const entry of ordered){
          if(!entry||seen.has(entry.name))continue;seen.add(entry.name);
          try{const value=JSON.parse(await entry.async('string')),projectValue=unwrapProjectDataV29(value);if(projectValue)valid.push({entry,next:projectValue,score:projectEntryScoreV29(entry.name,projectValue)});}catch{}
        }
        valid.sort((a,b)=>b.score-a.score||a.entry.name.length-b.entry.name.length);
        return valid[0]||null;
      }
      async function restorePackageAssetsV29(zip,next,manifest,projectPath='',manifestPath=''){
        const projectDir=zipDirectoryV29(projectPath),manifestDir=zipDirectoryV29(manifestPath),basemapPath=next.basemap?.assetPath||manifest?.basemap?.path;
        if(basemapPath&&next.basemap){const asset=findZipEntryV29(zip,basemapPath,projectDir,manifestDir);if(asset){const bytes=await asset.async('uint8array'),blob=new Blob([bytes],{type:next.basemap.mimeType||manifest?.basemap?.mimeType||'image/png'});next.basemap.dataUrl=await blobToDataUrl(blob);}}
        for(const ref of next.references||[]){if(!ref.assetPath)continue;const asset=findZipEntryV29(zip,ref.assetPath,projectDir,manifestDir);if(!asset)continue;const bytes=await asset.async('uint8array'),blob=new Blob([bytes],{type:ref.mimeType||'image/jpeg'});ref.dataUrl=await blobToDataUrl(blob);}
      }
      async function readZipObjectV29(zip,label='ZIP',depth=0){
        const entries=Object.values(zip.files).filter(entry=>!entry.dir),manifestEntry=entries.find(entry=>/(^|\/)manifest\.json$/i.test(entry.name));let manifest=null;
        if(manifestEntry)try{manifest=JSON.parse(await manifestEntry.async('string'));}catch{}
        const found=await findProjectEntryV29(zip,manifest);
        if(found){await restorePackageAssetsV29(zip,found.next,manifest,found.entry.name,manifestEntry?.name||'');return{next:found.next,projectFileName:found.entry.name};}
        if(depth<1){
          const nested=entries.filter(entry=>/\.(zip|btozip)$/i.test(entry.name)).slice(0,6);
          for(const entry of nested)try{return await readZipObjectV29(await JSZip.loadAsync(await entry.async('uint8array')),`${label}/${entry.name}`,depth+1);}catch{}
        }
        throw new Error('No Layout Studio project JSON was found in this ZIP, including nested folders');
      }
      readProjectFromZip=async function(file){return readZipObjectV29(await JSZip.loadAsync(file),file?.name||'project ZIP',0);};

      // Delete the selected furniture with the physical Delete key, but never while
      // typing, editing a form field, dragging a control, or viewing a modal.
      window.addEventListener('keydown',event=>{
        if(event.key!=='Delete'||!selected||transform.dragging||wallDrag||document.querySelector('.modal.open'))return;
        const target=event.target,tag=target?.tagName?.toLowerCase();
        if(target?.isContentEditable||['input','textarea','select'].includes(tag))return;
        event.preventDefault();event.stopPropagation();pushHistory('delete furniture with keyboard');
        const id=selected.userData.id;project.furniture=project.furniture.filter(item=>item.id!==id);select(null);buildScene();
      },true);

      // Legacy Display toggle retained for project/UI compatibility. Architecture review
      // now owns the visible red unconfirmed-wall outline toggle.
      let autoWallsHighlightEnabledV29=true;
      try{autoWallsHighlightEnabledV29=localStorage.getItem('bto-layout-studio:auto-walls-highlight')!=='off';}catch{}
      const displaySectionV29=[...document.querySelectorAll('.panel.left > .section')].find(section=>section.querySelector(':scope > h2')?.textContent.trim()==='Display');
      const displayButtonsV29=displaySectionV29?.querySelector(':scope > .section-collapse-body > .button-row, :scope > .button-row');
      if(displayButtonsV29&&!$('toggleAutoWalls')){
        const button=document.createElement('button');button.id='toggleAutoWalls';button.textContent='Auto walls';displayButtonsV29.appendChild(button);
      }
      function syncAutoWallsToggleV29(){const button=$('toggleAutoWalls');if(button){button.classList.toggle('active',autoWallsHighlightEnabledV29);button.title=autoWallsHighlightEnabledV29?'Hide auto-detected wall outlines':'Show auto-detected wall outlines';}}
      if(typeof detectedHighlightShouldShowV28==='function'){
        const detectedHighlightShouldShowBeforeV29=detectedHighlightShouldShowV28;
        detectedHighlightShouldShowV28=function(){return autoWallsHighlightEnabledV29&&detectedHighlightShouldShowBeforeV29();};
      }
      if($('toggleAutoWalls'))$('toggleAutoWalls').onclick=()=>{autoWallsHighlightEnabledV29=!autoWallsHighlightEnabledV29;try{localStorage.setItem('bto-layout-studio:auto-walls-highlight',autoWallsHighlightEnabledV29?'on':'off');}catch{}syncAutoWallsToggleV29();if(typeof updateDetectedWallHighlightsV28==='function')updateDetectedWallHighlightsV28(false);};
      syncAutoWallsToggleV29();if(typeof updateDetectedWallHighlightsV28==='function')updateDetectedWallHighlightsV28(false);

      // Eye-level labels: migrate the old 18 px default to 30 px and remove the
      // visible-count cap entirely. Occlusion and overlap decluttering still apply.
      const ensureEyeLabelSettingsBeforeV29=ensureEyeLabelSettings;
      ensureEyeLabelSettings=function(){
        const existing=project.settings?.eyeLevelLabels||{},legacyDefault=existing.sizePx===18&&(existing.maxVisible===16||existing.maxVisible===undefined)&&!existing.default30Migrated;
        const hadSize=Number.isFinite(+existing.sizePx),settings=ensureEyeLabelSettingsBeforeV29();
        if(!hadSize||legacyDefault)settings.sizePx=30;
        settings.sizePx=Math.max(12,Math.min(30,+settings.sizePx||30));settings.maxVisible=Number.MAX_SAFE_INTEGER;settings.default30Migrated=true;return settings;
      };
      const maxVisibleFieldV29=$('eyeLabelMax');if(maxVisibleFieldV29)maxVisibleFieldV29.closest('label')?.remove();
      const labelSizeFieldV29=$('eyeLabelSize');if(labelSizeFieldV29){labelSizeFieldV29.value='30';labelSizeFieldV29.max='30';}
      ensureEyeLabelSettings();syncEyeLabelControls();scheduleEyeLabelCleanup();

      // Automatic and manual camera cutaway always fully hide affected walls.
      // Remove the fade/opacity controls so the interface matches the behaviour.
      const ensureCameraCutawaySettingsBeforeV29=ensureCameraCutawaySettings;
      ensureCameraCutawaySettings=function(){const settings=ensureCameraCutawaySettingsBeforeV29();settings.style='hide';settings.opacity=0;return settings;};
      [$('cutawayStyle'),$('cutawayOpacity')].forEach(control=>control?.closest('label')?.remove());
      ensureCameraCutawaySettings();syncCameraCutawayControls();scheduleCameraCutaway();

      // Camera defaults. Top view retains its orthographic-like 35° lens; normal bird's-eye
      // and eye-level views use 52°, with Eye level at 1,300 mm.
      viewBird=function(){
        const basemap=project.basemap||{},width=+(basemap.width||project.plan?.width||PLAN_W),depth=+(basemap.depth||project.plan?.depth||PLAN_H),offsetX=+(basemap.offsetX||0),offsetY=+(basemap.offsetY||0),cx=mm(offsetX+width/2),cz=mm(offsetY+depth/2),span=mm(Math.max(width,depth)),height=Math.max(8,span*1.02);
        camera.up.set(0,1,0);camera.fov=52;camera.updateProjectionMatrix();camera.position.set(cx+.01,height,cz+height*.18);orbit.target.set(cx,0,cz);orbit.enabled=true;orbit.enableRotate=true;orbit.enablePan=true;orbit.enableZoom=true;orbit.update();setViewButton('viewBird');
      };
      viewEye=function(){camera.up.set(0,1,0);camera.fov=52;camera.updateProjectionMatrix();camera.position.set(mm(11200),1.3,mm(8500));orbit.target.set(mm(9000),1.1,mm(3200));orbit.update();setViewButton('viewEye');};
      if($('fovField'))$('fovField').value='52';if($('depthField'))$('depthField').value='52';if($('cameraHeight'))$('cameraHeight').value='1300';
