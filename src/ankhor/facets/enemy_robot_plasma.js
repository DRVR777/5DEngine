/** enemy_robot_plasma — cd 1.5s, range 10m, speed 14, dmg 12 from legacy */
const PLASMA_CD = 1.5;
const PLASMA_RANGE = 10;
const PLASMA_SPEED = 14;
const PLASMA_DMG = 12;
const PLASMA_MAX_RANGE = 12;

export default {
  priority: 36,
  tick(_t, data, dt, _r) {
    const en = data.enemy; if (!en || en.type !== "robot") return;
    if (data.canSee === false) return;
    const dist = data.dist || Infinity;
    if (dist >= PLASMA_RANGE) return;
    const nowSec = data.nowSec || Date.now() / 1000;
    if (en._lastShootT && nowSec - en._lastShootT <= PLASMA_CD) return;
    en._lastShootT = nowSec;

    const ang = Math.atan2((data.heroU || 0) - (en.u || 0), (data.heroV || 0) - (en.v || 0));
    const pitch = Math.atan2(1.1, dist);
    const cosP = Math.cos(pitch);

    data.plasmaBolt = {
      u: en.u || 0, y: (en.y || 0) + 1.3, v: en.v || 0,
      dirU: Math.sin(ang) * cosP,
      dirV: Math.cos(ang) * cosP,
      dirY: Math.sin(pitch),
      speed: PLASMA_SPEED, damage: PLASMA_DMG, range: PLASMA_MAX_RANGE,
      radius: 0.1, color: 0x00ccff,
    };
  }
};
