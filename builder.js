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
    const managed = new Map();   // mesh → meta {id, assetUrl, assetData, assetExt}

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
      if (!mesh) return;
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
    }

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
      save();
      _pushOp(
        () => { mesh.position.set(old.x, old.y, old.z); if (outline) outline.position.copy(mesh.position); save(); },
        () => { mesh.position.set(nw.x,  nw.y,  nw.z);  if (outline) outline.position.copy(mesh.position); save(); },
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

    // Pick under a NDC point (e.g. {x: 0, y: 0} = screen center)
    function pickAt(ndc) {
      const ray = new THREE.Raycaster();
      ray.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), camera);
      const hits = ray.intersectObjects(Array.from(managed.keys()), true);
      if (!hits.length) return null;
      // Walk up to the top-level managed mesh
      let m = hits[0].object;
      while (m.parent && !managed.has(m) && m.parent !== scene) m = m.parent;
      return managed.has(m) ? m : null;
    }

    function setActive(on) {
      active = !!on;
      if (!active) clearSelection();
    }
    function isActive() { return active; }

    // ---------- persistence ----------
    function save() {
      try {
        const arr = [];
        for (const [mesh, meta] of managed) arr.push(serializeMesh(mesh, meta));
        if (typeof localStorage !== "undefined") {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
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
      const url = URL.createObjectURL(new Blob([buf]));
      const at = opts2.at || { x: 0, y: 1, z: 0 };
      let group = null;
      try {
        if ((ext === "glb" || ext === "gltf") && loaders.GLTFLoader) {
          group = await new Promise((res, rej) => {
            new loaders.GLTFLoader().load(url, (g) => res(g.scene || (g.scenes && g.scenes[0])), undefined, rej);
          });
        } else if (ext === "obj" && loaders.OBJLoader) {
          group = await new Promise((res, rej) => {
            new loaders.OBJLoader().load(url, res, undefined, rej);
          });
        } else if (ext === "fbx" && loaders.FBXLoader) {
          group = await new Promise((res, rej) => {
            new loaders.FBXLoader().load(url, res, undefined, rej);
          });
        }
      } catch (e) {
        console.warn("builder: load failed", file.name, e.message);
      } finally {
        URL.revokeObjectURL(url);
      }
      if (!group) return null;
      group.position.set(at.x, at.y, at.z);
      _addManagedMesh(group, { assetUrl: file.name, assetExt: ext });
      select(group);
      return group;
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
      save();
      if (old.x !== nw.x || old.y !== nw.y || old.z !== nw.z) {
        _pushOp(
          () => { mesh.position.set(old.x, old.y, old.z); if (outline && selected === mesh) outline.position.copy(mesh.position); save(); },
          () => { mesh.position.set(nw.x,  nw.y,  nw.z);  if (outline && selected === mesh) outline.position.copy(mesh.position); save(); },
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
      pickAt,
      add: _addManagedMesh,
      spawnPrimitive,
      attachDragDrop, loadDroppedFile,
      dragStart, dragMove, dragEnd, isDragging,
      save, loadState, clearState,
      managedCount: () => managed.size,
      getSelected: () => selected,
      undo, redo, undoDepth, redoDepth,
      VERSION: "0.4.0-iter139",
    };
  }

  return { createBuilder, serializeMesh, STORAGE_KEY };
});
