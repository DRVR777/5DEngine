const COLLECT_DIST     = 1.2;
const BOOST_DUR        = 4.0;
const SPIN_SPEED       = 3.5;
const BOB_BASE         = 0.7;
const BOB_AMP          = 0.18;
const BOB_PERIOD       = 280;
const EMISSIVE_BASE    = 0.7;
const EMISSIVE_AMP     = 0.3;
const EMISSIVE_PERIOD  = 120;

export function mountSpeedOrbTick({ set, actions }) {
  function tick(dt, { pickups, heroU, heroV, nowMs, heroDead }) {
    for (let i = pickups.length - 1; i >= 0; i--) {
      const orb = pickups[i];
      if (orb.collected) { pickups.splice(i, 1); continue; }
      const d = Math.hypot(heroU - orb.u, heroV - orb.v);
      if (d < COLLECT_DIST && !heroDead) {
        orb.collected = true;
        actions.removeMesh(orb.mesh);
        set.speedBoostT(BOOST_DUR);
        actions.spawnParticles(orb.u, orb.mesh.position.y, orb.v, 18, "yellow", 5, 0.5);
        actions.playSfx("tone:1400:80:sine", 0.45);
        actions.playSfx("tone:1800:60:sine", 0.30);
        actions.showToast("⚡ SPEED BOOST! 4s", "warning", 2000);
      } else {
        orb.mesh.rotation.y += dt * SPIN_SPEED;
        orb.mesh.position.y = BOB_BASE + Math.sin(nowMs / BOB_PERIOD + orb.u) * BOB_AMP;
        orb.mesh.material.emissiveIntensity = EMISSIVE_BASE + EMISSIVE_AMP * Math.sin(nowMs / EMISSIVE_PERIOD);
      }
    }
  }
  return { tick };
}
