      const viewport = document.getElementById('viewport');
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0xd9d5ce);
      const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 100);
      const renderer = new THREE.WebGLRenderer({antialias:true, preserveDrawingBuffer:true, alpha:true, powerPreference:'low-power'});
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
      renderer.outputEncoding = THREE.sRGBEncoding;
      renderer.shadowMap.enabled = false;
      viewport.prepend(renderer.domElement);

      scene.add(new THREE.HemisphereLight(0xffffff, 0x77736f, 1.15));
      const sun = new THREE.DirectionalLight(0xffffff, .75);
      sun.position.set(-6, 12, -4); sun.castShadow = false;
      scene.add(sun);

      const orbit = new THREE.OrbitControls(camera, renderer.domElement);
      orbit.enableDamping = true; orbit.dampingFactor = .08;
      orbit.target.set(7.6, 0, 4.7);
      const transform = new THREE.TransformControls(camera, renderer.domElement);
      transform.setSpace('world'); transform.setTranslationSnap(.05); transform.setRotationSnap(THREE.MathUtils.degToRad(5));
      transform.addEventListener('dragging-changed', e => orbit.enabled = !e.value);
      transform.addEventListener('mouseDown', () => pushHistory(transform.mode==='rotate'?'rotate furniture':'move furniture'));
      transform.addEventListener('objectChange', syncSelectedFromMesh);
      transform.addEventListener('mouseUp', () => { syncSelectedFromMesh(); validate(); renderObjectList(); });
      scene.add(transform);

      const raycaster = new THREE.Raycaster();
      const labelRaycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      const furnitureGroup = new THREE.Group();
      const shellGroup = new THREE.Group();
      const roomGroup = new THREE.Group();
      const openingGroup = new THREE.Group();
      const basemapGroup = new THREE.Group();
      const clearanceGroup = new THREE.Group();
      const labelGroup = new THREE.Group();
      const architectureLabelGroup = new THREE.Group();
      const ceilingGroup = new THREE.Group();
      const selectionOverlayGroup = new THREE.Group();
      selectionOverlayGroup.renderOrder = 950;
      scene.add(basemapGroup, roomGroup, shellGroup, openingGroup, clearanceGroup, furnitureGroup, labelGroup, architectureLabelGroup, ceilingGroup, selectionOverlayGroup);
      // Start in a clean workspace. The example scene remains available as catalogue
      // and development data, but it is no longer loaded into a user's new session.
      const blankStartedAt = new Date().toISOString();
      let project = {
        meta:{name:'Untitled layout',brief:'',createdAt:blankStartedAt,updatedAt:blankStartedAt,appVersion:APP_VERSION},
        references:[],basemap:null,rooms:[],walls:[],openings:[],shell:[],clearances:[],furniture:[],
        settings:{ceilingVisible:false,ceilingHeight:2600},camera:null,
        plan:{width:PLAN_W,depth:PLAN_H,unit:'mm'}
      };
      let selected = null;
      let selectedArchitecture = null;
      let grid = null;
      let labelVisible = true;
      let activeTool = 'select';
      let wallStart = null;
      let basemapImage = null;
      let basemapAspectRatio = PLAN_W / PLAN_H;
      let basemapResizeGuard = false;
      let wallDetectionCache = null;
      let basemapRenderSignature = '';
      let wallDrag = null;
      let wallDragLastRender = 0;
      let openingDrag = null;
      let ocrBusy = false;
      let tesseractLoader = null;
      let ocrCandidates = {horizontal:[],vertical:[]};
      let projectLibraryItems = [];
      let packageBusy = false;
      const undoStack = [];
      const redoStack = [];

      function mm(v){ return v * MM; }
      function worldCenter(item){ return {x:mm(item.x + item.w/2), z:mm(item.y + item.d/2)}; }
      function makeBox(item, material, yBase=0){
        const radius = item.shape === 'rounded' ? Math.min(mm(item.w), mm(item.d)) * .22 : 0;
        let geometry;
        if (radius > 0) {
          const shape = new THREE.Shape();
          const w=mm(item.w), d=mm(item.d), r=radius;
          shape.moveTo(-w/2+r,-d/2); shape.lineTo(w/2-r,-d/2); shape.quadraticCurveTo(w/2,-d/2,w/2,-d/2+r);
          shape.lineTo(w/2,d/2-r); shape.quadraticCurveTo(w/2,d/2,w/2-r,d/2); shape.lineTo(-w/2+r,d/2);
          shape.quadraticCurveTo(-w/2,d/2,-w/2,d/2-r); shape.lineTo(-w/2,-d/2+r); shape.quadraticCurveTo(-w/2,-d/2,-w/2+r,-d/2);
          geometry = new THREE.ExtrudeGeometry(shape,{depth:mm(item.h),bevelEnabled:true,bevelSize:.025,bevelThickness:.02,bevelSegments:2});
          geometry.rotateX(Math.PI/2); geometry.translate(0,mm(item.h),0);
        } else geometry = new THREE.BoxGeometry(mm(item.w), mm(item.h), mm(item.d));
        const mesh = new THREE.Mesh(geometry, material);
        const c = worldCenter(item);
        mesh.position.set(c.x, yBase + mm(item.h)/2, c.z);
        mesh.rotation.y = THREE.MathUtils.degToRad(item.rotation || 0);
        mesh.castShadow = false; mesh.receiveShadow = false;
        return mesh;
      }

      function clearGroup(group){
        const disposedTextures=new Set(),disposedMaterials=new Set(),disposedGeometries=new Set();
        while(group.children.length){const child=group.children.pop();child.traverse(node=>{(node.userData?.labelTextures||[]).forEach(texture=>{if(texture&&!disposedTextures.has(texture)){texture.dispose();disposedTextures.add(texture);}});if(node.geometry&&!disposedGeometries.has(node.geometry)){node.geometry.dispose();disposedGeometries.add(node.geometry);}const materials=Array.isArray(node.material)?node.material:[node.material];materials.filter(Boolean).forEach(material=>{if(material.map&&!disposedTextures.has(material.map)){material.map.dispose();disposedTextures.add(material.map);}if(!disposedMaterials.has(material)){material.dispose();disposedMaterials.add(material);}});});}
      }

      function wallEndpoints(wall){
        if([wall.x1,wall.y1,wall.x2,wall.y2].every(Number.isFinite)){
          const dx=wall.x2-wall.x1,dy=wall.y2-wall.y1,length=Math.max(1,Math.hypot(dx,dy));
          return {x1:wall.x1,y1:wall.y1,x2:wall.x2,y2:wall.y2,dx,dy,length,ux:dx/length,uy:dy/length,horizontal:Math.abs(dx)>=Math.abs(dy),angle:Math.atan2(dy,dx)};
        }
        const horizontal=wall.w>=wall.d;
        const e=horizontal
          ? {x1:wall.x,y1:wall.y+wall.d/2,x2:wall.x+wall.w,y2:wall.y+wall.d/2}
          : {x1:wall.x+wall.w/2,y1:wall.y,x2:wall.x+wall.w/2,y2:wall.y+wall.d};
        const dx=e.x2-e.x1,dy=e.y2-e.y1,length=Math.max(1,Math.hypot(dx,dy));
        return {...e,dx,dy,length,ux:dx/length,uy:dy/length,horizontal,angle:Math.atan2(dy,dx)};
      }
      function wallThickness(wall){
        if(Number.isFinite(wall.thickness))return Math.max(50,wall.thickness);
        const e=wallEndpoints(wall);
        return Math.max(50,e.horizontal?wall.d:wall.w);
      }
      function wallMetrics(wall){
        const e=wallEndpoints(wall),t=wallThickness(wall);
        return {...e,thickness:t,cx:(e.x1+e.x2)/2,cy:(e.y1+e.y2)/2};
      }
