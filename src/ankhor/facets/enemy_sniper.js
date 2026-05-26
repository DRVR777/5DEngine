/** enemy_sniper — retreat phase, lockon 2.8s, phase cycle 4s from legacy */
export default {
  priority: 32,
  tick(_t, data, dt, _r) {
    const en = data.enemy; if (!en || en.type !== "sniper") return;
    const nowSec = data.nowSec || Date.now()/1000;
    if (!en._sniperPhaseT) en._sniperPhaseT = nowSec;
    const snPhase = (nowSec - en._sniperPhaseT) % 4.0;
    data.sniperPhase = snPhase;
    data.sniperLockon = snPhase >= 2.8;

    if (!data.sniperLockon && data.canSee !== false) {
      // Retreat
      const ep = { u: en.u||0, v: en.v||0 };
      const heroU = data.heroU||0, heroV = data.heroV||0;
      const fAng = Math.atan2(ep.u - heroU, ep.v - heroV);
      const speed = (en.moveSpeed||2) * 0.6;
      en.u = ep.u + Math.sin(fAng) * speed * dt;
      en.v = ep.v + Math.cos(fAng) * speed * dt;
    }
  }
};
