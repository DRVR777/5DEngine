export function mountPlatformSystem() {
  let cache = [];
  let dirty = true;

  function markDirty() { dirty = true; }

  function tick(dt, { vehicles }) {
    if (!dirty) return;
    cache = [];
    for (const vDef of vehicles) {
      const vp = vDef.pos; if (!vp) continue;
      const vw = (vDef.hitbox && vDef.hitbox.w) || 2;
      const vd = (vDef.hitbox && vDef.hitbox.d) || 4;
      cache.push(
        { u: vp.u, v: vp.v - vd * 0.2, w: vw * 0.8, d: vd * 0.5, topY: 0.9, label: vDef.id + "_hood" },
        { u: vp.u, v: vp.v + vd * 0.1, w: vw * 0.9, d: vd * 0.4, topY: 1.4, label: vDef.id + "_roof" }
      );
    }
    dirty = false;
  }

  function getSupport(u, v, currentY) {
    let best = 0, bestLabel = "ground";
    for (const p of cache) {
      const halfW = p.w / 2, halfD = p.d / 2;
      if (u < p.u - halfW || u > p.u + halfW || v < p.v - halfD || v > p.v + halfD) continue;
      if (p.topY > currentY + 0.3) continue;
      if (p.topY > best) { best = p.topY; bestLabel = p.label; }
    }
    return { topY: best, label: bestLabel };
  }

  return { tick, getSupport, markDirty };
}
