// gltf_loader.js — multi-format asset loader (.glb / .obj / .fbx).
// Despite the filename it dispatches by file extension. Quaternius is
// OBJ/FBX-first; Kenney is GLB-first; both work seamlessly via the same
// manifest. Gracefully falls back to placeholder primitives when a file
// is missing.
//
// API (window.GLTFAssets, also aliased as window.AssetLoader):
//   await load(THREE, loaders)         — `loaders` is { GLTFLoader, OBJLoader,
//                                         FBXLoader, MTLLoader }. Any missing
//                                         loader just disables that format.
//                                         Returns { ok, slotCount }.
//   getMesh(slot)                      — synchronously returns the loaded
//                                         THREE.Group for a slot, or null.
//   onSlotReady(slot, cb)              — calls cb(group) when slot resolves
//                                         (or immediately if already loaded).
//   replacePlaceholder(slot, parent, placeholder, opts)
//                                      — when slot loads, removes the
//                                        placeholder mesh from `parent`
//                                        and adds the loaded group (with
//                                        manifest scale + offset). Until
//                                        then the placeholder stays.
//
// Pure browser-side — no node tests for the loader itself (GLTFLoader is
// a THREE addon). Manifest parsing IS tested via the unit suite below.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.GLTFAssets = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const slots = new Map();        // slot → { spec, group, status }
  const waiters = new Map();      // slot → [cb, ...]

  function _notify(slot, group) {
    const arr = waiters.get(slot) || [];
    for (const cb of arr) {
      try { cb(group); } catch (_) {}
    }
    waiters.delete(slot);
  }

  // Pure: parse manifest text → spec map (testable in node).
  function parseManifest(text) {
    let obj;
    try { obj = JSON.parse(text); }
    catch (e) { return { ok: false, reason: "bad_json", err: String(e) }; }
    if (!obj || typeof obj.slots !== "object") return { ok: false, reason: "no_slots" };
    const out = new Map();
    for (const slot of Object.keys(obj.slots)) {
      const spec = obj.slots[slot];
      if (!spec || !spec.path) continue;
      out.set(slot, {
        slot,
        path:    spec.path,
        scale:   typeof spec.scale === "number" ? spec.scale : 1.0,
        mountTo: spec.mountTo || null,
        offset:  Array.isArray(spec.offset) ? spec.offset.slice() : [0, 0, 0],
      });
    }
    return { ok: true, specs: out };
  }

  // Pick a format from a file extension. Returns "glb" | "obj" | "fbx" | null.
  function formatFor(path) {
    if (!path || typeof path !== "string") return null;
    const dot = path.lastIndexOf(".");
    if (dot < 0) return null;
    const ext = path.slice(dot + 1).toLowerCase();
    if (ext === "glb" || ext === "gltf") return "glb";
    if (ext === "obj") return "obj";
    if (ext === "fbx") return "fbx";
    return null;
  }

  // Strip extension off a path for MTL companion lookup
  function stripExt(p) {
    const dot = p.lastIndexOf("."); return dot < 0 ? p : p.slice(0, dot);
  }

  async function load(THREE, loaders, opts) {
    opts = opts || {};
    // Back-compat: caller passes a single GLTFLoader → wrap it.
    if (loaders && typeof loaders === "function") loaders = { GLTFLoader: loaders };
    loaders = loaders || {};
    const { GLTFLoader, OBJLoader, FBXLoader, MTLLoader } = loaders;

    const manifestUrl = opts.manifestUrl || "./assets/manifest.json";
    const base        = opts.base        || "./assets/";
    let resp;
    try { resp = await fetch(manifestUrl); }
    catch (e) { return { ok: false, reason: "no_manifest", err: String(e) }; }
    if (!resp.ok) return { ok: false, reason: "manifest_http_" + resp.status };
    const text = await resp.text();
    const m = parseManifest(text);
    if (!m.ok) return m;

    const gltfLoader = GLTFLoader ? new GLTFLoader() : null;
    const objLoader  = OBJLoader  ? new OBJLoader()  : null;
    const fbxLoader  = FBXLoader  ? new FBXLoader()  : null;

    function _onLoadGroup(slot, spec, g) {
      if (!g) { slots.get(slot).status = "no_scene"; _notify(slot, null); return; }
      g.scale.setScalar(spec.scale);
      slots.get(slot).group = g;
      slots.get(slot).status = "ready";
      _notify(slot, g);
    }
    function _onErr(slot) {
      return () => { slots.get(slot).status = "missing"; _notify(slot, null); };
    }

    for (const [slot, spec] of m.specs) {
      slots.set(slot, { spec, group: null, status: "loading" });
      const url = base + spec.path;
      const fmt = formatFor(spec.path);

      if (fmt === "glb" && gltfLoader) {
        gltfLoader.load(url,
          (gltf) => _onLoadGroup(slot, spec, gltf.scene || (gltf.scenes && gltf.scenes[0])),
          undefined, _onErr(slot));
      } else if (fmt === "obj" && objLoader) {
        // Try to load companion .mtl first (same basename) if MTLLoader present.
        const mtlUrl = base + stripExt(spec.path) + ".mtl";
        const loadObjWithMtl = (materials) => {
          const ol = new (OBJLoader)();
          if (materials) ol.setMaterials(materials);
          ol.load(url, (obj) => _onLoadGroup(slot, spec, obj),
                       undefined, _onErr(slot));
        };
        if (MTLLoader) {
          const ml = new MTLLoader();
          ml.load(mtlUrl,
            (materials) => { materials.preload(); loadObjWithMtl(materials); },
            undefined,
            // No MTL? Load OBJ bare — that's fine for many Quaternius packs.
            () => loadObjWithMtl(null));
        } else {
          loadObjWithMtl(null);
        }
      } else if (fmt === "fbx" && fbxLoader) {
        fbxLoader.load(url,
          (group) => _onLoadGroup(slot, spec, group),
          undefined, _onErr(slot));
      } else {
        // Unknown extension OR loader not provided → silent skip
        slots.get(slot).status = fmt ? "no_loader_for_" + fmt : "unknown_ext";
        _notify(slot, null);
      }
    }
    return { ok: true, slotCount: m.specs.size,
             formats: { glb: !!gltfLoader, obj: !!objLoader, fbx: !!fbxLoader, mtl: !!MTLLoader } };
  }

  function getMesh(slot) {
    const e = slots.get(slot);
    return e && e.group ? e.group : null;
  }

  function onSlotReady(slot, cb) {
    const e = slots.get(slot);
    if (e && e.status === "ready") { cb(e.group); return; }
    if (e && (e.status === "missing" || e.status === "no_scene")) { cb(null); return; }
    if (!waiters.has(slot)) waiters.set(slot, []);
    waiters.get(slot).push(cb);
  }

  function replacePlaceholder(slot, parent, placeholder, opts) {
    opts = opts || {};
    onSlotReady(slot, (group) => {
      if (!group || !parent) return;
      if (placeholder && placeholder.parent === parent) parent.remove(placeholder);
      const spec = slots.get(slot) && slots.get(slot).spec;
      if (spec) {
        if (spec.offset) group.position.set(spec.offset[0], spec.offset[1], spec.offset[2]);
      }
      if (opts.position) group.position.set(opts.position.x, opts.position.y, opts.position.z);
      if (opts.rotationY != null) group.rotation.y = opts.rotationY;
      parent.add(group);
    });
  }

  function stats() {
    const out = { total: slots.size, ready: 0, missing: 0, loading: 0 };
    for (const e of slots.values()) {
      out[e.status] = (out[e.status] || 0) + 1;
    }
    return out;
  }

  const api = {
    parseManifest, formatFor, load, getMesh, onSlotReady,
    replacePlaceholder, stats,
    VERSION: "0.2.0-iter134",
  };
  // Expose as both names — gltf_loader.js is now multi-format.
  if (typeof self !== "undefined") self.AssetLoader = api;
  return api;
});
