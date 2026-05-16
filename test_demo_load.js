// test_demo_load.js — programmatic load test for index.html.
// Strategy: parse the inline <script type="module"> block from index.html,
// strip the Three.js import (mock it instead), execute the rest in a vm
// sandbox with all the UMD modules pre-loaded as window.GTA*. Any error
// thrown during initialization fails the test.
//
// This catches the same JS errors the browser would surface, so we never
// have to ask the user "did the demo load?" again.
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = __dirname;

// 1. Mock Three.js — we don't actually render, just need the API surface
//    used during init (no animation frames are run).
function makeThreeMock() {
  const noop = () => {};
  const Vec3 = function (x, y, z) { this.x = x || 0; this.y = y || 0; this.z = z || 0; };
  Vec3.prototype.set = function (x, y, z) { this.x = x; this.y = y; this.z = z; return this; };
  Vec3.prototype.copy = function (v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; };
  Vec3.prototype.clone = function () { return new Vec3(this.x, this.y, this.z); };
  Vec3.prototype.add = function (v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; };
  Vec3.prototype.lookAt = noop;
  function Color(c) { this.value = c; }
  Color.prototype.setHSL = noop; Color.prototype.setRGB = noop; Color.prototype.set = noop;
  function Group() { this.position = new Vec3(); this.rotation = new Vec3(); this.children = [];
    this.add = function (c) { this.children.push(c); return this; }; this.castShadow = false;
    this.visible = true; this.userData = {}; }
  function Mesh(geo, mat) { this.position = new Vec3(); this.rotation = new Vec3();
    this.scale = new Vec3(1, 1, 1); this.material = mat || {}; this.geometry = geo;
    this.castShadow = false; this.receiveShadow = false; this.userData = {};
    this.add = noop; this.visible = true; }
  function Geo() {} function Mat(opts) { Object.assign(this, opts || {}); this.color = new Color(0); }
  function Scene() { this.children = []; this.background = null; this.fog = null;
    this.add = function (c) { this.children.push(c); return this; }; }
  function PerspectiveCamera() { this.position = new Vec3(); this.aspect = 1;
    this.updateProjectionMatrix = noop; this.lookAt = noop; }
  function Renderer() { this.domElement = {
    addEventListener: noop, requestPointerLock: noop,
  }; this.setPixelRatio = noop; this.setSize = noop; this.shadowMap = {};
    this.render = noop; }
  function CanvasTexture() { this.repeat = { set: noop }; this.wrapS = 0; this.wrapT = 0; }
  function ShaderMat(opts) { Object.assign(this, opts || {}); }
  return {
    Scene, PerspectiveCamera, WebGLRenderer: Renderer, Mesh, Group,
    BoxGeometry: Geo, PlaneGeometry: Geo, SphereGeometry: Geo,
    CapsuleGeometry: Geo, CylinderGeometry: Geo,
    MeshStandardMaterial: Mat, MeshBasicMaterial: Mat, ShaderMaterial: ShaderMat,
    HemisphereLight: function () { return new Group(); },
    DirectionalLight: function () { const g = new Group();
      g.shadow = { mapSize: { set: noop }, camera: {} }; return g; },
    GridHelper: function () { return new Group(); },
    Color, Vector3: Vec3, Fog: function () { return { color: new Color(0) }; },
    CanvasTexture, RepeatWrapping: 1000, BackSide: 1,
    PCFSoftShadowMap: 1,
  };
}

// 2. Mock document/window/canvas
function makeDocumentMock() {
  function makeEl(tag) {
    return {
      tagName: tag, innerHTML: "", textContent: "", value: "",
      dataset: {}, src: "",
      classList: { add: () => {}, remove: () => {}, contains: () => false, toggle: () => {} },
      appendChild: () => {}, addEventListener: () => {}, requestPointerLock: () => {},
      querySelector: () => makeEl("div"),
      querySelectorAll: () => [],
      closest: () => null,
      style: {}, getContext: () => ({
        clearRect: () => {}, fillRect: () => {}, beginPath: () => {}, moveTo: () => {},
        lineTo: () => {}, stroke: () => {}, fill: () => {}, arc: () => {}, ellipse: () => {},
        fillText: () => {}, set fillStyle(v) {}, set strokeStyle(v) {}, set lineWidth(v) {},
        set font(v) {},
      }),
      width: 256, height: 256,
    };
  }
  return {
    createElement: makeEl,
    body: { appendChild: () => {} },
    getElementById: (id) => makeEl("div"),
    querySelector: () => makeEl("div"),
    querySelectorAll: () => [],
    addEventListener: () => {},
  };
}

// 3. Build the sandbox window with the 5DEngine modules attached.
function loadModule(filename, sandbox) {
  const src = fs.readFileSync(path.join(ROOT, filename), "utf8");
  vm.runInContext(src, sandbox);
}

function run() {
  const errors = [];
  const sandbox = {
    self: {}, window: null, document: makeDocumentMock(),
    performance: { now: () => 0 },
    Math, Date, JSON, Array, Object, Map, Set, Number, String, Boolean,
    Error, Promise, setTimeout: () => {}, setInterval: () => {},
    requestAnimationFrame: (fn) => 0,
    addEventListener: () => {}, console,
  };
  sandbox.window = sandbox;     // typical browser global
  sandbox.window.GTAEngine = sandbox.GTAEngine;
  vm.createContext(sandbox);

  const order = [
    "engine_browser.js", "engine_bridge.js", "physics.js",
    "entity.js", "registry.js", "inventory.js", "guns.js", "health.js",
  ];
  try {
    for (const m of order) loadModule(m, sandbox);
  } catch (e) {
    errors.push(`UMD load error in ${m}: ${e.message}`);
  }

  // Re-link self → window so the inline module sees them
  for (const k of Object.keys(sandbox.self)) sandbox[k] = sandbox.self[k];

  // Inject Three.js mock as the global "THREE" + provide an `import THREE`
  // shim by extracting the module body.
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const m = html.match(/<script type="module">([\s\S]*?)<\/script>/);
  if (!m) { console.error("no module block found"); process.exit(1); }
  let modSrc = m[1];

  // Strip the import statement and replace with `const THREE = ...`
  modSrc = modSrc.replace(/import\s+\*\s+as\s+THREE\s+from\s+["']three["'];?/, "");
  const THREE = makeThreeMock();
  sandbox.THREE = THREE;
  sandbox.innerWidth = 1280; sandbox.innerHeight = 800;
  sandbox.devicePixelRatio = 1;

  // Wrap so we can capture init-time errors
  const wrapped = "try { " + modSrc + " } catch (__e__) { console.error('MODULE INIT THREW:', __e__.message, __e__.stack); throw __e__; }";

  try {
    vm.runInContext(wrapped, sandbox);
  } catch (e) {
    errors.push(`module init error: ${e.message}`);
  }

  if (errors.length === 0) {
    console.log("ok  - demo module loaded without errors");
    console.log(`\n1 passed, 0 failed`);
    process.exit(0);
  } else {
    for (const e of errors) console.log("FAIL -", e);
    console.log(`\n0 passed, ${errors.length} failed`);
    process.exit(1);
  }
}

run();
