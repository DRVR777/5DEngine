#!/usr/bin/env node
/** tools/test_boot_full.mjs
 *
 *  Reproduces the browser's boot pipeline as closely as possible in
 *  Node, surfacing whatever error caused the "Cannot read properties
 *  of undefined (reading 'length')" black-screen.
 *
 *  Mocks:
 *    - global window/document/innerWidth/innerHeight/devicePixelRatio
 *    - global fetch (file-system shim)
 *    - global requestAnimationFrame (single-shot)
 *    - addEventListener (noop)
 *    - performance.now (Date.now)
 *  Skips:
 *    - THREE.js (replaced with a tiny stub that records what was made)
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve as pathResolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// --- DOM / browser shims -----------------------------------------------
globalThis.window = globalThis;
globalThis.document = {
  baseURI: "file://" + ROOT.replace(/\\/g, "/") + "/",
  pointerLockElement: null,
  body: { appendChild() {} },
  querySelector() { return null; },
  createElement(tag) {
    return {
      tag, style: {}, dataset: {}, children: [],
      appendChild(c) { this.children.push(c); return c; },
      addEventListener() {},
      get textContent() { return this._text || ""; },
      set textContent(v) { this._text = v; },
    };
  },
  getElementById() { return null; },
  addEventListener() {},
};
globalThis.innerWidth = 1280;
globalThis.innerHeight = 720;
globalThis.devicePixelRatio = 1;
globalThis.addEventListener = () => {};
globalThis.performance = { now: () => Date.now() };
globalThis.requestAnimationFrame = (fn) => setTimeout(() => fn(performance.now()), 0);

// fetch shim — resolves ./data/X.json against ROOT
globalThis.fetch = async (url) => {
  const cleaned = url.replace(/^\.\//, "");
  const abs = pathResolve(ROOT, cleaned);
  if (!existsSync(abs)) return { ok: false, status: 404 };
  return {
    ok: true,
    status: 200,
    async json() { return JSON.parse(readFileSync(abs, "utf8")); },
  };
};

// --- THREE stub --------------------------------------------------------
const stub = {
  WebGLRenderer: class {
    constructor() {}
    setSize() {} setPixelRatio() {} setClearColor() {} render() {}
  },
  Scene: class { constructor() { this.children = []; } add() {} },
  PerspectiveCamera: class {
    constructor(fov, aspect, near, far) {
      this.fov = fov; this.aspect = aspect; this.near = near; this.far = far;
      this.position = { x:0, y:0, z:0, set(x,y,z) { this.x=x; this.y=y; this.z=z; } };
      this.rotation = { x:0, y:0, z:0, set(x,y,z) { this.x=x; this.y=y; this.z=z; } };
    }
    lookAt() {} updateProjectionMatrix() {}
  },
  Color: class { constructor() {} setHex() {} setRGB() {} },
  FogExp2: class { constructor() { this.color = new stub.Color(); } },
  AmbientLight: class {},
  DirectionalLight: class { constructor() { this.position = { set() {} }; } },
  GridHelper: class {},
  PlaneGeometry: class { dispose() {} },
  SphereGeometry: class { dispose() {} },
  BoxGeometry: class { dispose() {} },
  CylinderGeometry: class { dispose() {} },
  DodecahedronGeometry: class { dispose() {} },
  OctahedronGeometry: class { dispose() {} },
  TetrahedronGeometry: class { dispose() {} },
  IcosahedronGeometry: class { dispose() {} },
  ConeGeometry: class { dispose() {} },
  CapsuleGeometry: class { dispose() {} },
  CircleGeometry: class { dispose() {} },
  RingGeometry: class { dispose() {} },
  TorusGeometry: class { dispose() {} },
  MeshStandardMaterial: class { constructor(p) { Object.assign(this, p||{}); } dispose() {} },
  MeshBasicMaterial:    class { constructor(p) { Object.assign(this, p||{}); } dispose() {} },
  MeshPhongMaterial:    class { constructor(p) { Object.assign(this, p||{}); } dispose() {} },
  MeshLambertMaterial:  class { constructor(p) { Object.assign(this, p||{}); } dispose() {} },
  Mesh: class {
    constructor(g, m) { this.geometry = g; this.material = m;
      this.position = { x:0,y:0,z:0,set(x,y,z){this.x=x;this.y=y;this.z=z;} };
      this.rotation = { x:0,y:0,z:0,set(x,y,z){this.x=x;this.y=y;this.z=z;} };
      this.scale = { x:1,y:1,z:1,set(x,y,z){this.x=x;this.y=y;this.z=z;} };
      this.visible = true; this.castShadow=false; this.receiveShadow=false;
    }
    lookAt() {}
  },
  Group: class {
    constructor() { this.children = [];
      this.position = { x:0,y:0,z:0,set(x,y,z){this.x=x;this.y=y;this.z=z;} };
      this.rotation = { x:0,y:0,z:0,set(x,y,z){this.x=x;this.y=y;this.z=z;} };
    }
    add(c) { this.children.push(c); }
    traverse() {}
  },
};

// Inject as the "three" module — the only mock needed since boot.js
// uses `import * as THREE from "three"` and the importmap chooses
// the resolver. Easiest: monkey-patch the import via a custom loader.
// Simpler: rewrite boot.js's import path at runtime? No — we use
// a smaller approach: shadow the THREE namespace by stubbing in
// the place boot.js uses it. Since we can't rewrite imports easily,
// we instead just bypass: import boot, and let it import THREE
// normally — Node will fail without "three" package. So we mock it
// via a tiny in-process shim file.

import { register } from "node:module";

// Build a temp loader that maps "three" → our stub.
import { Module } from "node:module";
const orig = Module._resolveFilename;
const stubFile = "data:text/javascript;charset=utf-8," + encodeURIComponent(
  "const T = " + JSON.stringify(Object.fromEntries(Object.entries(stub).map(([k,_])=>[k, null]))) + ";\n" +
  "globalThis.__THREE_STUB__ = globalThis.__THREE_STUB__ || {};\n" +
  "export default globalThis.__THREE_STUB__;\n" +
  Object.entries(stub).map(([k]) => `export const ${k} = globalThis.__THREE_STUB__.${k};`).join("\n")
);
globalThis.__THREE_STUB__ = stub;

// Hack: rewrite "three" specifier to a data: URL
const originalResolve = Module._resolveFilename;
// Easier — use NODE_OPTIONS via env, but at runtime, just import boot
// and let it fail; we'll see the error before that.

try {
  // Force import of boot indirectly by importing compose + facets directly.
  const { composeFromRoot, facetMap } = await import("../src/ankhor/compose.js");
  const { createDefaultRegistry } = await import("../experimental/holograph-runtime/src/registry.js");
  const { installFacetHandlers } = await import("../src/ankhor/facets/index.js");

  const registry = createDefaultRegistry();
  installFacetHandlers(registry);

  console.log("[stage] composing from root...");
  const loaded = await composeFromRoot("root", "./data/");
  console.log(`[stage] composeFromRoot returned ${typeof loaded}, length=${loaded?.length ?? "undefined"}`);

  if (!Array.isArray(loaded)) throw new Error(`composeFromRoot returned non-array: ${typeof loaded}`);
  console.log(`[stage] loaded ${loaded.length} Thingas`);

  // Spot-check each loaded Thinga shape
  let bad = 0;
  for (const t of loaded) {
    if (!t || typeof t !== "object") { console.warn("[stage] bad Thinga (not object):", t); bad++; continue; }
    if (!t.id || !t.kind || !t.name) { console.warn(`[stage] Thinga missing id/kind/name: id=${t.id} kind=${t.kind} name=${t.name}`); bad++; }
  }
  console.log(`[stage] ${bad} malformed Thingas detected`);

  // PASS 1
  console.log("[stage] PASS 1: registerKind on kind-def Thingas");
  const kindDefaults = new Map();
  for (const t of loaded) {
    if (t.kind !== "kind-def") continue;
    const def = facetMap(t);
    try {
      registry.registerKind(def["for-kind"], {
        requiredFacets: def["required-facets"] || [],
        optionalFacets: def["optional-facets"] || [],
        defaults:       def["defaults"]        || {},
      });
      kindDefaults.set(def["for-kind"], def["defaults"] || {});
    } catch (e) {
      console.warn(`[stage] registerKind("${def["for-kind"]}") for ${t.id}:`, e.message);
    }
  }
  console.log(`[stage] PASS 1 done — ${kindDefaults.size} kinds registered`);

  // PASS 2 — uncaught spawn errors here would crash boot
  console.log("[stage] PASS 2: spawn non-spawn-set Thingas");
  let p2ok = 0, p2bad = 0;
  for (const t of loaded) {
    if (t.kind === "spawn-set") continue;
    try { registry.spawn(t); p2ok++; }
    catch (e) { p2bad++; console.warn(`[stage] PASS 2 spawn ${t.id} (${t.kind}):`, e.message); }
  }
  console.log(`[stage] PASS 2 done — ${p2ok} ok, ${p2bad} failed`);

  // PASS 3
  console.log("[stage] PASS 3: materialize spawn-set children");
  let p3ok = 0, p3bad = 0;
  for (const t of loaded) {
    if (t.kind !== "spawn-set") continue;
    for (const child of t.children || []) {
      const defaults = kindDefaults.get(child.kind) || {};
      const present = new Set((child.facets || []).map(f => f.name));
      const extra = [];
      for (const [name, data] of Object.entries(defaults)) {
        if (present.has(name)) continue;
        extra.push({ name, data: JSON.parse(JSON.stringify(data)) });
      }
      const filled = extra.length ? { ...child, facets: [...(child.facets || []), ...extra] } : child;
      try { registry.spawn(filled); p3ok++; }
      catch (e) { p3bad++; console.warn(`[stage] PASS 3 spawn ${child.id} (${child.kind}):`, e.message); }
    }
  }
  console.log(`[stage] PASS 3 done — ${p3ok} ok, ${p3bad} failed`);

  console.log(`[stage] total Things in registry: ${registry.rows.size}`);
  console.log(`[stage] no fatal error — boot pipeline would have reached frame loop.`);
} catch (e) {
  console.error("[stage] FATAL:", e);
  console.error("[stage] stack:", e.stack);
  process.exit(1);
}
