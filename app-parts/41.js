      // Whole-sidebar toggles keep the canvas roomy without discarding the user's
      // preferred panel layout. This browser-only preference is not project data.
      const sidebarCollapseStorageKey='bto-layout-studio:collapsed-sidebars:v1';
      let sidebarCollapseState={};
      try{sidebarCollapseState=JSON.parse(localStorage.getItem(sidebarCollapseStorageKey)||'{}')||{};}catch{}

      function configureSidebarToggle(side,buttonId){
        const button=$(buttonId),app=document.querySelector('.app');
        if(!button||!app)return;
        const className=`${side}-sidebar-collapsed`;
        const label=button.querySelector('.sidebar-toggle-label');
        const icon=button.querySelector('[aria-hidden="true"]');
        const apply=collapsed=>{
          app.classList.toggle(className,collapsed);
          button.setAttribute('aria-expanded',String(!collapsed));
          const action=collapsed?'Expand':'Collapse';
          button.title=`${action} ${side} sidebar`;
          button.setAttribute('aria-label',button.title);
          if(label)label.textContent=button.title;
          if(icon)icon.textContent=side==='left'?(collapsed?'▶':'◀'):(collapsed?'◀':'▶');
          sidebarCollapseState[side]=collapsed;
          try{localStorage.setItem(sidebarCollapseStorageKey,JSON.stringify(sidebarCollapseState));}catch{}
          requestAnimationFrame(()=>window.dispatchEvent(new Event('resize')));
        };
        button.addEventListener('click',()=>apply(!app.classList.contains(className)));
        apply(!!sidebarCollapseState[side]);
      }

      configureSidebarToggle('left','toggleLeftSidebar');
      configureSidebarToggle('right','toggleRightSidebar');
