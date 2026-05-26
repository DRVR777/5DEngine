/** enemy_incendiary — cd 5s/3.5s, 3-10m, tof 1.4 from legacy */
const INC_CD = 5.0;
const INC_CD_ENRAGED = 3.5;
const INC_MIN = 3;
const INC_MAX = 10;
const TOF = 1.4;

export default {
  priority: 34,
  tick(_t, data, dt, _r) {
    const en = data.enemy; if (!en || en.type !== "incendiary") return;
    if (data.canSee === false) return;
    const dist = data.dist || Infinity;
    if (dist <= INC_MIN || dist >= INC_MAX) return;
    const nowSec = data.nowSec || Date.now() / 1000;
    const cd = en._enraged ? INC_CD_ENRAGED : INC_CD;
    if (en._incT && nowSec - en._incT <= cd) return;
    en._incT = nowSec;

    const fspeed = dist / TOF;
    const throwAng = Math.atan2((data.heroU||0)-(en.u||0), (data.heroV||0)-(en.v||0));
    data.incGrenade = {
      u: en.u||0, y: (en.y||0)+1.2, v: en.v||0,
      velU: Math.sin(throwAng)*fspeed, velV: Math.cos(throwAng)*fspeed,
      velY: Math.abs(data.gravity||-9.8)*TOF/2,
      fuse: TOF+0.25, radius: 0.15, color: 0xff6600,
    };
  }
};
