// Strafe + melee attack: perpendicular strafe while attacking, then apply damage with armor/KB/status.
// getHeroPos, getEnemyPos, resolveMove, setEnemyPos, applyStatusEffect are raw materials.
// Magic numbers: strafe defaultDur=1.5s, durBase=1.2, durRange=1.3, speedMul=0.5, hitboxW=0.7, hitboxD=0.7,
//   sfxRobot=220, sfxHeavy=70, sfxDefault=120, shakeMax=0.35, shakeDiv=55, kbDirUntilMs=1200,
//   poisonChance=0.55, burnChance=0.45, heroFireDur=3.0, kbBoss=14, kbHeavy=9, kbT=0.22.
export function mountEnemyStrafeMeleeTick({
  ARMOR_ABSORB, getHeroPos, getEnemyPos, resolveMove, setEnemyPos, applyStatusEffect, actions,
}) {
  function tick(dt, en, { nowSec, nowMs, ep, heroU, heroV, heroHp, heroArmor, godMode }) {
    // Strafe — all types except sniper/boss/robot/heavy
    if (en.type !== "sniper" && en.type !== "boss" && en.type !== "robot" && en.type !== "heavy") {
      if (!en._strafeSwitchT || nowSec - en._strafeSwitchT > (en._strafeDur || 1.5)) {
        en._strafeSwitchT = nowSec;
        en._strafeDir = Math.random() < 0.5 ? 1 : -1;
        en._strafeDur  = 1.2 + Math.random() * 1.3;
      }
      const heroAng = Math.atan2(heroU - ep.u, heroV - ep.v);
      const perpAng = heroAng + Math.PI * 0.5 * en._strafeDir;
      const sSpd    = en.moveSpeed * 0.5;
      const mover   = { u: ep.u, v: ep.v, hitbox: { w: 0.7, d: 0.7 } };
      resolveMove(mover, Math.sin(perpAng) * sSpd * dt, Math.cos(perpAng) * sSpd * dt);
      setEnemyPos(en.id, ep.x, 0, 0, mover.u, mover.v);
    }
    en.lastAttackT = nowSec;
    const gFreq = en.type === "robot" ? 220 : en.type === "heavy" ? 70 : 120;
    actions.playSfx(`tone:${gFreq}:90:sawtooth`, 0.18);
    if (!godMode) {
      let enDmg = en.damage;
      if (heroArmor > 0) {
        const a = Math.min(heroArmor, enDmg * ARMOR_ABSORB);
        actions.setHeroArmor(Math.max(0, heroArmor - a));
        enDmg -= a;
      }
      const finalHp = Math.max(0, heroHp - enDmg);
      actions.setHeroHp(finalHp);
      actions.setHeroLastDamageT(nowSec);
      actions.flashDamage();
      actions.screenShake(Math.min(0.35, enDmg / 55));
      const epAtk = getEnemyPos(en.id);
      const hpAtk = getHeroPos();
      if (epAtk && hpAtk) {
        actions.setDmgDir(Math.atan2(epAtk.u - hpAtk.u, epAtk.v - hpAtk.v), nowMs + 1200);
      }
      if (en.type === "poisoner"   && Math.random() < 0.55) applyStatusEffect("poison");
      if (en.type === "incendiary" && Math.random() < 0.45) applyStatusEffect("burning");
      if (en.type === "incendiary") actions.setHeroFireT(3.0);
      if (en.type === "heavy" || en.type === "boss") {
        const kbEp = getEnemyPos(en.id);
        const kbHp = getHeroPos();
        if (kbEp && kbHp) {
          const kbDx = kbHp.u - kbEp.u, kbDz = kbHp.v - kbEp.v;
          const kbDm = Math.hypot(kbDx, kbDz) || 1;
          const kbSpd = en.type === "boss" ? 14 : 9;
          actions.setHeroKb((kbDx / kbDm) * kbSpd, (kbDz / kbDm) * kbSpd, 0.22);
        }
      }
      if (finalHp <= 0) {
        actions.emitHeroDied(en.id);
        actions.onHeroDeath();
      }
    }
  }
  return { tick };
}
