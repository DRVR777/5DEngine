// wires.js — physical-wire visualization for the device graph.
//
// `devices.js` is the logical bus. This module turns each wire into a draped
// cable curve between two device positions in 3D space, suitable for THREE
// TubeGeometry or any line renderer.
//
// Pure-data API: `wirePoints(a, b, opts)` returns an array of {x,y,z} points
// along a catenary-like sag curve. The actual mesh build is optional and
// guarded by `typeof THREE !== "undefined"` so this module imports cleanly
// in node (tests) without three.js.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Wires = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Tangent-style sag: y dips below the line by `sag * (1 - (2t-1)^2)`.
  // Simpler than a true catenary but visually convincing for short cables.
  function wirePoints(a, b, opts) {
    opts = opts || {};
    const segments = Math.max(2, opts.segments || 16);
    const dist = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    const sag  = opts.sag != null ? opts.sag : Math.min(0.4, dist * 0.05);
    const pts = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const x = a.x + (b.x - a.x) * t;
      const y = a.y + (b.y - a.y) * t - sag * (1 - Math.pow(2 * t - 1, 2));
      const z = a.z + (b.z - a.z) * t;
      pts.push({ x, y, z });
    }
    return pts;
  }

  // Build a TubeGeometry-backed mesh if THREE is available.
  function buildWireMesh(THREE, a, b, opts) {
    if (!THREE) return null;
    opts = opts || {};
    const pts = wirePoints(a, b, opts).map(p => new THREE.Vector3(p.x, p.y, p.z));
    const curve = new THREE.CatmullRomCurve3(pts);
    const geom  = new THREE.TubeGeometry(curve, opts.segments || 24,
                                         opts.radius || 0.04,
                                         opts.radial || 6, false);
    const mat   = new THREE.MeshStandardMaterial({
      color: opts.color != null ? opts.color : 0x222222,
      roughness: 0.6, metalness: 0.1,
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.castShadow = true;
    return mesh;
  }

  // Map of device kind → cable color (so video cables look different from audio)
  const CABLE_COLOR = {
    video: 0x4488cc,  // blue
    audio: 0xff5533,  // orange/red
    data:  0x66cc66,  // green
    power: 0xffcc00,  // yellow
    rf:    0xaa66ff,  // purple (but RF rarely drawn as wire)
  };
  function colorForKind(k) { return CABLE_COLOR[k] != null ? CABLE_COLOR[k] : 0x222222; }

  // Refresh a wire's geometry — call when endpoints move
  function refreshWireMesh(THREE, mesh, a, b, opts) {
    if (!THREE || !mesh) return;
    opts = opts || {};
    const pts = wirePoints(a, b, opts).map(p => new THREE.Vector3(p.x, p.y, p.z));
    const curve = new THREE.CatmullRomCurve3(pts);
    const newGeom = new THREE.TubeGeometry(curve, opts.segments || 24,
                                           opts.radius || 0.04,
                                           opts.radial || 6, false);
    if (mesh.geometry && mesh.geometry.dispose) mesh.geometry.dispose();
    mesh.geometry = newGeom;
  }

  // Build all THREE meshes for a bus state. Returns a map wireId → mesh.
  // Endpoint resolver: caller supplies (deviceId) → {x,y,z}.
  function buildAllWireMeshes(THREE, bus, resolvePos, opts) {
    const out = new Map();
    if (!THREE || !bus) return out;
    for (const w of bus.listWires()) {
      const a = resolvePos(w.a.deviceId);
      const b = resolvePos(w.b.deviceId);
      if (!a || !b) continue;
      const mesh = buildWireMesh(THREE, a, b, Object.assign({ color: colorForKind(w.kind) }, opts || {}));
      mesh.userData = { wireId: w.id, kind: w.kind };
      out.set(w.id, mesh);
    }
    return out;
  }

  return {
    wirePoints, buildWireMesh, refreshWireMesh, buildAllWireMeshes,
    colorForKind, CABLE_COLOR,
    VERSION: "0.1.0-iter130",
  };
});
