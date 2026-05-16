// custom_objects.js — upload pipeline for OBJ/GLB/GLTF.
// Computes axis-aligned bounding box from mesh vertices, registers a new
// entity TYPE so spawned instances automatically have a working hitbox.
//
// Real implementation will use Three.js loaders (browser side); this module
// owns the format detection + AABB math + registry hand-off.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTACustomObj = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const SUPPORTED_EXTS = new Set(["obj", "glb", "gltf"]);

  function detectFormat(filename) {
    const m = String(filename || "").toLowerCase().match(/\.([a-z0-9]+)$/);
    if (!m) return null;
    const ext = m[1];
    return SUPPORTED_EXTS.has(ext) ? ext : null;
  }

  // Compute AABB from a flat array of vertex floats: [x0,y0,z0,x1,y1,z1,...]
  function aabbFromVertices(verts) {
    if (!verts || verts.length < 3 || verts.length % 3 !== 0) {
      return null;
    }
    let minX =  Infinity, minY =  Infinity, minZ =  Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (let i = 0; i < verts.length; i += 3) {
      const x = verts[i], y = verts[i + 1], z = verts[i + 2];
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
    }
    return {
      min: { x: minX, y: minY, z: minZ },
      max: { x: maxX, y: maxY, z: maxZ },
      // hitbox shape: w=u-extent, d=v-extent (z), h=y-extent
      hitbox: {
        w: maxX - minX,
        h: maxY - minY,
        d: maxZ - minZ,
      },
      // center to translate origin to center if desired
      center: {
        x: (minX + maxX) / 2,
        y: (minY + maxY) / 2,
        z: (minZ + maxZ) / 2,
      },
    };
  }

  // Minimal OBJ parser — handles `v x y z` lines. Ignores normals / faces /
  // uvs (we only need vertices for AABB).
  function parseObjVertices(text) {
    if (typeof text !== "string") return null;
    const verts = [];
    const lines = text.split(/\r?\n/);
    for (const line of lines) {
      if (!line.startsWith("v ")) continue;
      const parts = line.trim().split(/\s+/);
      if (parts.length < 4) continue;
      const x = parseFloat(parts[1]);
      const y = parseFloat(parts[2]);
      const z = parseFloat(parts[3]);
      if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
        verts.push(x, y, z);
      }
    }
    return verts;
  }

  // Validate + extract metadata from an upload payload.
  // payload = { filename, format?, content (string for obj, ArrayBuffer for glb), vertices? }
  // Returns { ok, format, aabb, vertexCount, reason? }
  function processUpload(payload) {
    const format = payload.format || detectFormat(payload.filename);
    if (!format) return { ok: false, reason: "unsupported_format" };

    let verts = payload.vertices;
    if (!verts && format === "obj" && typeof payload.content === "string") {
      verts = parseObjVertices(payload.content);
    }
    // GLB/GLTF parsing is non-trivial — caller passes pre-extracted vertices
    // (Three.js loader does this in the browser).
    if (!verts || verts.length === 0) {
      return { ok: false, reason: "no_vertices" };
    }
    const aabb = aabbFromVertices(verts);
    if (!aabb) return { ok: false, reason: "bad_vertex_array" };
    return { ok: true, format, aabb, vertexCount: verts.length / 3 };
  }

  // Register an uploaded asset as a new entity type in the registry.
  function registerAsCustomEntity(registry, typeName, processed, opts) {
    if (!processed.ok) return { ok: false, reason: processed.reason };
    if (registry.getType(typeName)) return { ok: false, reason: "type_exists" };
    opts = opts || {};
    registry.registerType(typeName, {
      build: (extra) => {
        const Entity = (typeof require === "function") ? require("./entity.js") :
          (typeof self !== "undefined" ? self.GTAEntity : null);
        const facets = Object.assign({
          position: extra && extra.position ? extra.position : { u: 0, v: 0, y: 0 },
          hitbox:   processed.aabb.hitbox,
          custom_mesh: { format: processed.format, source: opts.source || null, aabb: processed.aabb },
        }, (extra && extra.facets) || {});
        return Entity ? Entity.createEntity(typeName, facets) : null;
      },
      meta: { vertexCount: processed.vertexCount, aabb: processed.aabb, format: processed.format },
    });
    return { ok: true };
  }

  return {
    SUPPORTED_EXTS, detectFormat, aabbFromVertices, parseObjVertices,
    processUpload, registerAsCustomEntity,
  };
});
