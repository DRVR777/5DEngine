// physics.js — AABB collision (the kind that matters for "no walking
// through walls"). Pure functions on plain {u, v, w, h, d} shapes so they
// work in Node + browser, and so they slot into the registry as a facet.
//
// Convention: position is (u, v) in the engine ground plane; hitbox is
// {w, d} for footprint and {h} for vertical (used later for jump-on).
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTAPhysics = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // overlap on a single axis [a-aHalf, a+aHalf] vs [b-bHalf, b+bHalf]
  function overlap1D(a, aHalf, b, bHalf) {
    return Math.abs(a - b) < (aHalf + bHalf);
  }

  // 2D AABB overlap in the (u, v) ground plane
  function overlapsAABB(posA, boxA, posB, boxB) {
    return (
      overlap1D(posA.u, boxA.w / 2, posB.u, boxB.w / 2) &&
      overlap1D(posA.v, boxA.d / 2, posB.v, boxB.d / 2)
    );
  }

  // Try to apply (dU, dV) to mover; for each axis independently, if the
  // tentative move would cause overlap with any blocker, zero that axis.
  // This gives "slide along walls" behavior cheaply.
  // mover = { u, v, hitbox: {w, d} }
  // blockers = [{ u, v, hitbox: {w, d} }, ...]
  // Returns the actually-applied {dU, dV} so caller can update facing/anim.
  function resolveAABBMove(mover, dU, dV, blockers) {
    // Substep so a fast mover can't tunnel through a thin wall.
    // Step size = min hitbox half-extent (slightly less for safety).
    const maxStep = Math.max(0.05, Math.min(mover.hitbox.w, mover.hitbox.d) * 0.4);
    const dist = Math.hypot(dU, dV);
    if (dist > maxStep) {
      const n = Math.ceil(dist / maxStep);
      let totU = 0, totV = 0;
      for (let i = 0; i < n; i++) {
        const r = resolveAABBMoveOnce(mover, dU / n, dV / n, blockers);
        totU += r.dU; totV += r.dV;
        // If both axes blocked simultaneously, no point in continuing
        if (r.dU === 0 && r.dV === 0) break;
      }
      return { dU: totU, dV: totV };
    }
    return resolveAABBMoveOnce(mover, dU, dV, blockers);
  }

  function resolveAABBMoveOnce(mover, dU, dV, blockers) {
    let appliedU = dU, appliedV = dV;

    if (dU !== 0) {
      const probe = { u: mover.u + dU, v: mover.v };
      for (const b of blockers) {
        if (b === mover) continue;
        if (overlapsAABB(probe, mover.hitbox, b, b.hitbox)) { appliedU = 0; break; }
      }
    }

    if (dV !== 0) {
      const probe = { u: mover.u + appliedU, v: mover.v + dV };
      for (const b of blockers) {
        if (b === mover) continue;
        if (overlapsAABB(probe, mover.hitbox, b, b.hitbox)) { appliedV = 0; break; }
      }
    }

    mover.u += appliedU;
    mover.v += appliedV;
    return { dU: appliedU, dV: appliedV };
  }

  // Vertical: is the mover standing on top of a blocker?
  // mover.y is the bottom of its bbox; blocker top is blocker.y + blocker.h.
  // Within slop tolerance. Returns the surface y to snap onto, or null.
  function topOf(blocker) {
    return (blocker.y || 0) + (blocker.hitbox.h || 0);
  }
  function standingOn(mover, blockers, slop) {
    slop = slop == null ? 0.05 : slop;
    let best = null;
    for (const b of blockers) {
      if (b === mover) continue;
      // 2D footprint overlap?
      if (!overlapsAABB(mover, mover.hitbox, b, b.hitbox)) continue;
      const top = topOf(b);
      if (mover.y >= top - slop && mover.y <= top + slop) {
        if (best == null || top > best) best = top;
      }
    }
    return best;
  }

  // Build a hitbox facet from a building boundary rect. Convenience for the
  // demo — turns {u0,v0,u1,v1} into {center:{u,v}, hitbox:{w,d,h}}.
  function aabbFromRect(u0, v0, u1, v1, height) {
    return {
      u: (u0 + u1) / 2,
      v: (v0 + v1) / 2,
      hitbox: { w: Math.abs(u1 - u0), d: Math.abs(v1 - v0), h: height || 4 },
      y: 0,
    };
  }

  return {
    overlap1D, overlapsAABB,
    resolveAABBMove,
    standingOn, topOf,
    aabbFromRect,
  };
});
