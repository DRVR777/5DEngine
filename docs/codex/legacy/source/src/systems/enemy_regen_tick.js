const REGEN_RATE     = 4;
const REGEN_INTERVAL = 1.8;
const COMBAT_WINDOW  = 8;

export function mountEnemyRegenTick({ actions }) {
  function tick(dt, { nowSec, enemies }) {
    for (const en of enemies) {
      if (en.dead || en.hp >= en.maxHp) continue;
      const recentDmg = en._hpBarShowT && (nowSec - en._hpBarShowT) < COMBAT_WINDOW;
      if (!recentDmg && !en._wasChasing) {
        en.hp = Math.min(en.maxHp, en.hp + REGEN_RATE * dt);
        en._regenT = (en._regenT || 0) - dt;
        if (en._regenT <= 0) {
          en._regenT = REGEN_INTERVAL;
          const pos = actions.getPos(en.id);
          if (pos) actions.spawnDamageNumber(pos.u, 2.0, pos.v, "+HP", "#00ff66");
        }
      } else { en._regenT = 0; }
    }
  }
  return { tick };
}
