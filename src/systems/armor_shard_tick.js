const COLLECT_DIST = 1.2;
const MAGNET_DIST  = 3.0;
const MAGNET_SPEED = 9;

export function mountArmorShardTick({ get, set, actions }) {
  function tick(dt, { pickups, heroU, heroV, nowMs }) {
    for (let i = pickups.length - 1; i >= 0; i--) {
      const as = pickups[i];
      const d = Math.hypot(heroU - as.u, heroV - as.v);
      if (d < COLLECT_DIST) {
        pickups.splice(i, 1);
        actions.removeMesh(as.mesh);
        const maxArmor = get.maxArmor();
        const gained = Math.min(as.amount, maxArmor - get.heroArmor());
        set.heroArmor(Math.min(maxArmor, get.heroArmor() + as.amount));
        actions.playSfx("tone:880:80:triangle", 0.45);
        actions.playSfx("tone:1100:60:triangle", 0.3);
        actions.spawnDamageNumber(as.u, 1.5, as.v, `+${Math.round(gained)} ARM`, "#ffd166");
        if (gained > 0) actions.showToast(`+${Math.round(gained)} ARMOR`, "success", 1800);
      } else {
        as.mesh.rotation.y += dt * 3.0;
        as.mesh.rotation.x += dt * 1.8;
        as.mesh.position.y = 0.5 + Math.sin(nowMs / 260 + as.u) * 0.12;
        if (d < MAGNET_DIST && d > 0) {
          const pull = MAGNET_SPEED * (1 - d / MAGNET_DIST);
          as.u += ((heroU - as.u) / d) * pull * dt;
          as.v += ((heroV - as.v) / d) * pull * dt;
          as.mesh.position.x = as.u;
          as.mesh.position.z = as.v;
        }
      }
    }
  }
  return { tick };
}
