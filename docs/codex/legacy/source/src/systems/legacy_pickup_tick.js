const BOB_BASE   = 1.0;
const BOB_AMP    = 0.15;
const BOB_PERIOD = 300;
const SPIN_SPEED = 2;

export function mountLegacyPickupTick({ actions }) {
  function tick(dt, { pickups, nowMs }) {
    const collected = actions.collectPickup();
    if (collected) actions.onCollected(collected);
    for (const pk of pickups) {
      if (pk.collected) continue;
      const mesh = actions.getMesh(pk.id);
      if (!mesh) continue;
      mesh.position.y = BOB_BASE + Math.sin(nowMs / BOB_PERIOD + pk.u) * BOB_AMP;
      mesh.rotation.y += dt * SPIN_SPEED;
    }
  }
  return { tick };
}
