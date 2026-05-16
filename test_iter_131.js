// test_iter_131.js — camera_spine 4 zones + screen_mesh interactive surfaces.
const CS = require("./camera_spine.js");
const SM = require("./screen_mesh.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

// =====================================================================
// CAMERA SPINE
// =====================================================================
ok(Array.isArray(CS.ZONES) && CS.ZONES.length === 4, "4 zones exported");
ok(CS.ZONES[0] === "INSIDE", "first zone INSIDE");
ok(CS.ZONES[3] === "BIRD_VIEW", "last zone BIRD_VIEW");

// Zone assignment by zoom
ok(CS.evaluate(0.0).zone === "INSIDE", "0.0 → INSIDE");
ok(CS.evaluate(0.05).zone === "INSIDE", "0.05 → INSIDE");
ok(CS.evaluate(0.20).zone === "FIRST_PERSON", "0.20 → FIRST_PERSON");
ok(CS.evaluate(0.45).zone === "THIRD_PERSON", "0.45 → THIRD_PERSON");
ok(CS.evaluate(0.80).zone === "BIRD_VIEW", "0.80 → BIRD_VIEW");
ok(CS.evaluate(1.0).zone === "BIRD_VIEW", "1.0 → BIRD_VIEW");

// Clamping
ok(CS.evaluate(-0.5).zone === "INSIDE", "negative clamps to INSIDE");
ok(CS.evaluate(2.0).zone === "BIRD_VIEW", "above 1 clamps to BIRD_VIEW");

// localT progresses through zone (boundary belongs to UPPER zone; check just inside)
const fp_start = CS.evaluate(0.12);
const fp_end   = CS.evaluate(0.299);
ok(fp_start.zone === "FIRST_PERSON" && fp_start.localT < 0.05,
   `FP start localT ≈ 0 (zone=${fp_start.zone}, t=${fp_start.localT.toFixed(2)})`);
ok(fp_end.zone === "FIRST_PERSON" && fp_end.localT > 0.95,
   `FP end localT ≈ 1 (zone=${fp_end.zone}, t=${fp_end.localT.toFixed(2)})`);

// Hero visibility
ok(CS.evaluate(0.0).params.heroVisible === false, "INSIDE: hero invisible");
ok(CS.evaluate(0.2).params.heroVisible === false, "FP: hero invisible");
ok(CS.evaluate(0.5).params.heroVisible === true,  "TP: hero visible");
ok(CS.evaluate(0.8).params.heroVisible === true,  "BIRD: hero visible");

// Shooting allowed only in FP/TP (not INSIDE, not BIRD)
ok(CS.evaluate(0.0).params.allowShooting === false, "INSIDE: no shooting");
ok(CS.evaluate(0.2).params.allowShooting === true,  "FP: shooting OK");
ok(CS.evaluate(0.5).params.allowShooting === true,  "TP: shooting OK");
ok(CS.evaluate(0.8).params.allowShooting === false, "BIRD: no shooting");

// Input mode
ok(CS.evaluate(0.0).params.inputMode === "look",  "INSIDE: look");
ok(CS.evaluate(0.2).params.inputMode === "fps",   "FP: fps");
ok(CS.evaluate(0.5).params.inputMode === "orbit", "TP: orbit");
ok(CS.evaluate(0.8).params.inputMode === "fly",   "BIRD: fly");

// distance scales by camDistMax
const r10 = CS.evaluate(0.5, { camDistMax: 10 });
const r20 = CS.evaluate(0.5, { camDistMax: 20 });
ok(Math.abs(r20.params.distance - 2 * r10.params.distance) < 0.001,
   `distance scales linearly with camDistMax`);

// zoomForZone snaps
ok(CS.zoomForZone("FIRST_PERSON") > 0.12 && CS.zoomForZone("FIRST_PERSON") < 0.30,
   "zoomForZone FP centered in band");
ok(CS.zoomForZone("nonsense") === null, "zoomForZone unknown returns null");

// lerpZoom converges
let z = 0.5;
for (let i = 0; i < 60; i++) z = CS.lerpZoom(z, 0.2, 1/60, 6);
ok(Math.abs(z - 0.2) < 0.05, `lerpZoom converges to target (z=${z.toFixed(3)})`);

// BIRD_VIEW climbs into sky
ok(CS.evaluate(0.95).params.heightOffset > 5, "BIRD heightOffset > 5");
ok(CS.evaluate(0.6).params.heightOffset < 5,  "TP/BIRD edge heightOffset < 5");

// Custom bounds
const custom = CS.evaluate(0.5, {
  bounds: {
    INSIDE: [0, 0.5],
    FIRST_PERSON: [0.5, 0.7],
    THIRD_PERSON: [0.7, 0.85],
    BIRD_VIEW: [0.85, 1.0],
  },
});
ok(custom.zone === "INSIDE" || custom.zone === "FIRST_PERSON",
   "custom bounds honored (0.5 lands at boundary)");

// =====================================================================
// SCREEN MESH
// =====================================================================
const s1 = SM.createScreen({ resolutionW: 256, resolutionH: 128 });
ok(s1.id && s1.id.length > 0, "screen has id");
ok(s1.resolutionW === 256, "resolutionW set");
ok(s1.hitRegions.length === 0, "no default regions");

// Hit-test with regions
const s2 = SM.createScreen({
  id: "test_screen",
  resolutionW: 100, resolutionH: 100,
  hitRegions: [
    { id: "btn_a", x: 0,  y: 0,   w: 50, h: 50 },
    { id: "btn_b", x: 50, y: 50,  w: 50, h: 50 },
  ],
});

// UV (0,0) is BOTTOM-LEFT in three.js — so canvas y=100 → hit btn_a if it covers top
// UV (0.1, 0.1) → px=10, py = (1-0.1)*100 = 90 → btn_b (50..100, 50..100)
const hitA = SM.hitTest(s2, { x: 0.1, y: 0.9 });    // canvas (10, 10)
const hitB = SM.hitTest(s2, { x: 0.7, y: 0.3 });    // canvas (70, 70)
const hitNone = SM.hitTest(s2, { x: 0.7, y: 0.9 }); // canvas (70, 10) - no region
ok(hitA && hitA.id === "btn_a", `hitA correct (got ${hitA && hitA.id})`);
ok(hitB && hitB.id === "btn_b", `hitB correct (got ${hitB && hitB.id})`);
ok(hitNone === null, "no region → null");

// hitTest robust to bad UV
ok(SM.hitTest(s2, null) === null, "null uv → null");

// SIZE_PRESETS
ok(SM.SIZE_PRESETS.jumbotron.widthM > 10, "jumbotron is large");
ok(SM.SIZE_PRESETS.colossal.widthM > 100, "colossal is huge");
ok(SM.SIZE_PRESETS.small.widthM < 2, "small is small");

// setFrame doesn't crash without canvas
const s3 = SM.createScreen({});
SM.setFrame(s3, ["line 1", "line 2"]);
ok(s3.frame.length === 2, "setFrame stores lines");

// setRegions
SM.setRegions(s3, [{ id: "x", x: 0, y: 0, w: 1, h: 1 }]);
ok(s3.hitRegions.length === 1, "setRegions replaces");

// setState merges
SM.setState(s3, { cursor: { x: 5, y: 5 } });
ok(s3.state.cursor.x === 5, "setState merges");
SM.setState(s3, { other: true });
ok(s3.state.cursor.x === 5 && s3.state.other === true, "setState preserves prior");

// Custom paint function called via update — fake canvas
const calls = [];
const fakeCtx = {
  fillStyle: null, font: null, fillRect: () => calls.push("fillRect"),
  fillText: (t) => calls.push("fillText:" + t), strokeRect: () => calls.push("strokeRect"),
};
const s4 = SM.createScreen({ paint: (ctx, sc) => { ctx.fillText("hello " + sc.id); } });
s4.canvas = { getContext: () => fakeCtx };
SM.update(s4);
ok(calls.some(c => c.indexOf("hello") >= 0), "custom paint called");

// update with frame uses terminal paint
const calls2 = [];
const fakeCtx2 = {
  fillStyle: null, font: null, fillRect: () => calls2.push("fillRect"),
  fillText: (t) => calls2.push(t), strokeRect: () => calls2.push("strokeRect"),
};
const s5 = SM.createScreen({ frame: ["AAA", "BBB"] });
s5.canvas = { getContext: () => fakeCtx2 };
SM.update(s5);
ok(calls2.indexOf("AAA") >= 0 && calls2.indexOf("BBB") >= 0, "frame lines painted");

// Hit regions overlay in debug mode
const calls3 = [];
const fakeCtx3 = {
  fillStyle: null, font: null, strokeStyle: null, lineWidth: 0,
  fillRect: () => {}, fillText: () => {}, strokeRect: () => calls3.push("stroke"),
};
const s6 = SM.createScreen({ hitRegions: [{ id: "x", x: 0, y: 0, w: 10, h: 10 }] });
s6.canvas = { getContext: () => fakeCtx3 };
SM.setState(s6, { showHitRegions: true });
SM.update(s6);
ok(calls3.length === 1, "debug overlay strokes one region");

// Dirty flag
ok(s6.dirty === true, "update marks dirty");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
