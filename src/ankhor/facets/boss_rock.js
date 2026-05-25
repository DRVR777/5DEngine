/** boss_rock — throw cooldowns, rock spec, trajectory intent from legacy */
export default {
  priority: 55,
  tick(_t, data, dt, _r) {
    const en = data.boss; if (!en || en.type !== "boss") return;
    const canSee = data.canSee, dist = data.dist;
    if (!canSee || dist < 5 || dist >= 15) return;
    const cooldown = en._enraged ? 3.5 : 6.0;
    const nowSec = data.nowSec || Date.now() / 1000;
    if (en._rockT && nowSec - en._rockT <= cooldown) return;
    en._rockT = nowSec;
    const rspeed = dist / 1.8;
    const throwAng = Math.atan2(data.heroU - en.u, data.heroV - en.v);
    // Rock intent — adapter spawns mesh/plays sfx
    data.rockThrown = {
      u: en.u, y: (en.y || 0) + 2.0, v: en.v,
      velU: Math.sin(throwAng) * rspeed,
      velV: Math.cos(throwAng) * rspeed,
      velY: Math.abs(data.gravity || -9.8) * 1.8 / 2,
      fuse: 2.3, _isBossRock: true,
      geometry: "dodecahedron", radius: 0.42,
      color: 0x555544, roughness: 1.0, metalness: 0.1,
    };
  }
};
