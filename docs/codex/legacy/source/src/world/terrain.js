// terrain.js — 5DEngine procedural heightmap terrain
// Generates a subdivided PlaneGeometry with Perlin-style noise elevation.
// Also exposes getHeightAt(u, v) for physics/collision use.
//
// API (window.Terrain):
//   generate(THREE, scene, opts)  — creates terrain mesh in scene; returns api
//   getHeightAt(u, v)             — world-space Y at UV position (bilinear)
//   setVisible(bool)
//   dispose()                     — removes mesh and frees memory
//
// opts:
//   size         — world units per side (default 200)
//   segments     — vertex grid resolution (default 128)
//   maxHeight    — peak elevation (default 8)
//   seed         — random seed integer (default 1)
//   waterLevel   — y below which is painted blue (default -1, disabled if null)
//   palette      — { low, mid, high } hex colors (default grass/rock/snow)

(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Terrain = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // ---- Deterministic pseudo-random + Perlin-ish noise ----
  function _seeded(s) {
    let v = s;
    return function () {
      v = (v * 1664525 + 1013904223) & 0xffffffff;
      return (v >>> 0) / 4294967296;
    };
  }

  // Smooth noise via bilinear interpolation of a random grid
  function _makeNoise2D(gridSize, rand) {
    const g = [];
    for (let i = 0; i < gridSize * gridSize; i++) g.push(rand() * 2 - 1);
    const get = (xi, yi) => g[((yi % gridSize + gridSize) % gridSize) * gridSize + ((xi % gridSize + gridSize) % gridSize)];
    const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
    return function (x, y) {
      const xi = Math.floor(x), yi = Math.floor(y);
      const xf = x - xi, yf = y - yi;
      const a = get(xi, yi), b = get(xi + 1, yi), c = get(xi, yi + 1), d = get(xi + 1, yi + 1);
      const fx = fade(xf), fy = fade(yf);
      return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
    };
  }

  function generate(THREE, scene, opts = {}) {
    const size      = opts.size       || 200;
    const segments  = opts.segments   || 128;
    const maxH      = opts.maxHeight  || 8;
    const seed      = opts.seed       || 1;
    const wLevel    = opts.waterLevel != null ? opts.waterLevel : -1;
    const palette   = Object.assign({ low: 0x4a7c39, mid: 0x7a7a6a, high: 0xdde8f0 }, opts.palette || {});

    const rand = _seeded(seed);
    const noise1 = _makeNoise2D(16, _seeded(seed));
    const noise2 = _makeNoise2D(8,  _seeded(seed + 1337));
    const noise3 = _makeNoise2D(32, _seeded(seed + 2674));

    function _heightAt(nx, ny) {
      // Multi-octave layered noise
      const n = noise1(nx * 3, ny * 3) * 0.6
              + noise2(nx * 6, ny * 6) * 0.3
              + noise3(nx * 1, ny * 1) * 0.1;
      // Flatten center (player spawn area) with a radial mask
      const dist = Math.hypot(nx - 0.5, ny - 0.5);
      const flat = Math.max(0, 1 - dist * 4.5);
      return n * maxH * (1 - flat * 0.85);
    }

    const geo = new THREE.PlaneGeometry(size, size, segments, segments);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const colAttr = new THREE.BufferAttribute(colors, 3);
    geo.setAttribute("color", colAttr);

    const lowC  = new THREE.Color(palette.low);
    const midC  = new THREE.Color(palette.mid);
    const highC = new THREE.Color(palette.high);
    const watC  = new THREE.Color(0x1a6fa0);

    const _heightGrid = [];   // for getHeightAt
    for (let iy = 0; iy <= segments; iy++) {
      _heightGrid[iy] = [];
      for (let ix = 0; ix <= segments; ix++) {
        const nx = ix / segments, ny = iy / segments;
        const h = _heightAt(nx, ny);
        _heightGrid[iy][ix] = h;
      }
    }

    for (let i = 0; i < pos.count; i++) {
      const wx = pos.getX(i);
      const wz = pos.getZ(i);
      const nx = (wx + size / 2) / size;
      const ny = (wz + size / 2) / size;
      const ix = Math.round(nx * segments);
      const iy = Math.round(ny * segments);
      const h = (_heightGrid[iy] || [])[ix] || 0;
      pos.setY(i, h);

      // Vertex color based on height
      let c;
      if (wLevel !== null && h <= wLevel) {
        c = watC;
      } else {
        const t = Math.max(0, Math.min(1, (h + maxH) / (maxH * 2)));
        c = t < 0.5 ? lowC.clone().lerp(midC, t * 2) : midC.clone().lerp(highC, (t - 0.5) * 2);
      }
      colors[i * 3]     = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    geo.computeVertexNormals();
    pos.needsUpdate = true;
    colAttr.needsUpdate = true;

    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.9, metalness: 0.0,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.name = "_terrain";
    scene.add(mesh);

    // getHeightAt — bilinear interpolation in the height grid
    function getHeightAt(u, v) {
      const nx = (u + size / 2) / size;
      const ny = (v + size / 2) / size;
      if (nx < 0 || nx > 1 || ny < 0 || ny > 1) return 0;
      const fx = nx * segments, fy = ny * segments;
      const ix0 = Math.floor(fx), iy0 = Math.floor(fy);
      const ix1 = Math.min(ix0 + 1, segments), iy1 = Math.min(iy0 + 1, segments);
      const tx = fx - ix0, ty = fy - iy0;
      const h00 = (_heightGrid[iy0] || [])[ix0] || 0;
      const h10 = (_heightGrid[iy0] || [])[ix1] || 0;
      const h01 = (_heightGrid[iy1] || [])[ix0] || 0;
      const h11 = (_heightGrid[iy1] || [])[ix1] || 0;
      return h00 * (1 - tx) * (1 - ty)
           + h10 * tx * (1 - ty)
           + h01 * (1 - tx) * ty
           + h11 * tx * ty;
    }

    function setVisible(v) { mesh.visible = v; }
    function dispose() { scene.remove(mesh); geo.dispose(); mat.dispose(); }

    return { mesh, getHeightAt, setVisible, dispose, size, segments };
  }

  // Module-level active terrain reference
  let _active = null;

  return {
    generate(THREE, scene, opts) {
      if (_active) _active.dispose();
      _active = generate(THREE, scene, opts);
      return _active;
    },
    getHeightAt(u, v) { return _active ? _active.getHeightAt(u, v) : 0; },
    setVisible(v) { if (_active) _active.setVisible(v); },
    dispose() { if (_active) { _active.dispose(); _active = null; } },
    get active() { return _active; },
  };
});
