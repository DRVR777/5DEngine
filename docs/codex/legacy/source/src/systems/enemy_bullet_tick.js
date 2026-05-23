const HIT_RADIUS_SQ = 0.36;  // 0.6m radius
const HIT_HEIGHT    = 0.9;
const MISS_RADIUS_SQ = 2.25; // 1.5m near-miss
const MISS_HEIGHT    = 1.2;
const MISS_COOLDOWN  = 0.5;

export function mountEnemyBulletTick({ get, set, actions }) {
  let missSndT = 0;

  function tick(dt, { bullets, heroDead }) {
    const hp = get.heroPos();
    if (!hp) return;
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.posU += b.dirU * b.speed * dt;
      b.posV += b.dirV * b.speed * dt;
      b.posY += b.dirY * b.speed * dt;
      b.traveled += b.speed * dt;
      b.mesh.position.set(b.posU, b.posY, b.posV);

      const du = hp.u - b.posU, dv = hp.v - b.posV, dh = (hp.y + 1.0) - b.posY;
      if (du * du + dv * dv < HIT_RADIUS_SQ && Math.abs(dh) < HIT_HEIGHT) {
        if (!heroDead && get.dodgeT() <= 0 && !get.godMode()) {
          let dmg = b.damage;
          const armor = get.heroArmor();
          if (armor > 0) {
            const absorbed = Math.min(armor, dmg * get.armorAbsorb());
            set.heroArmor(Math.max(0, armor - absorbed));
            dmg -= absorbed;
          }
          set.heroHp(Math.max(0, get.heroHp() - dmg));
          set.lastDamageT(get.nowSec());
          set.dmgDirAngle(Math.atan2(-b.dirU, -b.dirV));
          set.dmgDirUntil(get.nowMs() + 1200);
          actions.flashDamage();
          actions.applyScreenShake(Math.min(0.35, dmg / 55));
          actions.spawnParticles(b.posU, b.posY, b.posV, 4, b.poisonOnHit ? "white" : "cyan", 3, 0.18);
          if (b.poisonOnHit) actions.applyPoison();
          if (get.heroHp() <= 0) actions.showDeathScreen();
        }
        actions.removeMesh(b.mesh);
        bullets.splice(i, 1);
        continue;
      }

      if (missSndT <= 0 && du * du + dv * dv < MISS_RADIUS_SQ && Math.abs(dh) < MISS_HEIGHT && !heroDead) {
        missSndT = MISS_COOLDOWN;
        actions.playSfx("tone:2800:18:sine", 0.12);
      }
      if (b.traveled >= b.range) {
        actions.removeMesh(b.mesh);
        bullets.splice(i, 1);
      }
    }
    missSndT = Math.max(0, missSndT - dt);
  }
  return { tick };
}
