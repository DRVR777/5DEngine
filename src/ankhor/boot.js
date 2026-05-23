/**
 * src/ankhor/boot.js — the only wiring module index.html needs.
 *
 * Assembles: ThingRegistry (one Thinga store) + facet handlers + Three.js renderer
 * + tick loop. Knows nothing about game content.
 *
 * Game content arrives as JSON kind definitions in data/kinds/ and as facet
 * handler objects in experimental/holograph-runtime/src/handlers.js. New kinds
 * = new JSON files in data/kinds/ (listed in MANIFEST.json); new behavior =
 * new facet handler object in handlers.js.
 *
 * Specs: docs/codex/specs/{registry-runtime,facet-catalog}.md
 */

import * as THREE                                   from "three";
import { createDefaultRegistry }                    from "registry";
import { installDefaultHandlers }                   from "handlers";

export async function boot({ canvas, kindsDir = "./data/kinds/", onReady } = {}) {
  // ── Registry: starts with every Kind in the enum already registered.
  const registry = createDefaultRegistry();
  installDefaultHandlers(registry);

  // ── Render surface ───────────────────────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0d12);
  scene.fog        = new THREE.FogExp2(0x0b0d12, 0.04);
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const sun = new THREE.DirectionalLight(0xffffff, 0.85); sun.position.set(5, 10, 5); scene.add(sun);

  const cam = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 1000);
  cam.position.set(0, 4, 9); cam.lookAt(0, 0.5, 0);

  addEventListener("resize", () => {
    renderer.setSize(innerWidth, innerHeight);
    cam.aspect = innerWidth / innerHeight;
    cam.updateProjectionMatrix();
  });

  // ── Substrate marker — proves the engine is alive without coupling to game.
  const marker = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1, 0),
    new THREE.MeshStandardMaterial({ color: 0x6699cc, flatShading: true })
  );
  scene.add(marker);
  scene.add(new THREE.GridHelper(40, 40, 0x223344, 0x131820));

  // ── Kind catalog: enrich existing Kind registry from data/kinds/*.json ──
  const loaded = await loadKindCatalog(registry, kindsDir);

  // ── One loop. tick(dt) walks every registered facet handler in priority order.
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    registry.tick(dt);
    marker.rotation.y += dt * 0.6;
    marker.position.y  = 0.5 + Math.sin(now * 0.0015) * 0.15;
    renderer.render(scene, cam);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  if (onReady) onReady({
    registry,
    stats: {
      live:         registry.toJSON().length,
      kindsLoaded:  loaded.length,
      handlers:     registry.handlerRegistry.size,
    }
  });
  return registry;
}

// ── Kind catalog loader (browsers cannot list directories) ───────────────
async function loadKindCatalog(reg, dir) {
  const out = [];
  let manifest;
  try {
    const r = await fetch(`${dir}MANIFEST.json`);
    if (!r.ok) { console.warn(`[ankhor] no MANIFEST at ${dir}`); return out; }
    manifest = await r.json();
  } catch (e) { console.warn("[ankhor] manifest fetch failed:", e); return out; }

  await Promise.all((manifest.files || []).map(async (name) => {
    try {
      const f = await fetch(`${dir}${name}`);
      if (!f.ok) return;
      const def = await f.json();
      try {
        reg.registerKind(def.kind, {
          requiredFacets: def.required_facets || [],
          optionalFacets: def.optional_facets || [],
          defaults:       def.defaults        || {},
          absorbs:        def.absorbs         || [],
        });
        out.push(def.kind);
      } catch (e) { console.warn(`[ankhor] registerKind("${def.kind}"):`, e.message); }
    } catch (e) { console.warn(`[ankhor] load ${name}:`, e); }
  }));
  return out;
}
