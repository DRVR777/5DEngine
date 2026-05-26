/** enemy_poisoner_spit — cd 4s, 3-10m, tof 1.1, color 0x44dd44 from legacy */
const SPIT_CD = 4.0;
const SPIT_MIN = 3;
const SPIT_MAX = 10;
const TOF = 1.1;

export default {
  priority: 34,
  tick(_t, data, dt, _r) {
    const en = data.enemy; if (!en || en.type !== "poisoner") return;
    if (data.canSee === false) return;
    const dist = data.dist || Infinity;
    if (dist <= SPIT_MIN || dist >= SPIT_MAX) return;
    const nowSec = data.nowSec || Date.now() / 1000;
    if (en._acidT && nowSec - en._acidT <= SPIT_CD) return;
    en._acidT = nowSec;

    const aspeed = dist / TOF;
    const throwAng = Math.atan2((data.heroU || 0) - (en.u || 0), (data.heroV || 0) - (en.v || 0));

    data.acidSpit = {
      u: en.u || 0, y: (en.y || 0) + 1.2, v: en.v || 0,
      velU: Math.sin(throwAng) * aspeed,
      velV: Math.cos(throwAng) * aspeed,
      velY: Math.abs(data.gravity || -9.8) * TOF / 2,
      fuse: TOF + 0.25,
      radius: 0.14, color: 0x44dd44, emissive: 0x22bb00, emissiveIntensity: 1.2,
      _isAcidSpit: true,
    };
  }
};
