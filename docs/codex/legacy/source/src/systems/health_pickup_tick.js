const COLLECT_DIST = 1.2;
const MAGNET_DIST  = 3.0;
const MAGNET_SPEED = 8;

export function mountHealthPickupTick({ get, set, actions }) {
  function tick(dt, { pickups, heroU, heroV, nowMs }) {
    for (let i = pickups.length - 1; i >= 0; i--) {
      const hp = pickups[i];
      const d = Math.hypot(heroU - hp.u, heroV - hp.v);
      if (d < COLLECT_DIST) {
        pickups.splice(i, 1);
        actions.removeMesh(hp.mesh);
        const maxHp = get.maxHp();
        const gained = Math.min(hp.amount, maxHp - get.heroHp());
        set.heroHp(Math.min(maxHp, get.heroHp() + hp.amount));
        actions.playSfx("tone:660:120:sine", 0.6);
        actions.spawnDamageNumber(hp.u, 1.5, hp.v, `+${Math.round(gained)} HP`, "#00ff88");
        if (gained > 0) actions.showToast(`+${Math.round(gained)} HP`, "success", 1800);
      } else {
        hp.mesh.rotation.x += dt * 1.5;
        hp.mesh.rotation.y += dt * 2.2;
        hp.mesh.position.y = 0.6 + Math.sin(nowMs / 320 + hp.u) * 0.1;
        if (d < MAGNET_DIST && d > 0) {
          const pull = MAGNET_SPEED * (1 - d / MAGNET_DIST);
          hp.u += ((heroU - hp.u) / d) * pull * dt;
          hp.v += ((heroV - hp.v) / d) * pull * dt;
          hp.mesh.position.x = hp.u;
          hp.mesh.position.z = hp.v;
        }
      }
    }
  }
  return { tick };
}
