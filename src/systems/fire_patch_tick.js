const HERO_DMG_INTERVAL    = 0.5;
const HERO_DMG_AMOUNT      = 6;
const HERO_FIRE_DUR        = 2.5;
const ENEMY_DMG_INTERVAL   = 0.5;
const ENEMY_DMG_AMOUNT     = 8;
const BARREL_DMG_INTERVAL  = 0.5;
const BARREL_DMG_AMOUNT    = 8;
const BARREL_RADIUS_EXTRA  = 0.4;
const FADE_WINDOW          = 1.5;
const OPACITY_BASE         = 0.55;
const FLICKER_AMP          = 0.2;
const FLICKER_PERIOD       = 120;

export function mountFirePatchTick({ get, set, actions }) {
  function tick(dt, { patches, heroU, heroV, nowMs, nowSec, enemies, barrels }) {
    for (let i = patches.length - 1; i >= 0; i--) {
      const fp = patches[i];
      fp.timeLeft -= dt;
      if (fp.timeLeft <= 0) {
        actions.removeMesh(fp.mesh);
        patches.splice(i, 1);
        continue;
      }
      fp.mesh.material.opacity =
        OPACITY_BASE * Math.min(1, fp.timeLeft / FADE_WINDOW) *
        (1 - FLICKER_AMP + FLICKER_AMP * Math.sin(nowMs / FLICKER_PERIOD));

      if (Math.hypot(heroU - fp.u, heroV - fp.v) < fp.radius) {
        fp.dmgT -= dt;
        if (fp.dmgT <= 0) {
          fp.dmgT = HERO_DMG_INTERVAL;
          actions.applyBurning();
          set.heroHp(Math.max(0, get.heroHp() - HERO_DMG_AMOUNT));
          actions.applyScreenShake(0.04);
          set.heroFireT(Math.max(get.heroFireT(), HERO_FIRE_DUR));
        }
      }

      for (const en of enemies) {
        if (en.dead) continue;
        const ep = actions.getEnemyPos(en.id);
        if (!ep) continue;
        if (Math.hypot(ep.u - fp.u, ep.v - fp.v) < fp.radius) {
          en._fireDmgT = (en._fireDmgT || 0) - dt;
          if (en._fireDmgT <= 0) {
            en._fireDmgT = ENEMY_DMG_INTERVAL;
            en.hp = Math.max(0, en.hp - ENEMY_DMG_AMOUNT);
            en._hpBarShowT = nowSec;
            en._hitFlashT = 0.06;
            actions.spawnDamageNumber(ep.u, 1.8, ep.v, String(ENEMY_DMG_AMOUNT), "#ff6600");
            if (en.hp <= 0 && !en.dead) {
              en.dead = true;
              en.respawnT = nowSec;
              actions.onEnemyKill(en, ep.u, ep.v);
            }
          }
        }
      }

      for (const bar of barrels) {
        if (bar.exploded) continue;
        if (Math.hypot(bar.u - fp.u, bar.v - fp.v) < fp.radius + BARREL_RADIUS_EXTRA) {
          bar._fireDmgT = (bar._fireDmgT || 0) - dt;
          if (bar._fireDmgT <= 0) {
            bar._fireDmgT = BARREL_DMG_INTERVAL;
            bar.hp = Math.max(0, bar.hp - BARREL_DMG_AMOUNT);
            if (bar.hp <= 0) {
              bar.exploded = true;
              bar.mesh.visible = false;
              actions.explodeBarrel(bar.u, bar.v);
            }
          }
        }
      }
    }
  }
  return { tick };
}
