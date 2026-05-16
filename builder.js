// builder.js — world-editor mode for 5DEngine.
//
// Press B to toggle. In build mode:
//   * Click a mesh in the world → SELECT it (yellow wireframe outline)
//   * Arrow keys or WASD → translate selection on the ground plane
//   * Page Up/Down → translate up/down
//   * [ and ] → rotate Y
//   * = / - → scale up / down
//   * Delete or Backspace → remove from scene
//   * Drag-and-drop a .glb / .obj / .fbx file from your OS onto the
//     window → AssetLoader parses it, spawns at hero position, makes
//     it selectable.
//
// Scene state (positions, rotations, scales, file paths) is saved to
// localStorage on every mutation and rehydrated on next page load.
//
// This module is pure orchestration — it leans on three.js, the asset
// loader, and a small UI/HUD callback supplied by the caller.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Builder = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const STORAGE_KEY = "dwrld.builder.scene.v1";

  // Pure: serialize a builder-managed mesh to JSON-safe spec.
  function serializeMesh(mesh, meta) {
    meta = meta || {};
    return {
      id:        meta.id || mesh.uuid,
      assetUrl:  meta.assetUrl  || null,
      assetData: meta.assetData || null,    // base64 if loaded from drag-drop
      assetExt:  meta.assetExt  || null,
      px: mesh.position.x, py: mesh.position.y, pz: mesh.position.z,
      rx: mesh.rotation.x, ry: mesh.rotation.y, rz: mesh.rotation.z,
      sx: mesh.scale.x,    sy: mesh.scale.y,    sz: mesh.scale.z,
    };
  }

  function createBuilder(opts) {
    opts = opts || {};
    const THREE   = opts.THREE;
    const scene   = opts.scene;
    const camera  = opts.camera;
    const domEl   = opts.domEl;
    const loaders = opts.loaders || {};     // { GLTFLoader, OBJLoader, FBXLoader, MTLLoader }
    const onChange = opts.onChange || (() => {});  // callback after mutations

    if (!THREE || !scene || !camera || !domEl) {
      throw new Error("builder: missing required THREE/scene/camera/domEl");
    }

    let active = false;
    let selected = null;
    let outline = null;          // wireframe helper
    let gizmoGroup = null;       // 3-axis arrow gizmo
    let gizmoMesh = null;        // which mesh the gizmo belongs to
    const managed = new Map();   // mesh → meta {id, assetUrl, assetData, assetExt}

    // ---------- axis-locked drag + rotation drag ----------
    let axisDragging = false;
    let axisDragAxis = null;
    let axisDragStartPos = null;   // THREE.Vector3 world hit on drag start
    let axisDragStartMeshPos = null;  // mesh.position snapshot
    let axisDragStartRot = null;      // mesh.rotation snapshot (for rotY)
    let axisDragStartNdcX = null;     // NDC x at drag start (for rotY)

    // ---------- undo / redo (command pattern) ----------
    const undoStack = [];
    const redoStack = [];
    const MAX_UNDO  = 100;
    let suppressUndo = false;    // set by undo/redo themselves so they don't recurse

    function _pushOp(undoFn, redoFn, label) {
      if (suppressUndo) return;
      undoStack.push({ undo: undoFn, redo: redoFn, label: label || "edit" });
      if (undoStack.length > MAX_UNDO) undoStack.shift();
      redoStack.length = 0;
    }
    function undo() {
      const op = undoStack.pop();
      if (!op) return false;
      suppressUndo = true;
      try { op.undo(); } finally { suppressUndo = false; }
      redoStack.push(op);
      save();
      return true;
    }
    function redo() {
      const op = redoStack.pop();
      if (!op) return false;
      suppressUndo = true;
      try { op.redo(); } finally { suppressUndo = false; }
      undoStack.push(op);
      save();
      return true;
    }
    function undoDepth() { return undoStack.length; }
    function redoDepth() { return redoStack.length; }

    function _outlineFor(mesh) {
      if (outline) { scene.remove(outline); outline.geometry.dispose(); outline.material.dispose(); outline = null; }
      if (!mesh) { _gizmoFor(null); return; }
      try {
        const box = new THREE.Box3().setFromObject(mesh);
        const size = new THREE.Vector3(); box.getSize(size);
        const center = new THREE.Vector3(); box.getCenter(center);
        const geom = new THREE.BoxGeometry(size.x + 0.1, size.y + 0.1, size.z + 0.1);
        const mat  = new THREE.LineBasicMaterial({ color: 0xffff00 });
        outline = new THREE.LineSegments(new THREE.EdgesGeometry(geom), mat);
        outline.position.copy(center);
        scene.add(outline);
      } catch (e) { /* swallow */ }
      _gizmoFor(mesh);
    }

    function _gizmoFor(mesh) {
      if (gizmoGroup) { scene.remove(gizmoGroup); gizmoGroup = null; gizmoMesh = null; }
      if (!mesh) return;
      try {
        const box = new THREE.Box3().setFromObject(mesh);
        const center = new THREE.Vector3(); box.getCenter(center);
        const size   = new THREE.Vector3(); box.getSize(size);
        const len = Math.max(1.5, size.length() * 0.5 + 0.5);
        gizmoGroup = new THREE.Group();
        gizmoGroup.position.copy(center);
        const origin = new THREE.Vector3(0, 0, 0);
        function _arrow(dir, color, axis) {
          const a = new THREE.ArrowHelper(dir, origin, len, color, len * 0.22, len * 0.13);
          a.userData.gizmoAxis = axis;
          if (a.line)  a.line.userData.gizmoAxis = axis;
          if (a.cone)  a.cone.userData.gizmoAxis = axis;
          return a;
        }
        gizmoGroup.add(_arrow(new THREE.Vector3(1, 0, 0), 0xff2200, "x"));
        gizmoGroup.add(_arrow(new THREE.Vector3(0, 1, 0), 0x22cc00, "y"));
        gizmoGroup.add(_arrow(new THREE.Vector3(0, 0, 1), 0x2244ff, "z"));
        // Y-rotation ring (yellow horizontal torus) — drag left/right to rotate
        if (THREE.TorusGeometry) {
          const rGeom = new THREE.TorusGeometry(len * 0.65, len * 0.035, 8, 32);
          const rMat  = new THREE.MeshBasicMaterial({ color: 0xffee00, side: THREE.DoubleSide });
          const rotRing = new THREE.Mesh(rGeom, rMat);
          rotRing.rotation.x = Math.PI / 2;   // lay flat in XZ plane
          rotRing.userData.gizmoAxis = "rotY";
          gizmoGroup.add(rotRing);
        }
        scene.add(gizmoGroup);
        gizmoMesh = mesh;
      } catch (e) { /* swallow */ }
    }

    function _repositionGizmo() {
      if (!gizmoGroup || !gizmoMesh) return;
      try {
        const box = new THREE.Box3().setFromObject(gizmoMesh);
        const center = new THREE.Vector3(); box.getCenter(center);
        gizmoGroup.position.copy(center);
      } catch (e) {}
    }

    function pickGizmoAxis(ndc) {
      if (!gizmoGroup) return null;
      try {
        const ray = new THREE.Raycaster();
        ray.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), camera);
        const hits = ray.intersectObjects(gizmoGroup.children, true);
        for (const hit of hits) {
          let o = hit.object;
          while (o && !o.userData.gizmoAxis) o = o.parent;
          if (o && o.userData.gizmoAxis) return o.userData.gizmoAxis;
        }
      } catch (e) {}
      return null;
    }

    function _mouseToPlane(ndc) {
      if (!selected) return null;
      try {
        const ray = new THREE.Raycaster();
        ray.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), camera);
        const camDir = new THREE.Vector3();
        camera.getWorldDirection(camDir);
        const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(camDir, selected.position);
        const pt = new THREE.Vector3();
        return ray.ray.intersectPlane(plane, pt) ? pt : null;
      } catch (e) { return null; }
    }

    function startAxisDrag(axis, ndc) {
      if (!selected) return false;
      axisDragging = true;
      axisDragAxis = axis;
      if (axis === "rotY") {
        axisDragStartRot = { x: selected.rotation.x, y: selected.rotation.y, z: selected.rotation.z };
        axisDragStartNdcX = ndc.x;
      } else {
        axisDragStartPos = _mouseToPlane(ndc);
        axisDragStartMeshPos = { x: selected.position.x, y: selected.position.y, z: selected.position.z };
      }
      return true;
    }

    function updateAxisDrag(ndc) {
      if (!axisDragging || !selected) return false;
      if (axisDragAxis === "rotY") {
        const dx = ndc.x - axisDragStartNdcX;
        selected.rotation.y = axisDragStartRot.y + dx * Math.PI * 2;
        _repositionGizmo();
        return true;
      }
      if (!axisDragStartPos) return false;
      const cur = _mouseToPlane(ndc);
      if (!cur) return false;
      const delta = cur.clone().sub(axisDragStartPos);
      const s = axisDragStartMeshPos;
      if (axisDragAxis === "x") selected.position.x = s.x + delta.x;
      else if (axisDragAxis === "y") selected.position.y = s.y + delta.y;
      else if (axisDragAxis === "z") selected.position.z = s.z + delta.z;
      if (outline) outline.position.copy(selected.position);
      _repositionGizmo();
      return true;
    }

    function endAxisDrag() {
      if (!axisDragging) return;
      axisDragging = false;
      if (selected) {
        const mesh = selected;
        if (axisDragAxis === "rotY" && axisDragStartRot) {
          const old = axisDragStartRot;
          const nw  = { x: mesh.rotation.x, y: mesh.rotation.y, z: mesh.rotation.z };
          if (old.y !== nw.y) {
            _pushOp(
              () => { mesh.rotation.y = old.y; save(); },
              () => { mesh.rotation.y = nw.y;  save(); },
              "rotateY"
            );
          }
          save();
        } else if (axisDragStartMeshPos) {
          const old = axisDragStartMeshPos;
          const nw  = { x: mesh.position.x, y: mesh.position.y, z: mesh.position.z };
          if (old.x !== nw.x || old.y !== nw.y || old.z !== nw.z) {
            _pushOp(
              () => { mesh.position.set(old.x, old.y, old.z); if (outline) outline.position.copy(mesh.position); _repositionGizmo(); save(); },
              () => { mesh.position.set(nw.x,  nw.y,  nw.z);  if (outline) outline.position.copy(mesh.position); _repositionGizmo(); save(); },
              "axisDrag"
            );
          }
          save();
        }
      }
      axisDragStartPos = null;
      axisDragStartMeshPos = null;
      axisDragStartRot = null;
      axisDragStartNdcX = null;
    }

    function isAxisDragging() { return axisDragging; }

    function select(mesh) {
      selected = mesh;
      _outlineFor(mesh);
    }
    function clearSelection() { select(null); }

    function deleteSelected() {
      if (!selected) return false;
      const mesh = selected;
      const meta = managed.get(mesh) || {};
      scene.remove(mesh);
      managed.delete(mesh);
      clearSelection();
      save();
      onChange("delete");
      _pushOp(
        () => { managed.set(mesh, meta); scene.add(mesh); select(mesh); save(); onChange("add"); },
        () => { scene.remove(mesh); managed.delete(mesh); if (selected === mesh) clearSelection(); save(); onChange("delete"); },
        "delete"
      );
      return true;
    }

    function translate(dx, dy, dz) {
      if (!selected) return;
      const mesh = selected;
      const old = { x: mesh.position.x, y: mesh.position.y, z: mesh.position.z };
      mesh.position.x += dx; mesh.position.y += dy; mesh.position.z += dz;
      const nw  = { x: mesh.position.x, y: mesh.position.y, z: mesh.position.z };
      if (outline) outline.position.set(mesh.position.x, mesh.position.y, mesh.position.z);
      _repositionGizmo();
      save();
      _pushOp(
        () => { mesh.position.set(old.x, old.y, old.z); if (outline) outline.position.copy(mesh.position); _repositionGizmo(); save(); },
        () => { mesh.position.set(nw.x,  nw.y,  nw.z);  if (outline) outline.position.copy(mesh.position); _repositionGizmo(); save(); },
        "translate"
      );
    }
    function rotateY(d) {
      if (!selected) return;
      const mesh = selected;
      const old = mesh.rotation.y;
      mesh.rotation.y += d;
      const nw = mesh.rotation.y;
      save();
      _pushOp(
        () => { mesh.rotation.y = old; save(); },
        () => { mesh.rotation.y = nw;  save(); },
        "rotateY"
      );
    }
    function scaleBy(f) {
      if (!selected) return;
      const mesh = selected;
      const old = { x: mesh.scale.x, y: mesh.scale.y, z: mesh.scale.z };
      mesh.scale.multiplyScalar(f);
      const nw  = { x: mesh.scale.x, y: mesh.scale.y, z: mesh.scale.z };
      _outlineFor(mesh);
      save();
      _pushOp(
        () => { mesh.scale.set(old.x, old.y, old.z); _outlineFor(mesh); save(); },
        () => { mesh.scale.set(nw.x,  nw.y,  nw.z);  _outlineFor(mesh); save(); },
        "scale"
      );
    }

    function _addManagedMesh(mesh, meta) {
      const m = meta || {};
      managed.set(mesh, m);
      scene.add(mesh);
      save();
      onChange("add");
      _pushOp(
        () => { scene.remove(mesh); managed.delete(mesh); if (selected === mesh) clearSelection(); save(); onChange("delete"); },
        () => { managed.set(mesh, m); scene.add(mesh); save(); onChange("add"); },
        "add"
      );
      return mesh;
    }

    // Pick under a NDC point (e.g. {x: 0, y: 0} = screen center).
    // opts.allScene: also raycast scene.children so world objects become selectable.
    // Non-managed hits are auto-registered with { worldObject: true } so they get
    // a gizmo but are excluded from save/serialization.
    function pickAt(ndc, opts) {
      opts = opts || {};
      const ray = new THREE.Raycaster();
      ray.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), camera);
      const managedArr = Array.from(managed.keys());
      let targets = managedArr;
      if (opts.allScene && scene.children && scene.children.length) {
        const extra = scene.children.filter(c => !managed.has(c));
        targets = managedArr.concat(extra);
      }
      const hits = ray.intersectObjects(targets, true);
      if (!hits.length) return null;
      let m = hits[0].object;
      while (m.parent && !managed.has(m) && m.parent !== scene) m = m.parent;
      if (managed.has(m)) return m;
      if (opts.allScene && m && m.parent === scene && m !== scene) {
        // Auto-register as world object — selectable but not serialized
        managed.set(m, { worldObject: true });
        return m;
      }
      return null;
    }

    function setActive(on) {
      active = !!on;
      if (!active) clearSelection();
    }
    function isActive() { return active; }

    // ---------- persistence ----------
    function save() {
      try {
        if (typeof localStorage !== "undefined") {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(_enrichedSpecsForSave()));
        }
      } catch (_) {}
    }
    function loadState() {
      try {
        if (typeof localStorage === "undefined") return null;
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        return JSON.parse(raw);
      } catch (_) { return null; }
    }
    function clearState() {
      try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
    }

    // Wipe everything currently managed from the scene (used before rehydrate
    // OR when the user hits "Clear scene"). Does NOT clear localStorage.
    function clearScene() {
      for (const mesh of Array.from(managed.keys())) {
        scene.remove(mesh);
      }
      managed.clear();
      clearSelection();
      undoStack.length = 0;
      redoStack.length = 0;
      save();
    }

    // Rebuild the scene from an array of serialized specs. Only PRIMITIVES
    // (cube/sphere/cyl/plane/light) are rehydrated automatically — they're
    // self-contained. Specs with assetUrl/assetExt (drag-dropped files)
    // can't be re-loaded without the source file; they're returned in the
    // result for the caller to handle however it likes.
    function rehydrate(specs) {
      if (!Array.isArray(specs)) return { ok: false, reason: "bad_specs" };
      clearScene();
      let restored = 0, skipped = 0, pendingAssets = 0;
      const skippedSpecs = [];
      suppressUndo = true;
      try {
        for (const s of specs) {
          // ASSET path: bytes were embedded → async-load + add when ready
          if (s.assetData && s.assetExt) {
            pendingAssets++;
            _rehydrateAssetSpec(s).then((added) => {
              if (added) restored++;
            }).catch(() => {});
            continue;
          }
          // Asset URL with no bytes — can't rehydrate (legacy / external file)
          if (s.assetUrl || s.assetExt) { skipped++; skippedSpecs.push(s); continue; }
          const kind = s.primitive || (s.meta && s.meta.primitive);
          if (!kind) { skipped++; continue; }
          const mesh = spawnPrimitive(kind, { x: s.px, y: s.py, z: s.pz });
          if (!mesh) { skipped++; continue; }
          if (isFinite(s.rx)) mesh.rotation.x = s.rx;
          if (isFinite(s.ry)) mesh.rotation.y = s.ry;
          if (isFinite(s.rz)) mesh.rotation.z = s.rz;
          if (isFinite(s.sx)) mesh.scale.set(s.sx, s.sy || s.sx, s.sz || s.sx);
          if (s.color) { try { setColor(s.color); } catch (_) {} }
          restored++;
        }
      } finally {
        suppressUndo = false;
      }
      clearSelection();
      undoStack.length = 0; redoStack.length = 0;
      save();
      return { ok: true, restored, skipped, skippedSpecs, pendingAssets };
    }

    // Rehydrate a single asset-bytes spec asynchronously. Decodes base64,
    // pushes through the right loader, transforms + registers the result.
    async function _rehydrateAssetSpec(s) {
      try {
        const buf = _base64ToArrayBuffer(s.assetData);
        const group = await _loadArrayBuffer(buf, s.assetExt);
        if (!group) return false;
        group.position.set(s.px || 0, s.py || 0, s.pz || 0);
        if (isFinite(s.rx)) group.rotation.x = s.rx;
        if (isFinite(s.ry)) group.rotation.y = s.ry;
        if (isFinite(s.rz)) group.rotation.z = s.rz;
        if (isFinite(s.sx)) group.scale.set(s.sx, s.sy || s.sx, s.sz || s.sx);
        // Register without pushing undo (rehydrate is not a user action)
        suppressUndo = true;
        try {
          managed.set(group, {
            assetUrl: s.assetUrl || null,
            assetExt: s.assetExt || null,
            assetData: s.assetData,
          });
          scene.add(group);
        } finally { suppressUndo = false; }
        save();
        onChange("add");
        return true;
      } catch (e) {
        console.warn("builder: asset rehydrate failed", e);
        return false;
      }
    }

    // Override serializeMesh wrapper to ALSO capture primitive + color
    // + assetData — without these, rehydrate can't reconstruct the mesh.
    function _enrichedSpecsForSave() {
      const out = [];
      for (const [mesh, meta] of managed) {
        if (meta.worldObject) continue;   // scene objects, not builder-placed
        const spec = serializeMesh(mesh, meta);
        spec.primitive = meta.primitive || null;
        // Try to grab the material color if any (single-mesh primitives)
        let colorHex = null;
        if (typeof mesh.traverse === "function") {
          mesh.traverse((o) => {
            if (!colorHex && o.material && o.material.color &&
                typeof o.material.color.getHexString === "function") {
              colorHex = "#" + o.material.color.getHexString();
            }
          });
        }
        if (colorHex) spec.color = colorHex;
        // Drag-dropped asset bytes (base64) so the mesh can round-trip
        if (meta.assetData) spec.assetData = meta.assetData;
        if (meta.assetExt)  spec.assetExt  = meta.assetExt;
        if (meta.assetUrl)  spec.assetUrl  = meta.assetUrl;
        out.push(spec);
      }
      return out;
    }

    // ---------- named scenes (multi-slot localStorage) ----------
    const NAMED_KEY = "dwrld.builder.scenes.named.v1";
    function _readNamedMap() {
      try {
        if (typeof localStorage === "undefined") return {};
        const raw = localStorage.getItem(NAMED_KEY);
        return raw ? JSON.parse(raw) : {};
      } catch (_) { return {}; }
    }
    function _writeNamedMap(m) {
      try { localStorage.setItem(NAMED_KEY, JSON.stringify(m)); } catch (_) {}
    }
    function saveNamed(name) {
      if (!name || typeof name !== "string") return { ok: false, reason: "bad_name" };
      const m = _readNamedMap();
      m[name] = { savedAt: Date.now(), specs: _enrichedSpecsForSave() };
      _writeNamedMap(m);
      return { ok: true, count: m[name].specs.length };
    }
    function loadNamed(name) {
      const m = _readNamedMap();
      if (!m[name]) return { ok: false, reason: "not_found" };
      const r = rehydrate(m[name].specs);
      return Object.assign({ name }, r);
    }
    function deleteNamed(name) {
      const m = _readNamedMap();
      if (!m[name]) return false;
      delete m[name];
      _writeNamedMap(m);
      return true;
    }
    function listNamed() {
      const m = _readNamedMap();
      return Object.keys(m).map(n => ({ name: n, savedAt: m[n].savedAt, count: (m[n].specs || []).length }));
    }

    // ---------- export / import JSON ----------
    function exportSceneJSON() {
      return JSON.stringify({
        version: "0.4.0-iter140",
        savedAt: Date.now(),
        specs: _enrichedSpecsForSave(),
      }, null, 2);
    }
    function importSceneJSON(text) {
      let obj;
      try { obj = JSON.parse(text); }
      catch (e) { return { ok: false, reason: "bad_json" }; }
      if (!obj || !Array.isArray(obj.specs)) return { ok: false, reason: "no_specs" };
      return rehydrate(obj.specs);
    }

    // ---------- drag-and-drop ----------
    function attachDragDrop() {
      window.addEventListener("dragover", (e) => { if (active) e.preventDefault(); });
      window.addEventListener("drop", async (e) => {
        if (!active) return;
        e.preventDefault();
        for (const file of (e.dataTransfer && e.dataTransfer.files) || []) {
          await loadDroppedFile(file);
        }
      });
    }

    async function loadDroppedFile(file, opts2) {
      opts2 = opts2 || {};
      const ext = (file.name.split(".").pop() || "").toLowerCase();
      const buf = await file.arrayBuffer();
      const at = opts2.at || { x: 0, y: 1, z: 0 };
      const group = await _loadArrayBuffer(buf, ext);
      if (!group) return null;
      group.position.set(at.x, at.y, at.z);
      // Stash the raw bytes (as base64) on the meta so save() can embed them.
      // Skip if the file is HUGE (>4MB) — localStorage typically caps ~5MB.
      let assetData = null;
      if (buf.byteLength <= 4 * 1024 * 1024) {
        try { assetData = _arrayBufferToBase64(buf); }
        catch (_) { /* swallow */ }
      } else {
        console.warn("builder: asset", file.name, "is", (buf.byteLength/1024/1024).toFixed(1),
                     "MB — too large to persist; this mesh won't survive reload.");
      }
      _addManagedMesh(group, { assetUrl: file.name, assetExt: ext, assetData });
      select(group);
      return group;
    }

    // Load an ArrayBuffer through the right loader for `ext`.
    function _loadArrayBuffer(buf, ext) {
      const url = URL.createObjectURL(new Blob([buf]));
      return new Promise((resolve) => {
        const done = (g) => { URL.revokeObjectURL(url); resolve(g); };
        try {
          if ((ext === "glb" || ext === "gltf") && loaders.GLTFLoader) {
            new loaders.GLTFLoader().load(url,
              (gltf) => done(gltf.scene || (gltf.scenes && gltf.scenes[0]) || null),
              undefined, (e) => { console.warn("builder: gltf load failed", e); done(null); });
          } else if (ext === "obj" && loaders.OBJLoader) {
            new loaders.OBJLoader().load(url, done, undefined,
              (e) => { console.warn("builder: obj load failed", e); done(null); });
          } else if (ext === "fbx" && loaders.FBXLoader) {
            new loaders.FBXLoader().load(url, done, undefined,
              (e) => { console.warn("builder: fbx load failed", e); done(null); });
          } else {
            URL.revokeObjectURL(url); resolve(null);
          }
        } catch (e) { URL.revokeObjectURL(url); resolve(null); }
      });
    }

    // base64 helpers (work in browser; node has Buffer but we don't need it there)
    function _arrayBufferToBase64(buf) {
      const bytes = new Uint8Array(buf);
      let binary = "";
      const CHUNK = 0x8000;
      for (let i = 0; i < bytes.length; i += CHUNK) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
      }
      if (typeof btoa === "function") return btoa(binary);
      // Node fallback for tests
      return Buffer.from(buf).toString("base64");
    }
    function _base64ToArrayBuffer(b64) {
      let binary;
      if (typeof atob === "function") binary = atob(b64);
      else binary = Buffer.from(b64, "base64").toString("binary");
      const len = binary.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
      return bytes.buffer;
    }

    // ---------- click-and-drag move ----------
    // While dragging, each mousemove raycasts to the ground plane and
    // re-positions the selected object's XZ to match the cursor.
    // The entire drag is collapsed into ONE undo entry on dragEnd.
    let dragging = false;
    let dragYOffset = 0;
    let dragMesh = null;
    let dragStartPos = null;
    function dragStart() {
      if (!selected) return false;
      dragging = true;
      dragMesh = selected;
      dragStartPos = { x: selected.position.x, y: selected.position.y, z: selected.position.z };
      dragYOffset = selected.position.y;
      return true;
    }
    function dragMove(ndc) {
      if (!dragging || !selected) return false;
      const ray = new THREE.Raycaster();
      ray.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), camera);
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const hit = new THREE.Vector3();
      if (!ray.ray.intersectPlane(plane, hit)) return false;
      selected.position.x = hit.x;
      selected.position.z = hit.z;
      selected.position.y = dragYOffset;
      if (outline) outline.position.set(selected.position.x, selected.position.y, selected.position.z);
      _repositionGizmo();
      return true;
    }
    function dragEnd() {
      if (!dragging) return;
      dragging = false;
      save();
      if (dragMesh && dragStartPos) {
        const mesh = dragMesh;
        const old = dragStartPos;
        const nw  = { x: mesh.position.x, y: mesh.position.y, z: mesh.position.z };
        if (old.x !== nw.x || old.y !== nw.y || old.z !== nw.z) {
          _pushOp(
            () => { mesh.position.set(old.x, old.y, old.z); if (outline && selected === mesh) outline.position.copy(mesh.position); save(); },
            () => { mesh.position.set(nw.x,  nw.y,  nw.z);  if (outline && selected === mesh) outline.position.copy(mesh.position); save(); },
            "drag"
          );
        }
      }
      dragMesh = null; dragStartPos = null;
    }
    function isDragging() { return dragging; }

    // ---------- quick-spawn primitives ----------
    function spawnPrimitive(kind, pos) {
      pos = pos || { x: 0, y: 0.5, z: 0 };
      let mesh = null;
      const mat = new THREE.MeshStandardMaterial({
        color: 0x88aaff, metalness: 0.2, roughness: 0.6,
      });
      if (kind === "cube") {
        mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat);
      } else if (kind === "sphere") {
        mesh = new THREE.Mesh(new THREE.SphereGeometry(0.5, 24, 16), mat);
      } else if (kind === "cylinder") {
        mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.5, 24), mat);
      } else if (kind === "plane") {
        mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2),
          new THREE.MeshStandardMaterial({ color: 0xaaccff, side: THREE.DoubleSide }));
        mesh.rotation.x = -Math.PI / 2;
      } else if (kind === "light") {
        // PointLight wrapped in a Group so the helper mesh is selectable
        const grp = new THREE.Group();
        const light = new THREE.PointLight(0xffffaa, 1.5, 20);
        grp.add(light);
        const helper = new THREE.Mesh(
          new THREE.SphereGeometry(0.18, 12, 8),
          new THREE.MeshBasicMaterial({ color: 0xffffaa })
        );
        grp.add(helper);
        mesh = grp;
      } else {
        return null;
      }
      mesh.position.set(pos.x, pos.y, pos.z);
      if (mesh.castShadow !== undefined) mesh.castShadow = true;
      _addManagedMesh(mesh, { primitive: kind });
      select(mesh);
      return mesh;
    }

    // ---------- inspector helpers ----------
    function setPosition(x, y, z) {
      if (!selected) return false;
      const mesh = selected;
      const old = { x: mesh.position.x, y: mesh.position.y, z: mesh.position.z };
      if (isFinite(x)) mesh.position.x = x;
      if (isFinite(y)) mesh.position.y = y;
      if (isFinite(z)) mesh.position.z = z;
      const nw  = { x: mesh.position.x, y: mesh.position.y, z: mesh.position.z };
      if (outline) outline.position.set(mesh.position.x, mesh.position.y, mesh.position.z);
      _repositionGizmo();
      save();
      if (old.x !== nw.x || old.y !== nw.y || old.z !== nw.z) {
        _pushOp(
          () => { mesh.position.set(old.x, old.y, old.z); if (outline && selected === mesh) outline.position.copy(mesh.position); _repositionGizmo(); save(); },
          () => { mesh.position.set(nw.x,  nw.y,  nw.z);  if (outline && selected === mesh) outline.position.copy(mesh.position); _repositionGizmo(); save(); },
          "setPos"
        );
      }
      return true;
    }
    function setRotation(rx, ry, rz) {
      if (!selected) return false;
      const mesh = selected;
      const old = { x: mesh.rotation.x, y: mesh.rotation.y, z: mesh.rotation.z };
      if (isFinite(rx)) mesh.rotation.x = rx;
      if (isFinite(ry)) mesh.rotation.y = ry;
      if (isFinite(rz)) mesh.rotation.z = rz;
      const nw = { x: mesh.rotation.x, y: mesh.rotation.y, z: mesh.rotation.z };
      save();
      if (old.x !== nw.x || old.y !== nw.y || old.z !== nw.z) {
        _pushOp(
          () => { mesh.rotation.x = old.x; mesh.rotation.y = old.y; mesh.rotation.z = old.z; save(); },
          () => { mesh.rotation.x = nw.x;  mesh.rotation.y = nw.y;  mesh.rotation.z = nw.z;  save(); },
          "setRot"
        );
      }
      return true;
    }
    function setScale(sx, sy, sz) {
      if (!selected) return false;
      const mesh = selected;
      const old = { x: mesh.scale.x, y: mesh.scale.y, z: mesh.scale.z };
      if (isFinite(sx)) mesh.scale.x = sx;
      if (isFinite(sy)) mesh.scale.y = sy;
      if (isFinite(sz)) mesh.scale.z = sz;
      const nw = { x: mesh.scale.x, y: mesh.scale.y, z: mesh.scale.z };
      _outlineFor(mesh);
      save();
      if (old.x !== nw.x || old.y !== nw.y || old.z !== nw.z) {
        _pushOp(
          () => { mesh.scale.set(old.x, old.y, old.z); _outlineFor(mesh); save(); },
          () => { mesh.scale.set(nw.x,  nw.y,  nw.z);  _outlineFor(mesh); save(); },
          "setScl"
        );
      }
      return true;
    }
    function getTransform() {
      if (!selected) return null;
      return {
        pos:   { x: selected.position.x, y: selected.position.y, z: selected.position.z },
        rot:   { x: selected.rotation.x, y: selected.rotation.y, z: selected.rotation.z },
        scale: { x: selected.scale.x,    y: selected.scale.y,    z: selected.scale.z    },
        meta:  managed.get(selected) || {},
      };
    }

    // ---------- material / light color + intensity ----------
    // Walk the selected group to find the first Mesh's material (color)
    // OR a PointLight (color + intensity). Returns null if neither.
    function _findColorTarget(root) {
      if (!root || typeof root.traverse !== "function") return null;
      let mat = null, light = null;
      root.traverse(function (obj) {
        if (!mat && obj.material && obj.material.color) mat = obj.material;
        if (!light && obj.isLight) light = obj;
      });
      if (light) return { kind: "light", ref: light };
      if (mat) return { kind: "material", ref: mat };
      return null;
    }
    function getColor() {
      if (!selected) return null;
      const t = _findColorTarget(selected);
      if (!t || !t.ref.color || typeof t.ref.color.getHexString !== "function") return null;
      return { hex: "#" + t.ref.color.getHexString(), kind: t.kind };
    }
    function setColor(hex) {
      if (!selected || typeof hex !== "string") return false;
      const t = _findColorTarget(selected);
      if (!t) return false;
      try { t.ref.color.set(hex); } catch (_) { return false; }
      save();
      return true;
    }
    function getIntensity() {
      if (!selected || typeof selected.traverse !== "function") return null;
      let light = null;
      selected.traverse(function (o) { if (!light && o.isLight) light = o; });
      return light ? light.intensity : null;
    }
    function setIntensity(v) {
      if (!selected || !isFinite(v) || typeof selected.traverse !== "function") return false;
      let light = null;
      selected.traverse(function (o) { if (!light && o.isLight) light = o; });
      if (!light) return false;
      light.intensity = Math.max(0, v);
      save();
      return true;
    }

    // ---------- clone selected (Ctrl+D) ----------
    function cloneSelected(offset) {
      if (!selected) return null;
      offset = offset || { x: 1.2, y: 0, z: 0 };
      if (typeof selected.clone !== "function") return null;
      let copy;
      try { copy = selected.clone(true); }
      catch (_) { return null; }
      // Materials on cloned meshes are shared by default — clone them
      // too so color edits on the copy don't affect the original.
      if (typeof copy.traverse === "function") {
        copy.traverse((o) => {
          if (o.material) {
            try { o.material = o.material.clone(); } catch (_) {}
          }
        });
      }
      copy.position.set(
        selected.position.x + offset.x,
        selected.position.y + offset.y,
        selected.position.z + offset.z
      );
      const meta = Object.assign({}, managed.get(selected) || {});
      _addManagedMesh(copy, meta);
      select(copy);
      return copy;
    }

    return {
      setActive, isActive,
      select, clearSelection, deleteSelected,
      translate, rotateY, scaleBy,
      setPosition, setRotation, setScale, getTransform,
      getColor, setColor, getIntensity, setIntensity,
      cloneSelected,
      pickAt, pickGizmoAxis,
      startAxisDrag, updateAxisDrag, endAxisDrag, isAxisDragging,
      add: _addManagedMesh,
      spawnPrimitive,
      attachDragDrop, loadDroppedFile,
      dragStart, dragMove, dragEnd, isDragging,
      save, loadState, clearState,
      managedCount: () => managed.size,
      getSelected: () => selected,
      undo, redo, undoDepth, redoDepth,
      clearScene, rehydrate,
      saveNamed, loadNamed, deleteNamed, listNamed,
      exportSceneJSON, importSceneJSON,
      VERSION: "0.5.1-iter141",
    };
  }

  return { createBuilder, serializeMesh, STORAGE_KEY };
});
