// test_iter_136.js — world-builder serialization + module surface.
const B = require("./builder.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

ok(typeof B.createBuilder === "function", "createBuilder exported");
ok(typeof B.serializeMesh === "function", "serializeMesh exported");
ok(typeof B.STORAGE_KEY === "string" && B.STORAGE_KEY.length > 0, "STORAGE_KEY exported");

// serializeMesh — pure function, can be tested without THREE
const fakeMesh = {
  uuid: "test-uuid-1",
  position: { x: 5, y: 1.5, z: -3 },
  rotation: { x: 0, y: 1.57, z: 0 },
  scale: { x: 2, y: 2, z: 2 },
};
const spec = B.serializeMesh(fakeMesh, { id: "tree_1", assetUrl: "tree.glb", assetExt: "glb" });
ok(spec.id === "tree_1", "id preserved");
ok(spec.assetUrl === "tree.glb", "assetUrl preserved");
ok(spec.assetExt === "glb", "assetExt preserved");
ok(spec.px === 5 && spec.py === 1.5 && spec.pz === -3, "position serialized");
ok(spec.ry === 1.57, "rotation Y serialized");
ok(spec.sx === 2, "scale X serialized");

// Fallback to UUID if no meta
const spec2 = B.serializeMesh(fakeMesh);
ok(spec2.id === "test-uuid-1", "uuid fallback id");
ok(spec2.assetUrl === null, "null assetUrl when no meta");

// createBuilder error path
let threw = false;
try { B.createBuilder({}); } catch (_) { threw = true; }
ok(threw, "createBuilder throws without required deps");

// Mock just enough THREE + scene + camera + domEl to validate the
// builder API surface (no real picking)
const fakeTHREE = {
  Box3: function () { this.setFromObject = () => this; this.getSize = (v) => { v.x=1;v.y=1;v.z=1; }; this.getCenter = (v) => { v.x=0;v.y=0;v.z=0; }; },
  Vector3: function (x, y, z) { this.x=x||0; this.y=y||0; this.z=z||0;
    this.set = (a,b,c) => { this.x=a; this.y=b; this.z=c; };
    this.copy = (o) => { this.x=o.x; this.y=o.y; this.z=o.z; };
    this.multiplyScalar = (s) => { this.x*=s; this.y*=s; this.z*=s; return this; }; },
  Vector2: function (x, y) { this.x=x||0; this.y=y||0; },
  BoxGeometry: function () { this.dispose = () => {}; },
  EdgesGeometry: function () { return { dispose: () => {} }; },
  LineBasicMaterial: function () { this.dispose = () => {}; },
  LineSegments: function (g, m) {
    this.geometry = g; this.material = m;
    this.position = { x:0,y:0,z:0, copy: (o) => { this.position.x=o.x; this.position.y=o.y; this.position.z=o.z; }, set: (a,b,c) => { this.position.x=a;this.position.y=b;this.position.z=c; } };
  },
  Raycaster: function () {
    this.setFromCamera = () => {};
    this.intersectObjects = () => [];
  },
};
const fakeScene = { add: () => {}, remove: () => {} };
const fakeCam = {};
const fakeDom = { addEventListener: () => {} };

const builder = B.createBuilder({
  THREE: fakeTHREE, scene: fakeScene, camera: fakeCam, domEl: fakeDom,
});
ok(builder.isActive() === false, "starts inactive");
builder.setActive(true);
ok(builder.isActive() === true, "setActive(true) flips");
builder.setActive(false);
ok(builder.isActive() === false, "setActive(false) flips back");

ok(builder.managedCount() === 0, "no managed meshes initially");

// add() returns the mesh
const m = { position: new fakeTHREE.Vector3(0,0,0), rotation: { x:0,y:0,z:0 }, scale: new fakeTHREE.Vector3(1,1,1), uuid: "x" };
const added = builder.add(m, { assetUrl: "x.obj" });
ok(added === m, "add returns mesh");
ok(builder.managedCount() === 1, "managed count incremented");

// select + delete
builder.select(m);
ok(builder.getSelected() === m, "select works");
builder.clearSelection();
ok(builder.getSelected() === null, "clear works");
builder.select(m);
const del = builder.deleteSelected();
ok(del === true, "delete returns true");
ok(builder.managedCount() === 0, "managed empty after delete");
ok(builder.getSelected() === null, "selection cleared after delete");

// translate / rotate / scale don't throw when nothing selected
builder.translate(1, 0, 0);
builder.rotateY(0.1);
builder.scaleBy(2);
ok(true, "no-op transforms don't throw");

// loadState returns null when localStorage empty/unavailable
const ls = builder.loadState();
ok(ls === null || Array.isArray(ls), "loadState returns null or array");
builder.clearState();
ok(true, "clearState doesn't throw");

// ---- iter 137 additions: inspector + drag API ----
ok(typeof builder.setPosition === "function", "setPosition exported");
ok(typeof builder.setRotation === "function", "setRotation exported");
ok(typeof builder.setScale === "function", "setScale exported");
ok(typeof builder.getTransform === "function", "getTransform exported");
ok(typeof builder.spawnPrimitive === "function", "spawnPrimitive exported");
ok(typeof builder.dragStart === "function", "dragStart exported");
ok(typeof builder.dragMove === "function", "dragMove exported");
ok(typeof builder.dragEnd === "function", "dragEnd exported");
ok(typeof builder.isDragging === "function", "isDragging exported");

// dragStart/End without selection is safe
ok(builder.dragStart() === false, "dragStart without selection false");
builder.dragEnd();   // shouldn't throw
ok(builder.isDragging() === false, "isDragging false after end");

// getTransform with nothing selected
ok(builder.getTransform() === null, "getTransform null without selection");

// setPosition without selection
ok(builder.setPosition(1,2,3) === false, "setPosition false without selection");

// Add a mesh, select, then transform via setters
const m2 = { position: new fakeTHREE.Vector3(0,0,0), rotation: { x:0,y:0,z:0 }, scale: new fakeTHREE.Vector3(1,1,1), uuid: "y" };
builder.add(m2, { primitive: "cube" });
builder.select(m2);
ok(builder.setPosition(5, 2, -1), "setPosition true with selection");
ok(m2.position.x === 5 && m2.position.y === 2 && m2.position.z === -1, "position written");
builder.setRotation(0, 1.5, 0);
ok(m2.rotation.y === 1.5, "rotation Y written");
builder.setScale(2, 2, 2);
ok(m2.scale.x === 2, "scale X written");

const t = builder.getTransform();
ok(t.meta.primitive === "cube", "meta.primitive preserved");
ok(t.pos.x === 5 && t.pos.y === 2, "transform pos");
ok(t.scale.y === 2, "transform scale");

// ---- iter 138: clone + color + intensity API surface ----
ok(typeof builder.cloneSelected === "function", "cloneSelected exported");
ok(typeof builder.getColor === "function", "getColor exported");
ok(typeof builder.setColor === "function", "setColor exported");
ok(typeof builder.getIntensity === "function", "getIntensity exported");
ok(typeof builder.setIntensity === "function", "setIntensity exported");

// getColor on a mesh without traverse method returns null safely
ok(builder.getColor() === null || builder.getColor() === null, "getColor safe with mock mesh");

// setColor without selection → false
builder.clearSelection();
ok(builder.setColor("#ff0000") === false, "setColor without selection false");
ok(builder.cloneSelected() === null, "cloneSelected without selection null");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
