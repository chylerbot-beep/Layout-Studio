      // Restore Photo mode visibility by semantic key rather than object identity so a
      // scene rebuild during Photo mode (for example keyboard deletion) still restores
      // the newly created grid and current scene groups correctly.
      enterPhotoModeV31=function(){
        if(photoModeActiveV31)return;
        photoVisibilitySnapshotV31=Object.fromEntries(photoVisibilityTargetsV31().map(([key,object])=>[key,object.visible]));
        photoModeActiveV31=true;appV31?.classList.add('photo-mode');photoModeButtonV31.classList.add('active');photoModeButtonV31.textContent='Exit photo';document.activeElement?.blur?.();applyPhotoVisibilityV31();requestAnimationFrame(()=>resize());
      };
      exitPhotoModeV31=function(){
        if(!photoModeActiveV31)return;
        photoModeActiveV31=false;appV31?.classList.remove('photo-mode');photoModeButtonV31.classList.remove('active');photoModeButtonV31.textContent='Photo mode';
        const current=Object.fromEntries(photoVisibilityTargetsV31());Object.entries(photoVisibilitySnapshotV31||{}).forEach(([key,visible])=>{if(current[key])current[key].visible=visible;});photoVisibilitySnapshotV31=null;
        if(typeof updateDetectedWallHighlightsV28==='function')updateDetectedWallHighlightsV28(false);validate();scheduleEyeLabelCleanup();requestAnimationFrame(()=>resize());
      };
