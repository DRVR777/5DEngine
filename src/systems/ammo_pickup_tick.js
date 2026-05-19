const COLLECT_DIST  = 1.2;
const MAGNET_DIST   = 3.0;
const MAGNET_SPEED  = 8;
const BOB_SPEED     = 280;
const SPIN_SPEED    = 2.5;
const BOB_AMP       = 0.08;
const BOB_BASE      = 0.4;

const AMMO_LABELS = { pistol_9mm: "9MM", rifle_556: "5.56", smg_9mm: "9MM", sniper_308: ".308", shotgun_12g: "12GA" };

export function mountAmmoPickupTick({ actions }) {
  function tick(dt, { pickups, heroU, heroV, nowMs }) {
    for (let i = pickups.length - 1; i >= 0; i--) {
      const ap = pickups[i];
      const d = Math.hypot(heroU - ap.u, heroV - ap.v);
      if (d < COLLECT_DIST) {
        pickups.splice(i, 1);
        actions.removeMesh(ap.mesh);
        actions.addAmmo(ap.ammoItem, ap.qty);
        actions.playSfx("blip", 0.5);
        actions.spawnDamageNumber(ap.u, 1.5, ap.v, `+${ap.qty} ${AMMO_LABELS[ap.ammoItem] || "AMMO"}`, "#ffaa00");
      } else {
        ap.mesh.rotation.y += dt * SPIN_SPEED;
        ap.mesh.position.y = BOB_BASE + Math.sin(nowMs / BOB_SPEED + ap.u) * BOB_AMP;
        if (d < MAGNET_DIST && d > 0) {
          const pull = MAGNET_SPEED * (1 - d / MAGNET_DIST);
          ap.u += ((heroU - ap.u) / d) * pull * dt;
          ap.v += ((heroV - ap.v) / d) * pull * dt;
          ap.mesh.position.x = ap.u;
          ap.mesh.position.z = ap.v;
        }
      }
    }
  }
  return { tick };
}
