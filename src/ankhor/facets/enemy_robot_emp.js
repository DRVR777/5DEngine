/** enemy_robot_emp — cd 8s, trigger 12m, emp 4m/2.5s from legacy */
const EMP_CD = 8.0;
const EMP_TRIGGER_RANGE = 12;
const EMP_RADIUS = 4;
const EMP_DUR = 2.5;

export default {
  priority: 36,
  tick(_t, data, dt, _r) {
    const en = data.enemy; if (!en || en.type !== "robot") return;
    if (data.canSee === false) return;
    const dist = data.dist || Infinity;
    if (dist >= EMP_TRIGGER_RANGE) return;
    const nowSec = data.nowSec || Date.now() / 1000;
    if (en._empT && nowSec - en._empT <= EMP_CD) return;
    en._empT = nowSec;

    data.empBurst = { u: en.u, v: en.v, radius: EMP_RADIUS, maxR: 8, dur: 0.7, opacity: 0.9 };

    if (dist < EMP_RADIUS && (data.heroHp || 100) > 0 && !data.godMode) {
      data.heroEmpT = EMP_DUR;
      data.empHit = { u: en.u, v: en.v };
    }
  }
};
