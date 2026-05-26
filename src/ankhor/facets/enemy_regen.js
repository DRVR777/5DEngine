/** enemy_regen — REGEN_RATE=4, INTERVAL=1.8, COMBAT_WINDOW=8 from legacy */
const REGEN_RATE = 4;
const REGEN_INTERVAL = 1.8;
const COMBAT_WINDOW = 8;

export default {
  priority: 28,
  tick(_t, data, dt, _r) {
    const enemies = data.enemies; if (!enemies || !enemies.length) return;
    const nowSec = data.nowSec || Date.now() / 1000;
    for (const en of enemies) {
      if (en.dead || (en.hp || 0) >= (en.maxHp || 100)) continue;
      const recentDmg = en._hpBarShowT && (nowSec - en._hpBarShowT) < COMBAT_WINDOW;
      if (!recentDmg && !en._wasChasing) {
        en.hp = Math.min(en.maxHp || 100, (en.hp || 0) + REGEN_RATE * dt);
        en._regenT = (en._regenT || 0) - dt;
        if (en._regenT <= 0) {
          en._regenT = REGEN_INTERVAL;
          data.regenNumbers = data.regenNumbers || [];
          data.regenNumbers.push({ u: en.u, y: 2.0, v: en.v, text: "+HP", color: "#00ff66" });
        }
      } else { en._regenT = 0; }
    }
  }
};
