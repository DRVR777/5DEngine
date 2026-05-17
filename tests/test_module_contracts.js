// test_module_contracts.js — verifies every src/ module can be required and
// exposes its expected API surface (no missing exports, no syntax errors).
// Run: node tests/test_module_contracts.js
// This runs in Node, so DOM/THREE stubs are injected for modules that need them.

const fs   = require("fs");
const path = require("path");
const vm   = require("vm");

// ---- Minimal browser/THREE stubs ----
const _fakeEl = {
  style: {}, innerHTML: "", appendChild() {}, remove() {},
  addEventListener() {}, removeEventListener() {},
  classList: { contains() { return false; }, add() {}, remove() {}, toggle() {} },
  getContext() { return { clearRect(){}, save(){}, restore(){}, beginPath(){}, arc(){},
    clip(){}, fillRect(){}, strokeRect(){}, fillText(){}, stroke(){}, fill(){},
    moveTo(){}, lineTo(){}, createRadialGradient(){ return { addColorStop(){} }; },
    measureText(){ return { width: 0 }; }, scale(){}, translate(){}, rotate(){},
    drawImage(){}, getImageData(){ return { data: [] }; }, putImageData(){} }; },
};
const global_stubs = {
  window: {},
  self: {},
  document: {
    createElement() { return { ..._fakeEl, style: {}, setAttribute(){} }; },
    getElementById() { return _fakeEl; },
    querySelector()  { return _fakeEl; },
    body: { appendChild() {}, removeChild() {} },
    addEventListener() {},
  },
  navigator: { userAgent: "node-test" },
  localStorage: { getItem(){ return null; }, setItem(){} },
  performance: { now(){ return Date.now(); } },
  requestAnimationFrame() {},
  AudioContext: function() { return { createGain(){ return { gain: { value:0, setTargetAtTime(){} }, connect(){} }; }, createPanner(){ return { positionX:{}, positionY:{}, positionZ:{}, panningModel:"",  distanceModel:"", refDistance:0, maxDistance:0, rolloffFactor:0, connect(){} }; }, createBufferSource(){ return { buffer:null, loop:false, connect(){}, start(){}, stop(){} }; }, listener: { setPosition(){}, setOrientation(){} }, destination: {}, state: "running", resume(){ return Promise.resolve(); }, decodeAudioData(){ return Promise.resolve({}); } }; },
  fetch(){ return Promise.resolve({ ok: true, arrayBuffer(){ return Promise.resolve(new ArrayBuffer(0)); }, json(){ return Promise.resolve({}); } }); },
  Promise,
  console,
  Math,
  Date,
  JSON,
  Error,
  Array,
  Object,
  Map,
  Set,
  Float32Array,
  Uint8Array,
  ArrayBuffer,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
};
global_stubs.window = global_stubs;

// Expected API surfaces: module_name → [exported function/property names]
const CONTRACTS = {
  "src/core/event_bus.js":           ["on", "once", "off", "emit", "emitAsync", "clear", "EVENTS"],
  "src/world/terrain.js":            ["generate", "getHeightAt", "setVisible", "dispose"],
  "src/systems/a_star.js":           ["build", "findPath", "isWalkable", "getGrid", "debugDraw", "clearDebug"],
  "src/progression/achievements.js": ["define", "unlock", "isUnlocked", "getAll", "reset", "showPanel", "tick", "wireEventBus"],
  "src/systems/status_effects.js":   ["define", "apply", "remove", "clear", "tick", "getActive", "getStat"],
  "src/activities/crafting.js":      ["define", "canCraft", "craft", "getAll", "showPanel", "setCraftingBenches"],
  "src/entities/behavior_tree.js":   ["run", "makeEnemyTree"],
  "src/render/particle_system.js":   ["init", "emit", "tick"],
  "src/systems/trigger_zones.js":    ["init", "addBox", "addSphere", "remove", "tick"],
  "src/audio/sound_zones.js":        ["addZone", "tick"],
  "src/systems/cutscene.js":         ["define", "play", "stop", "isPlaying", "tick"],
  "src/core/engine.js":              ["register", "get", "has", "list", "time", "debug", "addCommand", "runCommand"],
  "src/core/dev_console.js":         ["init", "print", "toggle"],
  "src/world/day_night.js":          ["init", "tick", "setHour", "getHour", "pause"],
  "src/systems/wave_manager.js":     ["init", "start", "stop", "reset", "tick", "getState", "addWave"],
};

const ROOT = path.resolve(__dirname, "..");
let pass = 0, fail = 0;

for (const [rel, keys] of Object.entries(CONTRACTS)) {
  const filePath = path.join(ROOT, rel);
  if (!fs.existsSync(filePath)) {
    console.error(`FAIL [${rel}]: file not found`);
    fail++;
    continue;
  }

  let src;
  try { src = fs.readFileSync(filePath, "utf8"); } catch (e) {
    console.error(`FAIL [${rel}]: read error — ${e.message}`);
    fail++;
    continue;
  }

  // Run the UMD module in a sandbox with stubs; capture the export
  const sandbox = { ...global_stubs, module: { exports: {} }, exports: {} };
  try {
    vm.runInNewContext(src, sandbox, { filename: filePath, timeout: 3000 });
  } catch (e) {
    console.error(`FAIL [${rel}]: runtime error — ${e.message}`);
    fail++;
    continue;
  }

  // UMD modules set root.ModuleName = factory(), where root = self/window
  // After running, the result is on sandbox.window or sandbox.module.exports
  const exported = sandbox.module.exports && Object.keys(sandbox.module.exports).length > 0
    ? sandbox.module.exports
    : (() => {
        // Try to find it on window by guessing the export name from the filename
        const name = path.basename(filePath, ".js")
          .split("_").map(w => w[0].toUpperCase() + w.slice(1)).join("");
        return sandbox[name] || sandbox.window[name] || null;
      })();

  if (!exported || typeof exported !== "object") {
    console.error(`FAIL [${rel}]: no exported object found`);
    fail++;
    continue;
  }

  const missing = keys.filter(k => !(k in exported));
  if (missing.length) {
    console.error(`FAIL [${rel}]: missing exports: ${missing.join(", ")}`);
    fail++;
  } else {
    console.log(`PASS [${rel}]`);
    pass++;
  }
}

console.log(`\nModule contract check: ${pass} pass, ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
