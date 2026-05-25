/** fire_patch — all 12 constants + tick from legacy mountFirePatchTick */
const HERO_DMG_INTERVAL   = 0.5;
const HERO_DMG_AMOUNT     = 6;
const HERO_FIRE_DUR       = 2.5;
const ENEMY_DMG_INTERVAL  = 0.5;
const ENEMY_DMG_AMOUNT    = 8;
const BARREL_DMG_INTERVAL = 0.5;
const BARREL_DMG_AMOUNT   = 8;
const BARREL_RADIUS_EXTRA = 0.4;
const FADE_WINDOW         = 1.5;
const OPACITY_BASE        = 0.55;
const FLICKER_AMP         = 0.2;
const FLICKER_PERIOD      = 120;

export default {
  priority: 55,
  tick(_t, data, dt, _r) {
    const patches = data.patches; if (!patches || !patches.length) return;
    const heroU = data.heroU || 0, heroV = data.heroV || 0;
    const nowMs = data.nowMs || Date.now();
    const enemies = data.enemies || [];
    const barrels = data.barrels || [];
    for (let i = patches.length - 1; i >= 0; i--) {
      const fp = patches[i];
      fp.timeLeft -= dt;
      if (fp.timeLeft <= 0) { patches.splice(i, 1); continue; }
      
      // Fade opacity intent (adapter reads this)
      fp.opacity = OPACITY_BASE * Math.min(1, fp.timeLeft / FADE_WINDOW)
        * (1 - FLICKER_AMP + FLICKER_AMP * Math.sin(nowMs / FLICKER_PERIOD));

      // Hero damage
      if (Math.hypot(heroU - fp.u, heroV - fp.v) < (fp.radius || 1)) {
        fp.dmgT = (fp.dmgT || 0) - dt;
        if (fp.dmgT <= 0) {
          fp.dmgT = HERO_DMG_INTERVAL;
          data.heroHp = Math.max(0, (data.heroHp || 100) - HERO_DMG_AMOUNT);
          data.heroFireT = Math.max(data.heroFireT || 0, HERO_FIRE_DUR);
          data.heroDmgEvent = data.heroDmgEvent || [];
          data.heroDmgEvent.push({ amount: HERO_DMG_AMOUNT, source: "fire" });
        }
      }

      // Enemy damage
      for (const en of enemies) {
        if (en.dead || en.hp <= 0) continue;
        if (Math.hypot((en.u||0) - fp.u, (en.v||0) - fp.v) < (fp.radius || 1)) {
          en._fireDmgT = (en._fireDmgT || 0) - dt;
          if (en._fireDmgT <= 0) {
            en._fireDmgT = ENEMY_DMG_INTERVAL;
            en.hp = Math.max(0, en.hp - ENEMY_DMG_AMOUNT);
            en._hitFlashT = 0.06;
            data.dmgNumbers = data.dmgNumbers || [];
            data.dmgNumbers.push({ u: en.u, y: 1.8, v: en.v, text: String(ENEMY_DMG_AMOUNT), color: "#ff6600" });
            if (en.hp <= 0 && !en.dead) {
              en.dead = true;
              data.kills = data.kills || [];
              data.kills.push({ enemyId: en.id, u: en.u, v: en.v });
            }
          }
        }
      }

      // Barrel damage
      for (const bar of barrels) {
        if (bar.exploded) continue;
        if (Math.hypot((bar.u||0) - fp.u, (bar.v||0) - fp.v) < (fp.radius || 1) + BARREL_RADIUS_EXTRA) {
          bar._fireDmgT = (bar._fireDmgT || 0) - dt;
          if (bar._fireDmgT <= 0) {
            bar._fireDmgT = BARREL_DMG_INTERVAL;
            bar.hp = Math.max(0, (bar.hp || 20) - BARREL_DMG_AMOUNT);
            if (bar.hp <= 0) {
              bar.exploded = true;
              data.barrelExplosions = data.barrelExplosions || [];
              data.barrelExplosions.push({ u: bar.u, v: bar.v });
            }
          }
        }
      }
    }
  }
};
