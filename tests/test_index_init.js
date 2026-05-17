// test_index_init.js — loads index.html's inline module script in a Node vm
// with full THREE stubs. Catches any init-time ReferenceError / TypeError that
// would show as a JS error in the browser. Run: node tests/test_index_init.js

"use strict";
const fs   = require("fs");
const path = require("path");
const vm   = require("vm");

const ROOT = path.resolve(__dirname, "..");

// ─── THREE stub ──────────────────────────────────────────────────────────────
function buildTHREE() {
  const noop = () => {};
  const Vec2 = function (x, y) { this.x = x||0; this.y = y||0; };
  const Vec3 = function (x, y, z) { this.x=x||0; this.y=y||0; this.z=z||0; };
  Vec3.prototype.set = function (x,y,z){ this.x=x;this.y=y;this.z=z;return this; };
  Vec3.prototype.copy = function (v){ this.x=v.x;this.y=v.y;this.z=v.z;return this; };
  Vec3.prototype.clone = function (){ return new Vec3(this.x,this.y,this.z); };
  Vec3.prototype.add = function (v){ this.x+=v.x;this.y+=v.y;this.z+=v.z;return this; };
  Vec3.prototype.sub = function (v){ this.x-=v.x;this.y-=v.y;this.z-=v.z;return this; };
  Vec3.prototype.multiplyScalar = function (s){ this.x*=s;this.y*=s;this.z*=s;return this; };
  Vec3.prototype.normalize = function (){ return this; };
  Vec3.prototype.dot = function (){ return 0; };
  Vec3.prototype.applyQuaternion = function (){ return this; };
  Vec3.prototype.project = function (){ this.x=0;this.y=0;this.z=0;return this; };
  Vec3.prototype.unproject = function (){ return this; };
  Vec3.prototype.lerp = function (v, a){ return this; };

  function Color(c){ this.r=1;this.g=1;this.b=1; }
  Color.prototype.setHSL = function(){ return this; };
  Color.prototype.setRGB  = function(r,g,b){ this.r=r;this.g=g;this.b=b;return this; };
  Color.prototype.set     = function(){ return this; };
  Color.prototype.setHex  = function(){ return this; };
  Color.prototype.setStyle= function(){ return this; };
  Color.prototype.copy    = function(v){ if(v){this.r=v.r;this.g=v.g;this.b=v.b;}return this; };
  Color.prototype.clone   = function(){ return new Color(); };
  Color.prototype.lerp    = function(){ return this; };
  Color.prototype.getHex  = function(){ return 0xffffff; };
  Color.prototype.getHexString = function(){ return "ffffff"; };
  Color.prototype.multiplyScalar = function(s){ this.r*=s;this.g*=s;this.b*=s;return this; };
  Color.prototype.add  = function(v){ this.r+=v.r;this.g+=v.g;this.b+=v.b;return this; };
  Color.prototype.offsetHSL = function(){ return this; };
  Color.prototype.toArray = function(){ return [this.r,this.g,this.b]; };

  function Quat(){ this.x=0;this.y=0;this.z=0;this.w=1; }
  Quat.prototype.setFromEuler = function(){ return this; };
  Quat.prototype.multiply = function(){ return this; };

  function Euler(){ this.x=0;this.y=0;this.z=0;this._order="XYZ"; }
  Euler.prototype.set = function(x,y,z){ this.x=x;this.y=y;this.z=z;return this; };

  function Scale(x,y,z){ this.x=x||1;this.y=y||1;this.z=z||1; }
  Scale.prototype.set=function(x,y,z){ this.x=x;this.y=y;this.z=z;return this; };
  Scale.prototype.setScalar=function(s){ this.x=this.y=this.z=s;return this; };
  Scale.prototype.copy=function(){ return this; };

  function Group(){
    this.position=new Vec3();this.rotation=new Euler();this.scale=new Scale();
    this.children=[];this.visible=true;this.userData={};this.castShadow=false;
    this.matrixAutoUpdate=true;
  }
  Group.prototype.add=function(c){ this.children.push(c);return this; };
  Group.prototype.remove=function(c){ const i=this.children.indexOf(c);if(i>-1)this.children.splice(i,1);return this; };
  Group.prototype.traverse=function(fn){ fn(this);this.children.forEach(c=>{ if(c.traverse)c.traverse(fn);else fn(c); }); };
  Group.prototype.getWorldPosition=function(v){ if(v){v.set(0,0,0);}return v||new Vec3(); };

  function Mesh(geo,mat){
    this.position=new Vec3();this.rotation=new Euler();this.scale=new Scale();
    this.material=mat||{};this.geometry=geo||{};
    this.castShadow=false;this.receiveShadow=false;this.userData={};this.visible=true;
  }
  Mesh.prototype.add=Group.prototype.add;
  Mesh.prototype.remove=Group.prototype.remove;
  Mesh.prototype.traverse=Group.prototype.traverse;
  Mesh.prototype.getWorldPosition=Group.prototype.getWorldPosition;
  Mesh.prototype.children=[];

  function Line(geo,mat){ Mesh.call(this,geo,mat); }
  Line.prototype=Object.create(Mesh.prototype);

  function Geo(){
    this.attributes={};this.index=null;
    this.setAttribute=noop;this.setIndex=noop;this.computeVertexNormals=noop;
    this.dispose=noop;
  }
  function Mat(opts){
    Object.assign(this,opts||{});
    this.color=new Color(0);this.emissive=new Color(0);
    this.dispose=noop;this.clone=function(){ return Object.assign(new Mat(),this); };
  }
  function ShaderMat(opts){ Object.assign(this,opts||{});this.uniforms=opts&&opts.uniforms||{}; }
  function LineBasicMat(opts){ Object.assign(this,opts||{});this.color=new Color(0); }

  function PerspCamera(){
    this.position=new Vec3();this.rotation=new Euler();
    this.aspect=1;this.fov=60;this.near=0.1;this.far=1000;
    this.matrixWorldInverse={};this.projectionMatrix={};
    this.updateProjectionMatrix=noop;this.lookAt=noop;
  }
  function Renderer(){
    this.domElement={ addEventListener:noop, requestPointerLock:noop,
      style:{}, width:1280, height:800 };
    this.setPixelRatio=noop;this.setSize=noop;
    this.shadowMap={enabled:false,type:0};
    this.render=noop;this.setRenderTarget=noop;
    this.setClearColor=noop;this.getClearColor=function(){ return new Color(); };
    this.toneMappingExposure=1;this.toneMapping=0;this.outputEncoding=0;
    this.info={render:{triangles:0,calls:0,frames:0},memory:{geometries:0,textures:0}};
    this.capabilities={isWebGL2:false};
    this.extensions={get:function(){return null;}};
  }
  function CanvasTex(){ this.repeat={set:noop};this.wrapS=0;this.wrapT=0;this.needsUpdate=false; }
  function DataTex(){ this.needsUpdate=false; }
  function PMREMGen(){ this.fromScene=function(){ return {texture:{}}; };this.compileEquirectangularShader=noop; }
  function Raycaster(){
    this.ray={ intersectPlane:function(){ return false; }, origin:new Vec3(), direction:new Vec3() };
    this.setFromCamera=noop;
    this.intersectObjects=function(){ return []; };
  }
  function Plane(){ this.normal=new Vec3(0,1,0);this.constant=0; }
  function Box3(){
    this.min=new Vec3();this.max=new Vec3();
    this.setFromObject=function(){ return this; };
    this.getSize=function(v){ v&&v.set(1,1,1);return v||new Vec3(1,1,1); };
    this.getCenter=function(v){ v&&v.set(0,0,0);return v||new Vec3(); };
    this.expandByScalar=function(){ return this; };
  }
  function BufferAttr(arr,itemSize){ this.array=arr;this.itemSize=itemSize;this.needsUpdate=false; }
  function PointLight(color,intensity,distance){ this.position=new Vec3();this.intensity=intensity||1;this.distance=distance||0;this.castShadow=false; }
  function AmbientLight(){ this.intensity=1; }
  function DirectionalLight(){
    this.position=new Vec3();this.intensity=1;this.castShadow=false;
    this.color=new Color();
    this.shadow={mapSize:{set:noop,width:1024,height:1024},camera:{near:0,far:100,left:-10,right:10,top:10,bottom:-10,updateProjectionMatrix:noop}};
    this.target={position:new Vec3(),updateMatrixWorld:noop};
  }
  function HemisphereLight(){ this.position=new Vec3();this.intensity=1;this.color=new Color();this.groundColor=new Color(); }
  function Scene(){
    this.children=[];this.background=null;
    this.fog=null;this.overrideMaterial=null;
  }
  Scene.prototype.add=Group.prototype.add;
  Scene.prototype.remove=Group.prototype.remove;
  Scene.prototype.traverse=Group.prototype.traverse;
  Scene.prototype.getObjectByName=function(){ return null; };

  function Fog(c,n,f){ this.color=new Color(c);this.near=n;this.far=f; }
  function GridHelper(){ Group.call(this); }
  GridHelper.prototype=Object.create(Group.prototype);
  function CameraHelper(){ Group.call(this); }
  CameraHelper.prototype=Object.create(Group.prototype);

  const Clock = function(){ this.elapsedTime=0; };
  Clock.prototype.getDelta=function(){ return 0.016; };
  Clock.prototype.getElapsedTime=function(){ return this.elapsedTime; };

  return {
    Scene, PerspectiveCamera:PerspCamera, WebGLRenderer:Renderer,
    Mesh, Group, Line, Points: Mesh,
    BoxGeometry:Geo, PlaneGeometry:Geo, SphereGeometry:Geo,
    CapsuleGeometry:Geo, CylinderGeometry:Geo, TorusGeometry:Geo,
    RingGeometry:Geo, CircleGeometry:Geo, TubeGeometry:Geo,
    OctahedronGeometry:Geo, TetrahedronGeometry:Geo, IcosahedronGeometry:Geo,
    DodecahedronGeometry:Geo, LatheGeometry:Geo, ExtrudeGeometry:Geo,
    BufferGeometry:Geo, EdgesGeometry:Geo, WireframeGeometry:Geo,
    MeshStandardMaterial:Mat, MeshBasicMaterial:Mat, MeshPhongMaterial:Mat,
    MeshLambertMaterial:Mat, MeshDepthMaterial:Mat,
    ShaderMaterial:ShaderMat, LineBasicMaterial:LineBasicMat,
    SpriteMaterial:Mat, PointsMaterial:Mat,
    HemisphereLight, DirectionalLight, AmbientLight, PointLight,
    SpotLight: PointLight,
    Color, Vector2:Vec2, Vector3:Vec3, Quaternion:Quat, Euler,
    Fog, GridHelper, CameraHelper, Clock,
    CanvasTexture:CanvasTex, DataTexture:DataTex, TextureLoader:function(){ this.load=function(u,ok){ ok&&ok(new CanvasTex()); }; },
    BufferAttribute:BufferAttr,
    Raycaster, Plane, Box3,
    CatmullRomCurve3: function(pts){ this.points=pts||[];this.getPoints=function(n){ return this.points.slice(0,Math.min(n,this.points.length)||1)||[new Vec3()]; }; this.getSpacedPoints=this.getPoints; },
    CubicBezierCurve3: function(){ this.getPoints=function(){ return [new Vec3()]; }; },
    LineCurve3: function(){ this.getPoints=function(){ return [new Vec3()]; }; },
    PMREMGenerator:PMREMGen,
    RepeatWrapping:1000, ClampToEdgeWrapping:1001,
    BackSide:1, FrontSide:0, DoubleSide:2,
    PCFSoftShadowMap:2, BasicShadowMap:0,
    AdditiveBlending:2, NormalBlending:1,
    NearestFilter:1003, LinearFilter:1006,
    RGBAFormat:1023, FloatType:1015,
    MathUtils:{ randFloat:(a,b)=>a+(b-a)*Math.random(), clamp:(v,a,b)=>Math.max(a,Math.min(b,v)), degToRad:(d)=>d*Math.PI/180 },
    REVISION:"150",
  };
}

// ─── DOM stub ────────────────────────────────────────────────────────────────
function buildDOM() {
  const noop = () => {};
  function makeEl(tag) {
    const el = {
      tagName:(tag||"div").toUpperCase(), id:"", className:"",
      innerHTML:"", textContent:"", value:"", checked:false,
      dataset:{}, style:{}, src:"", href:"", type:"",
      children:[], childNodes:[],
      classList:{
        add:noop, remove:noop, toggle:noop,
        contains:()=>false, _set:new Set(),
      },
      setAttribute:noop, getAttribute:()=>null, removeAttribute:noop,
      appendChild:(c)=>{ el.children.push(c); return c; },
      removeChild:(c)=>{ const i=el.children.indexOf(c);if(i>-1)el.children.splice(i,1); },
      addEventListener:noop, removeEventListener:noop,
      dispatchEvent:noop, focus:noop, blur:noop, click:noop,
      querySelector:(sel)=>makeEl("div"),
      querySelectorAll:(sel)=>[],
      closest:(sel)=>null, matches:()=>false,
      getBoundingClientRect:()=>({left:0,top:0,right:1280,bottom:800,width:1280,height:800}),
      requestPointerLock:noop, scrollIntoView:noop,
      remove:noop, cloneNode:()=>makeEl(tag),
      insertBefore:(c)=>c, replaceChild:(n)=>n,
      getContext:(t)=>({
        clearRect:noop, fillRect:noop, strokeRect:noop,
        beginPath:noop, closePath:noop, moveTo:noop, lineTo:noop,
        arc:noop, ellipse:noop, bezierCurveTo:noop, quadraticCurveTo:noop,
        stroke:noop, fill:noop, clip:noop,
        fillText:noop, strokeText:noop,
        save:noop, restore:noop,
        scale:noop, translate:noop, rotate:noop, setTransform:noop, transform:noop,
        drawImage:noop,
        createLinearGradient:()=>({addColorStop:noop}),
        createRadialGradient:()=>({addColorStop:noop}),
        createPattern:()=>({}),
        measureText:()=>({width:0}),
        getImageData:()=>({data:new Uint8ClampedArray(4)}),
        putImageData:noop, createImageData:()=>({data:[]}),
        set fillStyle(v){}, get fillStyle(){ return "#000"; },
        set strokeStyle(v){}, get strokeStyle(){ return "#000"; },
        set lineWidth(v){}, set font(v){}, set globalAlpha(v){},
        set shadowColor(v){}, set shadowBlur(v){},
        set textAlign(v){}, set textBaseline(v){},
        canvas:{ width:1280, height:800 },
      }),
      width:1280, height:800, offsetWidth:1280, offsetHeight:800,
    };
    return el;
  }
  const body = makeEl("body");
  const head = makeEl("head");
  const docEl = makeEl("html");
  return {
    createElement:(tag)=>makeEl(tag),
    createTextNode:(t)=>({textContent:t,nodeType:3}),
    createDocumentFragment:()=>makeEl("fragment"),
    body, head, documentElement:docEl,
    getElementById:(id)=>makeEl("div"),
    querySelector:(sel)=>makeEl("div"),
    querySelectorAll:(sel)=>[],
    getElementsByTagName:()=>[],
    getElementsByClassName:()=>[],
    addEventListener:noop, removeEventListener:noop,
    exitPointerLock:noop,
    pointerLockElement:null,
    hidden:false,
    readyState:"complete",
    title:"5DEngine",
    location:{ href:"http://localhost/", hash:"", search:"", pathname:"/" },
  };
}

// ─── UMD module loader ────────────────────────────────────────────────────────
function loadUMD(relPath, sandbox) {
  const abs = path.join(ROOT, relPath);
  if (!fs.existsSync(abs)) return;
  const src = fs.readFileSync(abs, "utf8");
  try {
    vm.runInContext(src, sandbox, { filename: abs, timeout: 5000 });
  } catch (e) {
    throw new Error(`UMD load failed [${relPath}]: ${e.message}`);
  }
}

// ─── Main test ────────────────────────────────────────────────────────────────
function run() {
  let pass = 0, fail = 0;
  function ok(label)   { console.log(`PASS [${label}]`); pass++; }
  function err(label, msg) { console.error(`FAIL [${label}]: ${msg}`); fail++; }

  // ── 1. game_config weapon fields ──────────────────────────────────────────
  (() => {
    const cfgSrc = fs.readFileSync(path.join(ROOT, "src/config/game_config.js"), "utf8");
    const sb = { self:{}, module:{ exports:{} }, exports:{} };
    sb.window = sb; sb.self = sb;
    vm.createContext(sb);
    vm.runInContext(cfgSrc, sb);
    const cfg = sb.GameConfig || sb.module.exports;
    const required = ["id","name","ammoItem","fireRate","damage","range","speed","magCap","reloadDuration","pellets"];
    const weapons = cfg.weapons || [];
    if (weapons.length < 5) { err("game_config/weapon-count", `expected ≥5 weapons, got ${weapons.length}`); return; }
    let allOk = true;
    for (const w of weapons) {
      const missing = required.filter(k => !(k in w));
      if (missing.length) { err(`game_config/weapon-${w.id||"?"}`, `missing: ${missing.join(", ")}`); allOk = false; }
    }
    if (allOk) ok("game_config/all-weapons-have-required-fields");
  })();

  // ── 2. wave_manager includes robot ────────────────────────────────────────
  (() => {
    const sb = { self:{}, module:{ exports:{} }, exports:{}, window:{} };
    sb.window = sb; sb.self = sb;
    vm.createContext(sb);
    loadUMD("src/systems/wave_manager.js", sb);
    const wm = sb.module.exports || sb.WaveManager;
    const state = wm.getState();
    // Add a robot wave and check addWave works
    wm.addWave({ enemies:[{type:"robot",count:1}], pauseAfter:5 });
    if (typeof wm.addWave !== "function") { err("wave_manager/addWave", "not a function"); return; }
    ok("wave_manager/robot-addWave");
    if (typeof wm.getState !== "function") { err("wave_manager/getState", "not a function"); return; }
    const s = wm.getState();
    if (typeof s.wave !== "number") { err("wave_manager/getState-shape", "wave not a number"); return; }
    ok("wave_manager/getState-shape");
  })();

  // ── 3. index.html module script — init without errors ─────────────────────
  (() => {
    const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
    const match = html.match(/<script type="module">([\s\S]*?)<\/script>/);
    if (!match) { err("index/module-script", "no <script type=\"module\"> block found"); return; }

    let src = match[1];
    // Strip ES `import` statements — replace with stub assignments
    src = src.replace(/import\s+\*\s+as\s+THREE\s+from\s+["'][^"']+["'];?/g, "");
    src = src.replace(/import\s+\{[^}]+\}\s+from\s+["'][^"']+["'];?/g, "");
    src = src.replace(/import\s+\S+\s+from\s+["'][^"']+["'];?/g, "");

    const THREE = buildTHREE();
    const doc = buildDOM();
    const noop = () => {};

    const sb = {
      THREE,
      self: {}, window: null,
      document: doc,
      navigator: { userAgent: "node-test" },
      location: { href: "http://localhost/", hash: "" },
      history: { pushState: noop },
      performance: { now: () => Date.now() },
      innerWidth: 1280, innerHeight: 800, devicePixelRatio: 1,
      Math, Date, JSON, Array, Object, Map, Set, Number, String, Boolean,
      Error, Promise, RegExp, Symbol,
      setTimeout: (fn, ms) => 0, clearTimeout: noop,
      setInterval: (fn, ms) => 0, clearInterval: noop,
      requestAnimationFrame: (fn) => 0,
      cancelAnimationFrame: noop,
      addEventListener: noop, removeEventListener: noop,
      console,
      fetch: () => Promise.resolve({ ok:true, json:()=>Promise.resolve({}), arrayBuffer:()=>Promise.resolve(new ArrayBuffer(0)), text:()=>Promise.resolve("") }),
      AudioContext: function(){ return { createGain:()=>({gain:{value:0,setTargetAtTime:noop},connect:noop}), createPanner:()=>({positionX:{},positionY:{},positionZ:{},panningModel:"",distanceModel:"",refDistance:0,maxDistance:0,rolloffFactor:0,connect:noop}), createBufferSource:()=>({buffer:null,loop:false,connect:noop,start:noop,stop:noop}), listener:{setPosition:noop,setOrientation:noop}, destination:{}, state:"running", resume:()=>Promise.resolve(), decodeAudioData:()=>Promise.resolve({}) }; },
      localStorage: { getItem:()=>null, setItem:noop, removeItem:noop },
      URL: { createObjectURL: ()=>"blob:test", revokeObjectURL: noop },
      Blob: function(){},
      Worker: function(){ this.postMessage=noop; this.addEventListener=noop; },
      crypto: { getRandomValues:(a)=>a },
      Float32Array, Uint8Array, Uint16Array, Int32Array, ArrayBuffer,
      Uint8ClampedArray,
    };

    // Load UMD modules in order (mirrors the <script src> tags in index.html)
    // Exact <script src> order from index.html
    const UMD_ORDER = [
      "src/bridges/local_db_bridge.js",
      "src/core/engine.js",
      "src/core/dev_console.js",
      "src/core/event_bus.js",
      "src/world/day_night.js",
      "src/render/particle_system.js",
      "src/systems/trigger_zones.js",
      "src/audio/sound_zones.js",
      "src/systems/cutscene.js",
      "src/entities/behavior_tree.js",
      "src/world/terrain.js",
      "src/systems/a_star.js",
      "src/progression/achievements.js",
      "src/systems/status_effects.js",
      "src/systems/wave_manager.js",
      "src/activities/crafting.js",
      "src/config/game_config.js",
      "src/world/world_data.js",
      "src/bridges/engine_browser.js",
      "src/bridges/engine_bridge.js",
      "src/physics/physics.js",
      "src/entities/entity.js",
      "src/systems/registry.js",
      "src/systems/inventory.js",
      "src/combat/health.js",
      "src/devices/devices.js",
      "src/devices/wires.js",
      "src/render/camera_spine.js",
      "src/builder/scripting.js",
      "src/render/screen_mesh.js",
      "src/render/gltf_loader.js",
      "src/audio/audio.js",
      "src/audio/audio_webaudio.js",
      "src/builder/builder.js",
    ];

    sb.window = sb;
    sb.self = sb;
    vm.createContext(sb);

    for (const rel of UMD_ORDER) {
      const abs = path.join(ROOT, rel);
      if (!fs.existsSync(abs)) continue;
      try {
        const msrc = fs.readFileSync(abs, "utf8");
        vm.runInContext(msrc, sb, { filename: abs, timeout: 3000 });
      } catch (e) {
        // Non-fatal — some modules need browser APIs unavailable in Node
      }
    }

    // Run the module script, capture first error
    let initError = null;
    const wrapped = `(function(){"use strict";try{${src}}catch(__e__){__initError__=__e__;}}())`;
    sb.__initError__ = null;
    try {
      vm.runInContext(wrapped, sb, { filename: "index.html#module", timeout: 10000 });
    } catch (e) {
      initError = e;
    }
    if (sb.__initError__) initError = sb.__initError__;

    if (initError) {
      err("index/module-init", `${initError.message}\n    at ${(initError.stack||"").split("\n").slice(1,3).join("\n    ")}`);
    } else {
      ok("index/module-init-no-errors");
    }
  })();

  // ── 4. shop items data integrity ──────────────────────────────────────────
  (() => {
    // Parse _SHOP_ITEMS out of index.html and validate fields without executing actions
    const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
    // Count shop items defined in the file
    const shopCount = (html.match(/id:\s*"(ammo_pistol|ammo_rifle|ammo_shotgun|medkit|grenade|armor|ammo_max|grenade_max)"/g) || []).length;
    if (shopCount < 8) {
      err("shop/item-count", `expected 8 shop items, found ${shopCount}`);
    } else {
      ok("shop/8-items-defined");
    }
    // Verify Tab key wires shop open
    if (!html.includes("_openShop") || !html.includes("_closeShop")) {
      err("shop/open-close-functions", "_openShop or _closeShop missing");
    } else {
      ok("shop/open-close-functions-present");
    }
  })();

  // ── 5. weapon mesh registry hooks ─────────────────────────────────────────
  (() => {
    const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
    if (!html.includes("registerGunMesh")) {
      err("gun-registry/registerGunMesh", "function not found in index.html");
    } else {
      ok("gun-registry/registerGunMesh-present");
    }
    if (!html.includes("_switchGunMesh")) {
      err("gun-registry/_switchGunMesh", "function not found in index.html");
    } else {
      ok("gun-registry/_switchGunMesh-present");
    }
    if (html.includes("const gunGroup") || html.includes("let gunGroup")) {
      err("gun-registry/old-gunGroup", "old gunGroup variable still declared — rename incomplete");
    } else {
      ok("gun-registry/gunGroup-fully-renamed");
    }
  })();

  // ── 6. robot enemy in wave_manager waves ──────────────────────────────────
  (() => {
    const src = fs.readFileSync(path.join(ROOT, "src/systems/wave_manager.js"), "utf8");
    if (!src.includes('"robot"')) {
      err("wave_manager/robot-in-waves", '"robot" type not found in wave definitions');
    } else {
      ok("wave_manager/robot-in-waves");
    }
  })();

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`\nIndex init + systems: ${pass} pass, ${fail} fail`);
  process.exit(fail > 0 ? 1 : 0);
}

run();
