      // Right-panel declutter: collapsible Selected wall / opening and Camera sections,
      // plus a compact hover/focus tooltip for wall-editing instructions.
      const rightPanelCollapseKeyV30='bto-layout-studio:right-panel-collapse:v1';
      function readRightPanelCollapseV30(){try{return JSON.parse(localStorage.getItem(rightPanelCollapseKeyV30)||'{}')||{};}catch{return{};}}
      function writeRightPanelCollapseV30(state){try{localStorage.setItem(rightPanelCollapseKeyV30,JSON.stringify(state));}catch{}}
      const rightPanelCollapseStateV30=readRightPanelCollapseV30();

      if(!document.getElementById('rightPanelDeclutterStylesV30')){
        const style=document.createElement('style');style.id='rightPanelDeclutterStylesV30';style.textContent=`
          .panel.right>.section[data-right-collapsible="true"]>h2{display:flex;align-items:center;gap:8px;justify-content:space-between;margin-bottom:12px}
          .panel.right>.section[data-right-collapsible="true"].right-section-collapsed{padding-top:11px;padding-bottom:11px}
          .panel.right>.section[data-right-collapsible="true"].right-section-collapsed>h2{margin-bottom:0}
          .right-section-heading-tools{display:inline-flex;align-items:center;gap:6px;margin-left:auto}
          .right-section-toggle{padding:4px 8px;min-width:46px;border-radius:999px;font-size:9px;line-height:1.1;text-transform:none;letter-spacing:0;color:var(--muted);background:#292a25}
          .right-section-toggle[aria-expanded="true"]::before{content:'▾ ';color:var(--sage)}
          .right-section-toggle[aria-expanded="false"]::before{content:'▸ ';color:var(--sage)}
          .right-section-collapse-body[hidden]{display:none!important}
          .wall-help-wrap{position:relative;display:inline-flex;align-items:center}
          .wall-help-button{width:22px;height:22px;padding:0;border-radius:999px;font-size:11px;font-weight:700;color:#cfe2ff;background:rgba(47,128,255,.14);border-color:rgba(90,155,255,.5)}
          .wall-help-tooltip{position:absolute;right:0;top:calc(100% + 8px);z-index:120;width:250px;padding:10px 11px;border-radius:9px;background:#233449;border:1px solid #5b8fcf;color:#e1efff;font-size:10px;line-height:1.45;text-transform:none;letter-spacing:0;box-shadow:0 12px 30px rgba(0,0,0,.35);opacity:0;visibility:hidden;transform:translateY(-3px);transition:opacity .12s ease,transform .12s ease,visibility .12s ease;pointer-events:none}
          .wall-help-wrap:hover .wall-help-tooltip,.wall-help-wrap:focus-within .wall-help-tooltip{opacity:1;visibility:visible;transform:translateY(0)}
          .wall-help-key{display:grid;grid-template-columns:auto 1fr;gap:4px 7px;align-items:center;margin-top:7px;color:#c7d8ec}
          #cameraCutawayControls>h2,#eyeLabelCleanupControls>h2{font-size:10px;margin-bottom:9px!important;color:#bbb9ae}
        `;document.head.appendChild(style);
      }

      function makeRightSectionCollapsibleV30(section,key,defaultCollapsed=false){
        if(!section||section.dataset.rightCollapsible==='true')return;
        const heading=section.querySelector(':scope > h2');if(!heading)return;
        section.dataset.rightCollapsible='true';
        const body=document.createElement('div');body.className='right-section-collapse-body';body.id=`right-${key}-body`;
        [...section.children].filter(child=>child!==heading).forEach(child=>body.appendChild(child));section.appendChild(body);
        const tools=document.createElement('span');tools.className='right-section-heading-tools';
        const toggle=document.createElement('button');toggle.type='button';toggle.className='right-section-toggle';toggle.setAttribute('aria-controls',body.id);
        tools.appendChild(toggle);heading.appendChild(tools);
        const collapsed=rightPanelCollapseStateV30[key]===undefined?defaultCollapsed:!!rightPanelCollapseStateV30[key];
        const apply=value=>{body.hidden=value;section.classList.toggle('right-section-collapsed',value);toggle.setAttribute('aria-expanded',String(!value));toggle.textContent=value?'Show':'Hide';toggle.title=`${value?'Show':'Hide'} ${heading.childNodes[0]?.textContent?.trim()||'section'}`;rightPanelCollapseStateV30[key]=value;writeRightPanelCollapseV30(rightPanelCollapseStateV30);};
        toggle.addEventListener('click',()=>apply(!body.hidden));apply(collapsed);
        return{section,heading,body,tools,toggle,apply};
      }

      const selectedWallSectionV30=$('architectureEmpty')?.closest('.section');
      const selectedWallCollapseV30=makeRightSectionCollapsibleV30(selectedWallSectionV30,'selected-wall',false);
      const cameraSectionV30=$('saveCamera')?.closest('.section');
      makeRightSectionCollapsibleV30(cameraSectionV30,'camera',true);

      // Replace the large persistent blue note with a small question-mark tooltip.
      if(selectedWallCollapseV30&&!document.getElementById('wallHelpButtonV30')){
        const wrap=document.createElement('span');wrap.className='wall-help-wrap';
        const button=document.createElement('button');button.type='button';button.id='wallHelpButtonV30';button.className='wall-help-button';button.textContent='?';button.setAttribute('aria-label','Wall editing help');button.setAttribute('aria-describedby','wallHelpTooltipV30');
        const tip=document.createElement('span');tip.id='wallHelpTooltipV30';tip.className='wall-help-tooltip';tip.setAttribute('role','tooltip');tip.innerHTML=`
          Drag the wall body to move it. Drag a blue endpoint to extend or shorten it. Hold <strong>Ctrl</strong> while dragging an endpoint to keep the original angle. Drag the green handle to rotate around the wall centre.
          <span class="wall-help-key"><span class="handle-dot blue"></span><span>Blue: change wall length</span><span class="handle-dot green"></span><span>Green: rotate wall</span></span>`;
        wrap.append(button,tip);selectedWallCollapseV30.tools.insertBefore(wrap,selectedWallCollapseV30.toggle);
      }
      if($('selectedWallNote')){$('selectedWallNote').hidden=true;$('selectedWallNote').style.display='none';}

      // Remove the old cutaway terminology from the simplified UI. Blocking walls are
      // always fully hidden, so there is no longer a style choice.
      const cutawayHeadingV30=$('cameraCutawayControls')?.querySelector(':scope > h2');if(cutawayHeadingV30)cutawayHeadingV30.textContent='Blocking walls';
      const autoCutawayLabelV30=$('autoCutaway')?.closest('label');if(autoCutawayLabelV30){const text=[...autoCutawayLabelV30.childNodes].find(node=>node.nodeType===Node.TEXT_NODE);if(text)text.textContent=' Hide blocking walls automatically';}
      const cutawayDepthLabelV30=$('cutawayDepth')?.closest('label');if(cutawayDepthLabelV30){const text=[...cutawayDepthLabelV30.childNodes].find(node=>node.nodeType===Node.TEXT_NODE);if(text)text.textContent='Hide distance (mm)';}
      if($('cameraCutawayStatus'))$('cameraCutawayStatus').textContent='Hides foreground walls only for the camera view. The walls remain in the project and validation.';
      [$('cutawayStyle'),$('cutawayOpacity')].forEach(control=>control?.closest('label')?.remove());
