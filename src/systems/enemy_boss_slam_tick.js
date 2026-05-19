// Boss ground slam: AoE shockwave + hero damage every 5s (2.8s enraged) within 4m.
// ARMOR_ABSORB, getHeroPos, getEnemyPos, enemies are raw materials bound at mount.
// Magic numbers: slamRadius=5, slamDmg=50, friendlyFireDmg=30, friendlyFireRadius=slamRadius*0.6.
export function mountEnemyBossSlamTick({ ARMOR_ABSORB, getHeroPos, getEnemyPos, enemies, actions }) {
  function tick(dt, en, { canSee, dist, ep, nowSec, dodgeT, heroDead, godMode, heroHp, heroArmor }) {
    if (en.type !== "boss" || !canSee || dist >= 4) return;
    const cooldown = en._enraged ? 2.8 : 5.0;
    if (en._slamT && nowSec - en._slamT <= cooldown) return;
    en._slamT = nowSec;
    actions.playSfx("tone:40:500:sawtooth", 1.0);
    actions.screenShake(0.6);
    actions.spawnParticles(ep.u, 0.1, ep.v, 80, "red", 10, 1.5);
    actions.spawnParticles(ep.u, 0.5, ep.v, 40, "orange", 8, 1.2);
    actions.spawnShockwave(ep.u, ep.v);
    const slamRadius = 5;
    const slamDmg = 50;
    const shm = getHeroPos();
    const shd = Math.hypot(shm.u - ep.u, shm.v - ep.v);
    if (shd < slamRadius && dodgeT <= 0 && !heroDead && !godMode) {
      const hd2 = Math.round(slamDmg * (1 - shd / slamRadius));
      if (hd2 > 0) {
        let sdmg = hd2;
        if (heroArmor > 0) {
          const a = Math.min(heroArmor, sdmg * ARMOR_ABSORB);
          actions.setHeroArmor(Math.max(0, heroArmor - a));
          sdmg -= a;
        }
        actions.setHeroHp(Math.max(0, heroHp - sdmg));
        actions.setHeroLastDamageT(nowSec);
        actions.flashDamage();
        if (heroHp - sdmg <= 0) actions.onHeroDeath();
      }
    }
    for (const en2 of enemies) {
      if (en2.dead || en2.id === en.id) continue;
      const ep2 = getEnemyPos(en2.id);
      if (Math.hypot(ep2.u - ep.u, ep2.v - ep.v) < slamRadius * 0.6) {
        en2.hp = Math.max(0, en2.hp - 30);
      }
    }
  }
  return { tick };
}
