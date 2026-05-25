/** boss_slam — slamRadius=5, slamDmg=50, friendlyFireDmg=30, cooldowns from legacy */
const SLAM_RADIUS = 5;
const SLAM_DMG = 50;
const FF_RADIUS = SLAM_RADIUS * 0.6;
const FF_DMG = 30;

export default {
  priority: 55,
  tick(_t, data, dt, _r) {
    const en = data.boss; if (!en || en.type !== "boss") return;
    const canSee = data.canSee, dist = data.dist;
    if (!canSee || dist >= 4) return;
    const cooldown = en._enraged ? 2.8 : 5.0;
    const nowSec = data.nowSec || Date.now() / 1000;
    if (en._slamT && nowSec - en._slamT <= cooldown) return;
    en._slamT = nowSec;

    // Hero damage
    const shd = Math.hypot((data.heroU||0) - en.u, (data.heroV||0) - en.v);
    if (shd < SLAM_RADIUS && (data.dodgeT||0) <= 0 && (data.heroHp||100) > 0 && !data.godMode) {
      const rawDmg = Math.round(SLAM_DMG * (1 - shd / SLAM_RADIUS));
      if (rawDmg > 0) {
        let sdmg = rawDmg;
        const armor = data.heroArmor || 0;
        if (armor > 0) {
          const a = Math.min(armor, sdmg * (data.armorAbsorb || 0.5));
          data.heroArmor = Math.max(0, armor - a);
          sdmg -= a;
        }
        data.heroHp = Math.max(0, (data.heroHp||100) - sdmg);
        data.hitEvents = data.hitEvents || [];
        data.hitEvents.push({ dmg: sdmg, source: "boss_slam", u: en.u, v: en.v });
        if (data.heroHp <= 0) data.heroDead = true;
      }
    }

    // Friendly fire to nearby enemies
    for (const en2 of data.enemies || []) {
      if (en2 === en || en2.dead || en2.hp <= 0) continue;
      const fd = Math.hypot((en2.u||0) - en.u, (en2.v||0) - en.v);
      if (fd < FF_RADIUS) {
        en2.hp = Math.max(0, en2.hp - Math.round(FF_DMG * (1 - fd / FF_RADIUS)));
        if (en2.hp <= 0) {
          en2.dead = true;
          data.kills = data.kills || [];
          data.kills.push({ enemyId: en2.id, u: en2.u, v: en2.v, source: "boss_slam" });
        }
      }
    }

    data.slamEvent = { u: en.u, v: en.v, radius: SLAM_RADIUS };
  }
};
