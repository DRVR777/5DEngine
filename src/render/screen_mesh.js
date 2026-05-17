// screen_mesh.js — turn any 3D plane into an interactive HTML-rendered screen.
//
// Per conviction.pdf §6.1: "Any surface in the game can become a screen.
// A screen is a PlaneGeometry mesh with an HTML canvas texture. Raycasting
// the 3D plane returns UV coordinates, multiplied by canvas resolution to
// get 2D pixel coordinates" — then we DOM-hit-test that pixel to know
// which element the player is "clicking" on.
//
// Pure-data API: a `Screen` is just metadata + a canvas (optional in node).
// The renderer attaches a THREE.Mesh to it. The bus interacts via:
//   - draw(ctx, screen) — caller paints into the canvas
//   - hitTest(screen, uv) — returns the element id under that UV, if any
//   - update(screen) — flag the texture as needing upload
//
// Bound to: device-graph monitors, in-world jumbotrons, sky-screens.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ScreenMesh = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // ------------------------------------------------------------------
  // Screen creation
  // ------------------------------------------------------------------
  function createScreen(opts) {
    opts = opts || {};
    const resolutionW = opts.resolutionW || 512;
    const resolutionH = opts.resolutionH || 384;
    const widthM      = opts.widthM      || 1.0;    // physical width in metres
    const heightM     = opts.heightM     || (widthM * resolutionH / resolutionW);

    const screen = {
      id: opts.id || "screen_" + Math.random().toString(36).slice(2, 8),
      resolutionW, resolutionH,
      widthM, heightM,
      // Hit-targets: array of { id, x, y, w, h, label?, onClick? }
      // Pixel coords in canvas space.
      hitRegions: opts.hitRegions || [],
      // Frame-buffer text the renderer will draw — caller provides a
      // `paint(ctx, screen)` function OR sets `frame` (string lines).
      frame: opts.frame || null,
      paint: opts.paint || null,
      // Per-screen state — anything caller wants to track (cursor pos, etc.)
      state: opts.state || {},
      dirty: true,
      canvas: null,    // populated when bound to a renderer
      texture: null,
    };
    return screen;
  }

  // Default paint: render lines of text as a terminal.
  function paintTerminal(ctx, screen, lines, opts) {
    opts = opts || {};
    ctx.fillStyle = opts.bg || "#0a1428";
    ctx.fillRect(0, 0, screen.resolutionW, screen.resolutionH);
    ctx.fillStyle = opts.fg || "#88ddff";
    ctx.font = (opts.fontPx || 14) + "px monospace";
    const lh = (opts.fontPx || 14) + 4;
    let y = lh;
    for (const line of lines || []) {
      ctx.fillText(line, 8, y);
      y += lh;
      if (y > screen.resolutionH - 8) break;
    }
  }

  // Apply per-screen paint function if present; mark dirty so texture re-uploads.
  function update(screen) {
    if (!screen.canvas) return false;
    const ctx = screen.canvas.getContext("2d");
    if (screen.paint) {
      screen.paint(ctx, screen);
    } else if (screen.frame) {
      paintTerminal(ctx, screen, screen.frame);
    }
    // Overlay hit-regions if state.showHitRegions (debug)
    if (screen.state.showHitRegions) {
      ctx.strokeStyle = "rgba(255,255,0,0.35)";
      ctx.lineWidth = 1;
      for (const r of screen.hitRegions) ctx.strokeRect(r.x, r.y, r.w, r.h);
    }
    screen.dirty = true;
    if (screen.texture && "needsUpdate" in screen.texture) screen.texture.needsUpdate = true;
    return true;
  }

  // Hit-test a UV against the screen's hit regions. UV is (u, v) in [0..1].
  // Returns matching region or null. Note: THREE UVs have v=0 at the BOTTOM
  // of the texture; canvas y=0 is at the TOP — we flip here.
  function hitTest(screen, uv) {
    if (!uv) return null;
    const px = uv.x * screen.resolutionW;
    const py = (1 - uv.y) * screen.resolutionH;
    for (const r of screen.hitRegions) {
      if (px >= r.x && px < r.x + r.w && py >= r.y && py < r.y + r.h) return r;
    }
    return null;
  }

  function setRegions(screen, regions) {
    screen.hitRegions = regions || [];
    screen.dirty = true;
  }

  function setFrame(screen, lines) {
    screen.frame = lines;
    update(screen);
  }

  function setState(screen, patch) {
    Object.assign(screen.state, patch || {});
  }

  // ------------------------------------------------------------------
  // THREE.js binding (no-op in node where THREE is undefined)
  // ------------------------------------------------------------------
  function bindToThree(THREE, screen, opts) {
    if (!THREE) return null;
    opts = opts || {};
    const canvas = (typeof document !== "undefined") ? document.createElement("canvas") : null;
    if (!canvas) return null;
    canvas.width = screen.resolutionW;
    canvas.height = screen.resolutionH;
    screen.canvas = canvas;
    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    screen.texture = tex;
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      side: opts.doubleSided ? THREE.DoubleSide : THREE.FrontSide,
      transparent: !!opts.transparent,
    });
    const geom = new THREE.PlaneGeometry(screen.widthM, screen.heightM);
    const mesh = new THREE.Mesh(geom, mat);
    mesh.userData = { screenId: screen.id, kind: "screen" };
    update(screen);
    return mesh;
  }

  // Raycast helper: given a THREE.Raycaster and an array of screen meshes,
  // find which screen was hit + the UV. Returns { screen, mesh, uv } or null.
  function pickScreen(raycaster, screenMeshes, screens) {
    if (!raycaster || !screenMeshes) return null;
    const intersects = raycaster.intersectObjects(screenMeshes, false);
    if (!intersects.length) return null;
    const hit = intersects[0];
    const mesh = hit.object;
    const screenId = mesh.userData && mesh.userData.screenId;
    const screen = screens && screens.get ? screens.get(screenId) :
                   screens && screens[screenId] ? screens[screenId] : null;
    return { mesh, uv: hit.uv, distance: hit.distance, screenId, screen };
  }

  // Size presets (in metres) per user's "50ft, 1000ft" ask.
  // 1 ft = 0.3048 m
  const SIZE_PRESETS = {
    small:      { widthM: 1.0,  heightM: 0.7 },     // monitor
    big:        { widthM: 3.0,  heightM: 2.0 },     // TV
    jumbotron:  { widthM: 15.24, heightM: 9.14 },   // 50 ft × 30 ft
    colossal:   { widthM: 304.8, heightM: 152.4 },  // 1000 ft × 500 ft
    skyscreen:  { widthM: 304.8, heightM: 152.4 },  // alias for colossal
  };

  return {
    createScreen, paintTerminal, update,
    hitTest, setRegions, setFrame, setState,
    bindToThree, pickScreen,
    SIZE_PRESETS,
    VERSION: "0.1.0-iter131",
  };
});
