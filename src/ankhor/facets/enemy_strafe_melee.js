/** enemy_strafe_melee — perpendicular dodge, 0.5x speed, hitbox 0.7 from legacy */
export default {
  priority: 32,
  tick(_t, data, dt, _r) {
    const en = data.enemy; if (!en || !en._strafeDir) {
      if (en) en._strafeDir = Math.random() > 0.5 ? 1 : -1;
      return;
    }
    const ep = { u: en.u||0, v: en.v||0 };
    const heroU = data.heroU||0, heroV = data.heroV||0;
    const heroAng = Math.atan2(heroU - ep.u, heroV - ep.v);
    const perpAng = heroAng + Math.PI * 0.5 * en._strafeDir;
    const sSpd = (en.moveSpeed||2) * 0.5;
    en.u = ep.u + Math.sin(perpAng) * sSpd * dt;
    en.v = ep.v + Math.cos(perpAng) * sSpd * dt;
    en.heading = heroAng;
  }
};
