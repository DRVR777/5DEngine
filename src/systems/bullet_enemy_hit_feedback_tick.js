// Extracted from index.html bullet physics loop.
// Handles enemy hit feedback after damage is applied and before death rewards.
export function mountBulletEnemyHitFeedbackTick({ computeHurtSfx, set, actions }) {
  function tick(en, ep, b, { nowMs, dmg, headshot, backstab, frontalBlock, isCrit }) {
    en._hpBarShowT = nowMs / 1000;
    set.hudEnemyHpDirty(true);
    en._hitFlashT = 0.08;
    set.shotsHitDelta(1);
    set.damageDealtDelta(dmg);
    set.hitMarkerUntil(nowMs + (headshot ? 200 : backstab ? 160 : frontalBlock ? 80 : isCrit ? 180 : 120));

    if (backstab) {
      actions.spawnDamageNumber(ep.u, b.posY + 0.5, ep.v, `⮕ ${dmg}`, "#ff88ff");
      actions.playSfx("tone:900:40:sine", 0.22);
    }
    if (frontalBlock) {
      actions.spawnDamageNumber(ep.u, b.posY + 0.4, ep.v, `🛡 ${dmg}`, "#aaaacc");
      actions.playSfx("tone:220:60:sawtooth", 0.28); actions.playSfx("tone:180:40:square", 0.15);
    }
    if (isCrit) {
      actions.spawnDamageNumber(ep.u, b.posY + 0.4, ep.v, `★ ${dmg}`, "#ffd166");
      actions.playSfx("tone:1400:50:sine", 0.18);
    }
    if (headshot) {
      actions.showToast("HEADSHOT!", "danger", 600);
      actions.playSfx("tone:1200:40:sine", 0.4);
      set.waveChallengeHitsDelta(1);
    } else {
      actions.playSfx("blip", 0.2);
    }

    const kbLen = Math.hypot(ep.u - b.posU, ep.v - b.posV) || 1;
    en._kbU = ((ep.u - b.posU) / kbLen) * 3.5;
    en._kbV = ((ep.v - b.posV) / kbLen) * 3.5;
    en._kbT = 0.1;
    en._flinchX = headshot ? -0.6 : -0.3;

    if (en.type !== "boss" && dmg >= en.maxHp * 0.25 && en.hp > 0) {
      en._staggerT = 0.6;
      en._staggerAngle = Math.atan2(ep.u - b.posU, ep.v - b.posV) + Math.PI + (Math.random() - 0.5) * 1.0;
    }

    const dmgColor = headshot ? "#ff0" : (en.type === "robot" ? "#0cf" : "#f44");
    actions.spawnDamageNumber(b.posU, b.posY + 1.0, b.posV, headshot ? `${dmg} HS!` : `-${dmg}`, dmgColor);
    const hitColor = en.type === "robot" ? (headshot ? "white" : "cyan") : "red";
    actions.spawnParticles(b.posU, b.posY, b.posV, headshot ? 10 : 5, hitColor, 4, 0.25);
    actions.emitParticle("impact", { x: b.posU, y: b.posY, z: b.posV });

    if (en.hp > 0 && (!en._hurtT || nowMs / 1000 - en._hurtT > 0.25)) {
      en._hurtT = nowMs / 1000;
      const { tone, vol } = computeHurtSfx({ enemyType: en.type, headshot });
      actions.playSfx(tone, vol);
    }

    if (en.type === "incendiary" && en.hp > 0) {
      if (!en._trailT || nowMs / 1000 - en._trailT > 1.0) {
        en._trailT = nowMs / 1000;
        actions.spawnFirePatch(ep.u, ep.v, 1.0, 2.2);
      }
    }
  }

  return { tick };
}
