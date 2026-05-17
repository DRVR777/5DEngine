// test_iter_133.js — GLTF manifest parsing + screen click round-trip via
// integration with screen_mesh + devices bus.
const fs = require("fs");
const path = require("path");
const GA = require("./gltf_loader.js");
const SM = require("./screen_mesh.js");
const D  = require("./devices.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

// =====================================================================
// 1. GLTF manifest parsing
// =====================================================================
const goodManifest = JSON.stringify({
  slots: {
    pistol: { path: "weapons/pistol.glb", scale: 2.5, mountTo: "armR", offset: [0, -0.7, 0.2] },
    coin:   { path: "props/coin.glb" },
  },
});
const r1 = GA.parseManifest(goodManifest);
ok(r1.ok, "parse OK");
ok(r1.specs.size === 2, "2 slots parsed");
ok(r1.specs.get("pistol").scale === 2.5, "pistol scale preserved");
ok(r1.specs.get("pistol").mountTo === "armR", "mountTo preserved");
ok(r1.specs.get("pistol").offset[1] === -0.7, "offset preserved");
ok(r1.specs.get("coin").scale === 1.0, "missing scale defaults to 1.0");
ok(r1.specs.get("coin").offset[0] === 0, "missing offset defaults to [0,0,0]");

// Bad json
ok(GA.parseManifest("{").ok === false, "bad JSON rejected");
ok(GA.parseManifest("[]").ok === false, "non-object rejected");
ok(GA.parseManifest('{"foo":1}').ok === false, "missing .slots rejected");
ok(GA.parseManifest('{"slots":{}}').ok === true, "empty slots accepted");

// Entries without `path` are dropped
const skipNoPath = GA.parseManifest('{"slots":{"x":{"scale":1},"y":{"path":"y.glb"}}}');
ok(skipNoPath.ok && skipNoPath.specs.size === 1, "path-less slot dropped");

// Real on-disk manifest matches expectations
const manifestPath = path.join(__dirname, "assets", "manifest.json");
const realManifest = fs.readFileSync(manifestPath, "utf8");
const realParsed = GA.parseManifest(realManifest);
ok(realParsed.ok, "real manifest parses");
ok(realParsed.specs.has("pistol"), "real manifest has pistol slot");
ok(realParsed.specs.has("car"),    "real manifest has car slot");
ok(realParsed.specs.has("monitor"),"real manifest has monitor slot");
ok(realParsed.specs.has("usb"),    "real manifest has usb slot");
ok(realParsed.specs.has("cd"),     "real manifest has cd slot");
ok(realParsed.specs.size >= 10,    "real manifest has 10+ slots");

// Module surface
ok(typeof GA.load === "function", "load() exported");
ok(typeof GA.getMesh === "function", "getMesh() exported");
ok(typeof GA.onSlotReady === "function", "onSlotReady() exported");
ok(typeof GA.replacePlaceholder === "function", "replacePlaceholder() exported");
ok(typeof GA.stats === "function", "stats() exported");
ok(typeof GA.formatFor === "function", "formatFor() exported");

// Format dispatch by extension
ok(GA.formatFor("foo.glb")  === "glb", "glb detected");
ok(GA.formatFor("foo.GLB")  === "glb", "GLB case-insensitive");
ok(GA.formatFor("foo.gltf") === "glb", "gltf maps to glb loader");
ok(GA.formatFor("foo.obj")  === "obj", "obj detected");
ok(GA.formatFor("foo.fbx")  === "fbx", "fbx detected");
ok(GA.formatFor("subdir/path/thing.OBJ") === "obj", "nested path obj detected");
ok(GA.formatFor("no_ext")   === null,  "no extension → null");
ok(GA.formatFor("foo.dae")  === null,  "unsupported ext → null");
ok(GA.formatFor(null)       === null,  "null → null");
ok(GA.formatFor(undefined)  === null,  "undefined → null");
ok(GA.formatFor("")         === null,  "empty string → null");

// =====================================================================
// 2. Screen click round-trip — bus + screen + region.onClick.
// Models the in-world flow: aim at jumbotron, hit a region, region's
// onClick mutates game state (here: deviceBus.send → packet at remote).
// =====================================================================
const bus = D.createBus();
bus.makeRadio({ id: "radioA", position: { u: 0, v: 0 }, frequency: 100,
  txRange: 100, rxRange: 100 });
bus.makeRadio({ id: "radioB", position: { u: 10, v: 0 }, frequency: 100,
  txRange: 100, rxRange: 100 });

let gameScore = 0;
const screen = SM.createScreen({
  id: "jumbo_test",
  resolutionW: 100, resolutionH: 100,
  state: { hypeClicks: 0 },
  hitRegions: [
    { id: "btn_hype",  x: 10, y: 10, w: 30, h: 30,
      onClick: (sc) => { sc.state.hypeClicks++; } },
    { id: "btn_radio", x: 50, y: 10, w: 30, h: 30,
      onClick: (sc) => { bus.send("radioA", "rf", { kind: "audio", payload: { msg: "test" } }); } },
    { id: "btn_coin",  x: 10, y: 50, w: 30, h: 30,
      onClick: (sc) => { gameScore++; } },
  ],
});

// Simulate ray-hit at the HYPE button center (UV)
// Canvas (25, 25) → UV (0.25, 1 - 0.25) = (0.25, 0.75)
const hypeUV = { x: 0.25, y: 0.75 };
const hypeRegion = SM.hitTest(screen, hypeUV);
ok(hypeRegion && hypeRegion.id === "btn_hype", "hype region found via UV");
hypeRegion.onClick(screen);
ok(screen.state.hypeClicks === 1, "hype click counted");
hypeRegion.onClick(screen);
ok(screen.state.hypeClicks === 2, "hype click counted twice");

// Radio button — fires a packet at radioA
const radioUV = { x: 0.65, y: 0.75 };
const radioRegion = SM.hitTest(screen, radioUV);
ok(radioRegion && radioRegion.id === "btn_radio", "radio region found");
radioRegion.onClick(screen);
ok(bus.peek("radioB", "rf").length === 1, "radioB received the broadcast");

// Coin button increments game state
const coinUV = { x: 0.25, y: 0.35 };
const coinRegion = SM.hitTest(screen, coinUV);
ok(coinRegion && coinRegion.id === "btn_coin", "coin region found");
coinRegion.onClick(screen);
ok(gameScore === 1, "coin click → score++");

// Miss (no region under UV)
const missUV = { x: 0.95, y: 0.95 };
ok(SM.hitTest(screen, missUV) === null, "miss returns null");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
