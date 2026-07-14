      // Collapsible left-panel sections. UI state is local to the browser rather
      // than project data, so opening a project does not change the user's workspace layout.
      const collapsibleSectionDefinitions=[
        {key:'project-workspace',title:'Project workspace',selector:'.section.project-workspace'},
        {key:'floor-plan-basemap',title:'Floor-plan basemap'},
        {key:'architecture',title:'Architecture'},
        {key:'add',title:'Add',selector:'.section.add-section'},
        {key:'display',title:'Display'}
      ];
      const sectionCollapseStorageKey='bto-layout-studio:collapsed-sections:v1';

      if(!document.getElementById('sectionCollapseStyles')){
        const style=document.createElement('style');style.id='sectionCollapseStyles';style.textContent=`
          .panel.left > .section[data-section-collapsible="true"] > h2{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px}
          .panel.left > .section[data-section-collapsible="true"].section-collapsed{padding-top:11px;padding-bottom:11px}
          .panel.left > .section[data-section-collapsible="true"].section-collapsed > h2{margin-bottom:0}
          .section-collapse-toggle{flex:0 0 auto;padding:4px 8px;min-width:46px;border-radius:999px;font-size:9px;line-height:1.1;text-transform:none;letter-spacing:0;color:var(--muted);background:#292a25}
          .section-collapse-toggle[aria-expanded="true"]::before{content:'▾ ';color:var(--sage)}
          .section-collapse-toggle[aria-expanded="false"]::before{content:'▸ ';color:var(--sage)}
          .section-collapse-body[hidden]{display:none!important}
        `;document.head.appendChild(style);
      }

      function readCollapsedSectionState(){
        try{return JSON.parse(localStorage.getItem(sectionCollapseStorageKey)||'{}')||{};}catch{return{};}
      }
      function saveCollapsedSectionState(state){
        try{localStorage.setItem(sectionCollapseStorageKey,JSON.stringify(state));}catch{}
      }
      function findSectionForCollapse(definition){
        if(definition.selector)return document.querySelector(definition.selector);
        return [...document.querySelectorAll('.panel.left > .section')].find(section=>section.querySelector(':scope > h2')?.textContent.trim()===definition.title)||null;
      }
      function setSectionCollapsed(section,key,collapsed,state){
        const body=section.querySelector(':scope > .section-collapse-body'),button=section.querySelector(':scope > h2 > .section-collapse-toggle');
        if(!body||!button)return;
        body.hidden=collapsed;section.classList.toggle('section-collapsed',collapsed);button.setAttribute('aria-expanded',String(!collapsed));button.textContent=collapsed?'Show':'Hide';button.title=`${collapsed?'Show':'Hide'} ${button.dataset.sectionTitle}`;
        if(state){state[key]=collapsed;saveCollapsedSectionState(state);}
      }
      function makeSectionCollapsible(definition,state){
        const section=findSectionForCollapse(definition);if(!section||section.dataset.sectionCollapsible==='true')return;
        const heading=section.querySelector(':scope > h2');if(!heading)return;
        section.dataset.sectionCollapsible='true';
        const body=document.createElement('div');body.className='section-collapse-body';
        [...section.children].filter(child=>child!==heading).forEach(child=>body.appendChild(child));section.appendChild(body);
        const button=document.createElement('button');button.type='button';button.className='section-collapse-toggle';button.dataset.sectionTitle=definition.title;button.setAttribute('aria-controls',`${definition.key}-section-body`);body.id=`${definition.key}-section-body`;
        button.addEventListener('click',()=>setSectionCollapsed(section,definition.key,!body.hidden,state));heading.appendChild(button);
        setSectionCollapsed(section,definition.key,!!state[definition.key]);
      }

      const collapsedSectionState=readCollapsedSectionState();
      collapsibleSectionDefinitions.forEach(definition=>makeSectionCollapsible(definition,collapsedSectionState));
