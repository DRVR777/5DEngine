const COLLECT_DIST = 1.3;
const GAIN_AMT     = 25;
const RESPAWN_DUR  = 60;
const SPIN_SPEED   = 1.2;
const BOB_BASE     = 0.3;
const BOB_AMP      = 0.08;
const BOB_PERIOD   = 500;

export function mountArmorVestTick({ get, set, actions }) {
  function tick(dt, { pickups, heroU, heroV, nowSec, nowMs }) {
    for (const av of pickups) {
      if (!av.active) {
        av.mesh.visible = false;
        if (nowSec - av.respawnT > RESPAWN_DUR) { av.active = true; av.mesh.visible = true; }
        continue;
      }
      av.mesh.rotation.y += dt * SPIN_SPEED;
      av.mesh.position.y = BOB_BASE + Math.sin(nowMs / BOB_PERIOD + av.u) * BOB_AMP;
      const d = Math.hypot(heroU - av.u, heroV - av.v);
      if (d < COLLECT_DIST && get.heroArmor() < get.maxArmor()) {
        av.active = false;
        av.respawnT = nowSec;
        const gained = Math.min(GAIN_AMT, get.maxArmor() - get.heroArmor());
        set.heroArmor(Math.min(get.maxArmor(), get.heroArmor() + GAIN_AMT));
        actions.playSfx("tone:880:120:sine", 0.55);
        actions.showToast(`+${gained} armor`, "success", 1500);
      }
    }
  }
  return { tick };
}
