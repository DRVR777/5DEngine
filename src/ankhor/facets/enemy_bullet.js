/** enemy_bullet — hit radius 0.6, armor absorption, hero damage from legacy mountEnemyBulletTick */
const HIT_RADIUS_SQ = 0.36;
const HIT_HEIGHT    = 0.9;
const MISS_RADIUS_SQ = 2.25;
const MISS_HEIGHT    = 1.2;
const MISS_COOLDOWN  = 0.5;

export default {
  priority: 25,
  tick(_t, data, dt, _r) {
    const bullets = data.bullets; if (!bullets || !bullets.length) return;
    const hp = data.heroPos || { u: data.heroU || 0, v: data.heroV || 0, y: (data.heroY || 0) + 1.0 };
    const heroDead = data.heroHp <= 0;
    let missSndT = data._missSndT || 0;

    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.u = (b.u || b.posU || 0) + (b.dirU || b.dx || 0) * (b.speed || 40) * dt;
      b.v = (b.v || b.posV || 0) + (b.dirV || b.dz || 0) * (b.speed || 40) * dt;
      b.y = (b.y || b.posY || 1) + (b.dirY || b.dy || 0) * (b.speed || 40) * dt;
      b.traveled = (b.traveled || 0) + (b.speed || 40) * dt;

      // Range limit
      if (b.traveled > (b.range || 50)) { bullets.splice(i, 1); continue; }

      const du = hp.u - b.u, dv = hp.v - b.v, dh = hp.y - b.y;
      const distSq = du * du + dv * dv;

      // Hit check
      if (distSq < HIT_RADIUS_SQ && Math.abs(dh) < HIT_HEIGHT) {
        if (!heroDead && (data.dodgeT || 0) <= 0 && !data.godMode) {
          let dmg = b.damage || b.dmg || 5;
          const armor = data.heroArmor || 0;
          if (armor > 0) {
            const absorbed = Math.min(armor, dmg * (data.armorAbsorb || 0.5));
            data.heroArmor = Math.max(0, armor - absorbed);
            dmg -= absorbed;
          }
          data.heroHp = Math.max(0, (data.heroHp || 100) - dmg);
          data.lastDamageT = (data.nowSec || Date.now() / 1000);
          data.dmgDirAngle = Math.atan2(-(b.dirU || b.dx), -(b.dirV || b.dz));
          data.hitEvents = data.hitEvents || [];
          data.hitEvents.push({ dmg, u: b.u, y: b.y, v: b.v, poison: !!b.poisonOnHit });
          if (b.poisonOnHit) data.poisonT = (data.poisonT || 0) + 3;
          if (data.heroHp <= 0) data.heroDead = true;
        }
        bullets.splice(i, 1);
        continue;
      }

      // Near-miss sound
      if (distSq < MISS_RADIUS_SQ && Math.abs(dh) < MISS_HEIGHT && missSndT <= 0) {
        missSndT = MISS_COOLDOWN;
        data.missEvents = data.missEvents || [];
        data.missEvents.push({ u: b.u, v: b.v });
      }
    }
    missSndT = Math.max(0, missSndT - dt);
    data._missSndT = missSndT;
    // Remove expired bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
      if ((bullets[i].traveled || 0) > (bullets[i].range || 50) || (bullets[i].ttl !== undefined && bullets[i].ttl <= 0)) {
        bullets.splice(i, 1);
      }
    }
  }
};
