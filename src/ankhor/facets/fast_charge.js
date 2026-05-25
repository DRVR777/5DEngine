/** fast_charge — charge trigger, cooldowns, direction from legacy mountEnemyFastChargeTick */
const DIST_MIN = 2.0;
const DIST_MAX = 8;
const CD_BASE = 3.5;
const CD_RANGE = 2.0;
const CD_DEFAULT = 4.0;
const CHARGE_DUR = 0.38;
const SPEED_MUL = 2.2;
const HITBOX_W = 0.7;
const HITBOX_D = 0.7;

export default {
  priority: 38,
  tick(_t, data, dt, _r) {
    const en = data.enemy; if (!en || en.type !== "fast") return;
    if (!data._init) { data._init = true; en._chargeCD = en._chargeCD || 0; en._chargeInterval = en._chargeInterval || CD_DEFAULT; }

    const canSee = data.canSee !== false, dist = data.dist || Infinity;
    const ep = { u: en.u || 0, v: en.v || 0, y: en.y || 0 };
    const dx = (data.heroU || 0) - ep.u, dz = (data.heroV || 0) - ep.v;
    const nowSec = data.nowSec || Date.now() / 1000;

    // Trigger charge
    if (canSee && dist > DIST_MIN && dist < DIST_MAX) {
      if (!en._chargeCD || nowSec - en._chargeCD > en._chargeInterval) {
        en._chargeCD = nowSec;
        en._chargeInterval = CD_BASE + Math.random() * CD_RANGE;
        en._chargeDur = CHARGE_DUR;
        en._chargeDirU = dx / (dist || 1);
        en._chargeDirV = dz / (dist || 1);
        data.chargeStarted = { u: ep.u, v: ep.v, dirU: en._chargeDirU, dirV: en._chargeDirV };
      }
    }

    // Execute charge movement
    if ((en._chargeDur || 0) > 0) {
      en._chargeDur -= dt;
      const speed = (en.moveSpeed || 5) * SPEED_MUL;
      en._chargeU = (en._chargeU || ep.u) + (en._chargeDirU || 0) * speed * dt;
      en._chargeV = (en._chargeV || ep.v) + (en._chargeDirV || 0) * speed * dt;
      en.u = en._chargeU;
      en.v = en._chargeV;
      data.chargeActive = { u: en.u, v: en.v, hitboxW: HITBOX_W, hitboxD: HITBOX_D, durLeft: en._chargeDur };
    }
  }
};
