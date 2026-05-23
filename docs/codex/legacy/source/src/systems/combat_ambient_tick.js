const AMBIENT_INTERVAL = 1.0;

export function mountCombatAmbientTick({ get, set, actions }) {
  function tick(nowSec, enemies, bossAlive, heroDead) {
    if (!actions.isAmbientReady()) return;
    if (get.ambT() > 0 && nowSec - get.ambT() < AMBIENT_INTERVAL) return;
    set.ambT(nowSec);

    actions.setAmbient("wind", 220, "sawtooth", 0.008, 2.5);

    let aliveChasing = 0, anyAlive = false;
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (e.dead) continue;
      if (e.id && e.id.startsWith("en_spawned_")) anyAlive = true;
      if (e._wasChasing) aliveChasing++;
    }

    const calmVol = (!anyAlive || aliveChasing === 0) && !bossAlive && !heroDead ? 0.024 : 0;
    actions.setAmbient("calm",  110,   "sine",     calmVol,          3.2);
    actions.setAmbient("calm2", 130.8, "sine",     calmVol * 0.65,   3.2);

    const tensionVol = Math.min(0.055, aliveChasing * 0.010);
    actions.setAmbient("tension",  bossAlive ? 38 : 55, "sine",     tensionVol,         1.8);
    actions.setAmbient("tension2", bossAlive ? 42 : 58, "triangle", tensionVol * 0.55,  1.8);
    actions.setAmbient("bossRumble", 28, "square", bossAlive ? 0.018 : 0, 2.0);
  }
  return { tick };
}
