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
      scene.remove(selected);
      managed.delete(selected);
      clearSelection();
      save();
      onChange("delete");
      return true;
    }

    function translate(dx, dy, dz) {
      if (!selected) return;
      selected.position.x += dx; selected.position.y += dy; selected.position.z += dz;
      if (outline) outline.position.set(selected.position.x, selected.position.y, selected.position.z);
      save();
    }
    function rotateY(d) {
      if (!selected) return;
      selected.rotation.y += d;
      save();
    }
    function scaleBy(f) {
      if (!selected) return;
      selected.scale.multiplyScalar(f);
      _outlineFor(selected);
      save();
    }

    function _addManagedMesh(mesh, meta) {
      managed.set(mesh, meta || {});
      scene.add(mesh);
      save();
      onChange("add");
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

    return {
      setActive, isActive,
      select, clearSelection, deleteSelected,
      translate, rotateY, scaleBy,
      pickAt,
      add: _addManagedMesh,
      attachDragDrop, loadDroppedFile,
      save, loadState, clearState,
      managedCount: () => managed.size,
      getSelected: () => selected,
      VERSION: "0.1.0-iter136",
    };
  }

  return { createBuilder, serializeMesh, STORAGE_KEY };
});
