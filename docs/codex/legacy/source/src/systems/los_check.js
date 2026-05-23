// Segment-vs-AABB slab test for line-of-sight queries.
// Returns true when the segment (u0,v0)→(u1,v1) passes through no blocker.
// Skips arena boundary walls (|u|>=26 or |v|>=26) by blocker position.
export function hasLOS(u0, v0, u1, v1, blockers) {
  const du = u1 - u0, dv = v1 - v0;
  for (const bl of blockers) {
    if (Math.abs(bl.u) >= 26 || Math.abs(bl.v) >= 26) continue;
    const hw = bl.hitbox.w / 2, hd = bl.hitbox.d / 2;
    let tminU, tmaxU, tminV, tmaxV;
    if (Math.abs(du) < 1e-6) {
      if (u0 < bl.u - hw || u0 > bl.u + hw) continue;
      tminU = -Infinity; tmaxU = Infinity;
    } else {
      const t1 = (bl.u - hw - u0) / du, t2 = (bl.u + hw - u0) / du;
      tminU = Math.min(t1, t2); tmaxU = Math.max(t1, t2);
    }
    if (Math.abs(dv) < 1e-6) {
      if (v0 < bl.v - hd || v0 > bl.v + hd) continue;
      tminV = -Infinity; tmaxV = Infinity;
    } else {
      const t1 = (bl.v - hd - v0) / dv, t2 = (bl.v + hd - v0) / dv;
      tminV = Math.min(t1, t2); tmaxV = Math.max(t1, t2);
    }
    const tmin = Math.max(tminU, tminV), tmax = Math.min(tmaxU, tmaxV);
    if (tmin < tmax && tmax > 0.05 && tmin < 0.95) return false;
  }
  return true;
}
