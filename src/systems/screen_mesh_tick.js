const CURSOR_COLOR  = "rgba(255, 255, 0, 0.35)";
const CURSOR_STROKE = "#ffff00";
const CURSOR_RADIUS = 8;

export function mountScreenMeshTick({ actions }) {
  function tick(_dt, { buildMode, pointerLocked, mouseMode, spineZone,
                       jumbotronScreen, skyScreen, worldScreens,
                       activeMouseScreen, mouseModeCursor }) {
    const SM = actions.getScreenMesh();
    if (!SM) return;

    // Update jumbotron, sky, and all other world screens
    if (jumbotronScreen) {
      SM.setState(jumbotronScreen, { spineZone });
      SM.update(jumbotronScreen);
    }
    if (skyScreen) SM.update(skyScreen);
    for (const [, entry] of worldScreens) {
      if (entry.screen !== jumbotronScreen && entry.screen !== skyScreen) {
        SM.update(entry.screen);
      }
    }

    // Build console — crosshair raycast + virtual cursor
    const bcSc   = actions.getBuildConsoleScreen();
    const bcMesh = actions.getBuildConsoleMesh();
    if (buildMode && bcSc && bcMesh && pointerLocked) {
      const hits = actions.intersectMesh(bcMesh);
      if (hits.length > 0 && hits[0].uv) {
        const { uv } = hits[0];
        const cx = Math.round(uv.x * bcSc.resolutionW);
        const cy = Math.round((1 - uv.y) * bcSc.resolutionH);
        let hoverBtn = null;
        for (const r of (bcSc.hitRegions || [])) {
          if (cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h) { hoverBtn = r.id; break; }
        }
        SM.setState(bcSc, { cursorX: cx, cursorY: cy, hoverBtn });
        actions.setHoverRegion(hoverBtn);
      } else {
        SM.setState(bcSc, { cursorX: -1, cursorY: -1, hoverBtn: null });
        actions.setHoverRegion(null);
      }
    } else if (bcSc) {
      SM.setState(bcSc, { cursorX: -1, cursorY: -1, hoverBtn: null });
    }

    // Mouse-mode cursor overlay — painted on top of the active screen
    if (mouseMode && activeMouseScreen && activeMouseScreen.canvas) {
      const ctx = activeMouseScreen.canvas.getContext("2d");
      const { x: cx, y: cy } = mouseModeCursor;
      ctx.fillStyle = CURSOR_COLOR;
      ctx.fillRect(cx - 12, cy - 1, 24, 3);
      ctx.fillRect(cx - 1, cy - 12, 3, 24);
      ctx.strokeStyle = CURSOR_STROKE;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, CURSOR_RADIUS, 0, Math.PI * 2); ctx.stroke();
      if (activeMouseScreen.texture) activeMouseScreen.texture.needsUpdate = true;
    }
  }

  return { tick };
}
