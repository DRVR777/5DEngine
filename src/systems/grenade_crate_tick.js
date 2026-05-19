const COLLECT_DIST = 1.3;
const RESTOCK_AMT  = 3;
const MAX_GRENADES = 9;
const RESPAWN_DUR  = 30;
const SPIN_SPEED   = 0.8;
const BOB_BASE     = 0.2;
const BOB_AMP      = 0.04;
const BOB_PERIOD   = 700;

export function mountGrenadeCrateTick({ get, set, actions }) {
  function tick(dt, { crates, heroU, heroV, nowSec, nowMs }) {
    for (const gc of crates) {
      if (!gc.active) {
        gc.mesh.visible = false;
        if (nowSec - gc.respawnT > RESPAWN_DUR) { gc.active = true; gc.mesh.visible = true; }
        continue;
      }
      const d = Math.hypot(heroU - gc.u, heroV - gc.v);
      if (d < COLLECT_DIST) {
        gc.active = false;
        gc.respawnT = nowSec;
        const newCount = Math.min(MAX_GRENADES, get.grenadeCount() + RESTOCK_AMT);
        set.grenadeCount(newCount);
        actions.playSfx("tone:550:100:sine", 0.5);
        actions.showToast(`+${RESTOCK_AMT} grenades (${newCount} total)`, "success", 1500);
      } else {
        gc.mesh.rotation.y += dt * SPIN_SPEED;
        gc.mesh.position.y = BOB_BASE + Math.sin(nowMs / BOB_PERIOD + gc.u) * BOB_AMP;
      }
    }
  }
  return { tick };
}
