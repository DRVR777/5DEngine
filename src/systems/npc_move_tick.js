const FLEE_RANGE  = 8;
const FLEE_DUR    = 2.5;
const FLEE_SPEED  = 7;
const PROX_RANGE  = 2.5;
const ARENA_CLAMP = 30;

export function mountNpcMoveTick({ actions }) {
  function tick(dt, { nowMs, heroU, heroV, npcDefs, npcMeshes, dialogOpen, lastHeroShotT }) {
    const nowSec = nowMs / 1000;
    for (const n of npcDefs) {
      const m = npcMeshes.get(n.id);
      if (!m) continue;
      const np = actions.getPos(n.id);
      if (nowSec - lastHeroShotT < 0.12 && Math.hypot(np.u - heroU, np.v - heroV) < FLEE_RANGE) {
        n._fleeT = FLEE_DUR;
        n._fleeAng = Math.atan2(np.u - heroU, np.v - heroV);
      }
      if (!dialogOpen) {
        if ((n._fleeT || 0) > 0) {
          n._fleeT -= dt;
          actions.setPos(n.id, np.x, np.y, np.z,
            np.u + Math.sin(n._fleeAng) * FLEE_SPEED * dt,
            np.v + Math.cos(n._fleeAng) * FLEE_SPEED * dt);
          m.heading = n._fleeAng;
        } else {
          m.heading = actions.wanderStep(n.id, m.heading, n.wanderSpeed || 2.2, dt);
        }
      }
      actions.clampToArena(n.id, ARENA_CLAMP);
      if (m.ring) {
        const np2 = actions.getPos(n.id);
        const dist = Math.hypot(heroU - np2.u, heroV - np2.v);
        const ringTarget = dist < PROX_RANGE ? (0.5 + 0.3 * Math.sin(nowMs / 300)) : 0;
        m.ring.material.opacity += (ringTarget - m.ring.material.opacity) * Math.min(1, dt * 6);
      }
      const rp = actions.toRenderPos(n.id);
      m.group.position.set(rp.x, rp.y, rp.z);
      m.group.rotation.y = m.heading;
    }
  }
  return { tick };
}
