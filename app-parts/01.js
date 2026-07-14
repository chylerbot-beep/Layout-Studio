    (() => {
      const $ = id => document.getElementById(id);
      const MM = 0.001;
      const PLAN_W = 14775;
      const PLAN_H = 9500;
      const APP_VERSION = '2.7';
      const PROJECT_PACKAGE_FORMAT = 'bto-layout-package';
      const PROJECT_LIBRARY_URL = 'projects/index.json';
      const TESSERACT_CDN = 'https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.min.js';
      const palette = {
        fixed: 0xc8c1b7, floor: 0xe7e2da, wall: 0x8b8983,
        furniture: 0xaaa299, selected: 0x91a58a, collision: 0xd86d61,
        clearance: 0x80ad91, glass: 0x82abc1
      };

      const initialScene = {
        meta: {name:'Example apartment',brief:'Couple household. Open bedroom beside living room, open kitchen, king bed, queen bed, TV and dining for 6–8.',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),appVersion:APP_VERSION},
        references: [],
        basemap: null,
        rooms: [
          {id:'room-master',name:'Master bedroom',type:'bedroom',x:0,y:0,w:3150,d:5010,color:0xe8e1d8},
          {id:'room-bed2',name:'Bedroom 2',type:'bedroom',x:3150,y:0,w:3050,d:5010,color:0xe8e1d8},
          {id:'room-open',name:'Opened bedroom / dining',type:'dining',x:6200,y:0,w:3000,d:5010,color:0xf0ebe5},
          {id:'room-living',name:'Living room',type:'living',x:9200,y:1160,w:5575,d:4700,color:0xeeeae4},
          {id:'room-common-bath',name:'Common toilet',type:'bathroom',x:1200,y:5010,w:1750,d:1900,color:0xd9e0df},
          {id:'room-master-bath',name:'Master toilet',type:'bathroom',x:3070,y:5010,w:1750,d:1900,color:0xd9e0df},
          {id:'room-kitchen',name:'Kitchen',type:'kitchen',x:6035,y:6200,w:4420,d:3300,color:0xe3ddd5},
          {id:'room-yard',name:'Service yard',type:'service',x:4615,y:6400,w:1420,d:3100,color:0xd6d0c8},
          {id:'room-entry',name:'Entrance',type:'entry',x:10455,y:7810,w:2100,d:1690,color:0xeae5de},
          {id:'room-shelter',name:'Bomb shelter',type:'shelter',x:12555,y:5860,w:2200,d:1950,color:0xc5c0b8}
        ],
        walls: [
          {id:'wall-north-bed',name:'North bedroom wall',x:0,y:-120,w:6200,d:120,h:2700},
          {id:'wall-north-open',name:'North opened-room wall',x:6200,y:-120,w:3000,d:120,h:2700},
          {id:'wall-north-living',name:'North living wall',x:9200,y:1040,w:5575,d:120,h:2700},
          {id:'wall-west',name:'West bedroom wall',x:-120,y:0,w:120,d:5010,h:2700},
          {id:'wall-east',name:'East external wall',x:14775,y:1040,w:120,d:8460,h:2700},
          {id:'wall-south',name:'South external wall',x:4615,y:9500,w:10280,d:120,h:2700},
          {id:'wall-master-divider',name:'Master divider',x:3090,y:0,w:120,d:5010,h:2700},
          {id:'wall-bed2-divider',name:'Bedroom 2 divider',x:6140,y:0,w:120,d:5010,h:2700},
          {id:'wall-bedroom-south',name:'Bedroom south wall',x:0,y:4950,w:6200,d:120,h:2700},
          {id:'wall-bath-top',name:'Toilet north wall',x:1200,y:5010,w:3620,d:120,h:2700},
          {id:'wall-bath-bottom',name:'Toilet south wall',x:1200,y:6790,w:3620,d:120,h:2700},
          {id:'wall-bath-west',name:'Common toilet west wall',x:1200,y:5010,w:120,d:1900,h:2700},
          {id:'wall-bath-middle',name:'Toilet divider',x:2950,y:5010,w:120,d:1900,h:2700},
          {id:'wall-bath-east',name:'Master toilet east wall',x:4700,y:5010,w:120,d:1900,h:2700},
          {id:'wall-shelter-north',name:'Shelter north wall',x:12555,y:5860,w:2200,d:180,h:2700},
          {id:'wall-shelter-south',name:'Shelter south wall',x:12555,y:7630,w:2200,d:180,h:2700},
          {id:'wall-shelter-west',name:'Shelter entrance wall',x:12555,y:5860,w:180,d:1950,h:2700}
        ],
        openings: [
          {id:'window-master',name:'Master bedroom window',type:'window',wallId:'wall-north-bed',offset:1550,width:2200,height:1200,sill:900},
          {id:'window-bed2',name:'Bedroom 2 window',type:'window',wallId:'wall-north-bed',offset:4650,width:2100,height:1200,sill:900},
          {id:'window-open',name:'Dining window',type:'window',wallId:'wall-north-open',offset:1500,width:2200,height:1200,sill:900},
          {id:'window-living-1',name:'Living window 1',type:'window',wallId:'wall-north-living',offset:1500,width:1700,height:1200,sill:900},
          {id:'window-living-2',name:'Living window 2',type:'window',wallId:'wall-north-living',offset:3700,width:1700,height:1200,sill:900},
          {id:'door-common-bath',name:'Common toilet door',type:'door',wallId:'wall-bath-bottom',offset:900,width:750,height:2100,sill:0,swing:'left'},
          {id:'door-master-bath',name:'Master toilet door',type:'door',wallId:'wall-bath-bottom',offset:2750,width:750,height:2100,sill:0,swing:'right'},
          {id:'door-master',name:'Master bedroom door',type:'door',wallId:'wall-bedroom-south',offset:2450,width:850,height:2100,sill:0,swing:'left'},
          {id:'door-bed2',name:'Bedroom 2 door',type:'door',wallId:'wall-bedroom-south',offset:4750,width:850,height:2100,sill:0,swing:'right'},
          {id:'door-shelter',name:'Bomb shelter door',type:'door',wallId:'wall-shelter-west',offset:1050,width:850,height:2100,sill:0,swing:'left'},
          {id:'door-main',name:'Main entrance door',type:'door',wallId:'wall-south',offset:6200,width:950,height:2200,sill:0,swing:'left'}
        ],
        shell: [
          {id:'kitchen-run',name:'Kitchen cabinets',x:6035,y:7000,w:4420,d:600,h:900,type:'fixed',color:0xb9afa4},
          {id:'kitchen-worktop',name:'Kitchen worktop',x:6035,y:7000,w:4420,d:650,h:920,type:'fixed',color:0x8d8780}
        ],
        clearances: [
          {name:'Entrance route', x:10550, y:6100, w:1900, d:3400},
          {name:'Kitchen working aisle', x:6035, y:6200, w:4420, d:750},
          {name:'Dining north pull-back', x:7000, y:1700, w:2600, d:650},
          {name:'Dining south pull-back', x:7000, y:5100, w:2600, d:650}
        ],
        furniture: [
          {id:'table', name:'Oval dining table', x:7200, y:3200, w:2200, d:1000, h:760, rotation:0, shape:'rounded', color:0xb8aaa0},
          {id:'chair-n1', name:'Dining chair N1', x:7350, y:2450, w:500, d:550, h:820, rotation:0, color:0xd3cbc3},
          {id:'chair-n2', name:'Dining chair N2', x:8050, y:2450, w:500, d:550, h:820, rotation:0, color:0xd3cbc3},
          {id:'chair-n3', name:'Dining chair N3', x:8750, y:2450, w:500, d:550, h:820, rotation:0, color:0xd3cbc3},
          {id:'chair-s1', name:'Dining chair S1', x:7350, y:4450, w:500, d:550, h:820, rotation:180, color:0xd3cbc3},
          {id:'chair-s2', name:'Dining chair S2', x:8050, y:4450, w:500, d:550, h:820, rotation:180, color:0xd3cbc3},
          {id:'chair-s3', name:'Dining chair S3', x:8750, y:4450, w:500, d:550, h:820, rotation:180, color:0xd3cbc3},
          {id:'chair-w', name:'Dining chair W', x:6450, y:3425, w:550, d:500, h:820, rotation:90, color:0xd3cbc3},
          {id:'chair-e', name:'Dining chair E', x:9600, y:3425, w:550, d:500, h:820, rotation:-90, color:0xd3cbc3},
          {id:'sofa', name:'Low sofa', x:10500, y:1400, w:950, d:2600, h:720, rotation:0, color:0xaaa7a3},
          {id:'coffee', name:'Coffee table', x:11850, y:2250, w:1100, d:650, h:340, rotation:0, shape:'rounded', color:0x8e8580},
          {id:'tv', name:'TV console', x:14275, y:1500, w:400, d:2400, h:450, rotation:0, color:0x77736f},
          {id:'hosting', name:'Hosting console', x:10650, y:5000, w:1500, d:400, h:800, rotation:0, color:0x9e948b}
        ],
        settings: {ceilingVisible:false, ceilingHeight:2600},
        camera: null
      };

      const furnitureCatalog = [
        {category:'furniture',name:'Sofa',w:2400,d:950,h:720,color:0xaaa7a3},
        {category:'furniture',name:'Dining table',w:1800,d:900,h:760,shape:'rounded',color:0xb8aaa0},
        {category:'furniture',name:'Dining chair',w:500,d:550,h:820,color:0xd3cbc3},
        {category:'furniture',name:'Lounge chair',w:800,d:850,h:760,color:0xb6aea5},
        {category:'furniture',name:'Coffee table',w:1000,d:600,h:340,shape:'rounded',color:0x8e8580},
        {category:'furniture',name:'Console',w:1500,d:400,h:800,color:0x9e948b},
        {category:'furniture',name:'King bed',w:1930,d:2030,h:550,color:0xc7bfb6},
        {category:'furniture',name:'Queen bed',w:1520,d:2030,h:550,color:0xc7bfb6}
      ];
      const carpentryCatalog = [
        {category:'carpentry',name:'Full-height wardrobe',w:2400,d:600,h:2700,color:0xa99f94},
        {category:'carpentry',name:'Kitchen lower cabinets',w:2400,d:600,h:870,color:0xb7ada2},
        {category:'carpentry',name:'Kitchen upper cabinets',w:2400,d:350,h:750,color:0xc5bbb0},
        {category:'carpentry',name:'Kitchen worktop',w:2400,d:650,h:920,color:0x88837d},
        {category:'carpentry',name:'Settee',w:1600,d:550,h:480,color:0xb4aaa0}
      ];
      const decorativeCatalog = [
        {category:'decorative',name:'Glass-block screen',w:1800,d:120,h:2400,model:'glass-blocks',color:0x8fb9c7},
        {category:'decorative',name:'Potted plant S',w:350,d:350,h:500,model:'plant',plantSize:'S',color:0x71866c},
        {category:'decorative',name:'Potted plant M',w:650,d:650,h:1200,model:'plant',plantSize:'M',color:0x71866c}
      ];
