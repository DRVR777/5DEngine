/** heavy_grenade — cd 4s/2.5s, dist 3.5-12m, tof 1.5s from legacy */
const CD_NORMAL = 4.0;
const CD_ENRAGED = 2.5;
const MIN_RANGE = 3.5;
const MAX_RANGE = 12;
const TOF = 1.5;

export default {
  priority: 37,
  tick(_t, data, dt, _r) {
    const en = data.enemy; if (!en || en.type !== "heavy") return;
    if (data.canSee === false) return;
    const dist = data.dist || Infinity;
    if (dist <= MIN_RANGE || dist >= MAX_RANGE) return;

    const cooldown = en._enraged ? CD_ENRAGED : CD_NORMAL;
    const nowSec = data.nowSec || Date.now() / 1000;
    if (en._grenadeT && nowSec - en._grenadeT <= cooldown) return;
    en._grenadeT = nowSec;

    const hspeed = dist / TOF;
    const throwAng = Math.atan2((data.heroU || 0) - (en.u || 0), (data.heroV || 0) - (en.v || 0));

    // Grenade throw intent — adapter spawns mesh, plays sfx
    data.grenadeThrown = {
      u: en.u || 0, y: (en.y || 0) + 1.2, v: en.v || 0,
      velU: Math.sin(throwAng) * hspeed,
      velV: Math.cos(throwAng) * hspeed,
      velY: Math.abs(data.gravity || -9.8) * TOF / 2,
      fuse: TOF + 0.3,
      geometry: "sphere", radius: 0.15, segments: 6,
      color: 0x222200, roughness: 0.8, metalness: 0.5,
      fromEnemy: en.id,
    };
  }
};
