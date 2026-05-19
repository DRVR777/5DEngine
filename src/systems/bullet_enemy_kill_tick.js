// Extracted from index.html bullet physics loop.
// Handles bullet-caused enemy death rewards and side effects.
export function mountBulletEnemyKillTick({
  enemies,
  coinByType,
  weaponDropMap,
  levelThresholds,
  get,
  set,
  actions,
}) {
  function tick(en, ep, { nowMs, headshot }) {
    en.hp = 0;
    en.dead = true;
    en.respawnT = nowMs / 1000;
    en._wasChasing = false;

    if (headshot) set.bulletTimeLeft(Math.max(get.bulletTimeLeft(), 0.22));
    set.killMarkerUntil(nowMs + 300);
    set.killMarkerHs(headshot);

    if (en.type === "boss") {
      set.liveBoss(null);
      actions.playSfx("tone:260:200:sine", 0.6); actions.playSfx("tone:330:180:sine", 0.5); actions.playSfx("tone:440:220:sine", 0.45);
    } else if (en.type === "heavy") {
      actions.playSfx("tone:55:400:sawtooth", 0.5); actions.playSfx("tone:80:200:sawtooth", 0.3);
    } else if (en.type === "robot") {
      actions.playSfx("tone:180:120:square", 0.3); actions.playSfx("tone:360:80:square", 0.2);
    } else if (en.type === "sniper") {
      actions.playSfx("tone:500:80:sine", 0.25); actions.playSfx("tone:250:120:sine", 0.2);
    } else {
      actions.playSfx("tone:90:180:sawtooth", 0.22);
    }

    actions.spawnDecal(ep.u, ep.v, en.type === "robot" ? "oil" : "blood");
    if (en.type === "incendiary") actions.spawnFirePatch(ep.u, ep.v);
    if (en.type === "poisoner") actions.spawnPoisonPuddle(ep.u, ep.v);

    let enemyKills = get.enemyKills() + 1;
    set.enemyKills(enemyKills);

    if (get.heroLevel() < 5 && enemyKills >= levelThresholds[get.heroLevel()]) {
      const nextLevel = get.heroLevel() + 1;
      set.heroLevel(nextLevel);
      actions.applyLevelUpBuff(nextLevel);
    }

    if (get.heroApexMode()) set.stamina(Math.min(get.staminaMax() + get.heroExtraStaminaMax(), get.stamina() + 5));

    if (en._elite) {
      set.score(get.score() + 15);
      set.heroArmor(Math.min(get.heroMaxArmor(), get.heroArmor() + 20));
      actions.showToast("★ ELITE DOWN! +15 coins +20 armor!", "success", 2500);
      actions.addKillFeedEntry("★★ ELITE ELIMINATED", "#ffd700");
      actions.playSfx("tone:1600:100:sine", 0.55); actions.playSfx("tone:2000:80:sine", 0.45);
    }

    const nowSec = nowMs / 1000;
    let streakCount = nowSec - get.lastKillT() < get.streakWindow() ? get.streakCount() + 1 : 1;
    set.streakCount(streakCount);
    set.lastKillT(nowSec);

    const comboCount = get.comboCount() + 1;
    set.comboCount(comboCount);
    set.comboLastT(nowSec);

    const streakMsgs = { 3: "TRIPLE KILL! +3 bonus coins", 5: "RAMPAGE! +5 bonus coins", 10: "UNSTOPPABLE! +10 bonus coins" };
    if (streakMsgs[streakCount]) {
      const bonusCoins = streakCount === 3 ? 3 : streakCount === 5 ? 5 : 10;
      set.score(get.score() + bonusCoins);
      actions.showToast(streakMsgs[streakCount], "success", 2200);
      actions.playSfx("tone:1400:120:sine", 0.6);
    } else {
      actions.showToast(`Enemy down — ${enemyKills} kill${enemyKills>1?"s":""}`, "danger", 1800);
    }
    actions.addKillFeedEntry(`★ KILL #${enemyKills} — ${en.type || "enemy"}`, "#ff4466");

    if (get.heroHp() < get.heroMaxHp() * 0.4 && !get.heroDead()) {
      set.heroHp(Math.min(get.heroMaxHp(), get.heroHp() + 8));
      actions.spawnDamageNumber(ep.u, 2.2, ep.v, "+8 HP", "#00ff88");
    }

    actions.trackKillAndPanic(ep.u, ep.v);
    actions.emitEnemyKilled(en.id, enemyKills);
    actions.completeQuestStep("combat", 0);
    if (enemyKills >= 3) actions.completeQuestStep("combat", 1);

    const waveState = actions.getWaveState();
    if (waveState) {
      const phase = waveState.phase;
      if (phase === "waiting" || phase === "spawning") {
        const alive = enemies.filter(e => !e.dead && e.id.startsWith("en_spawned_")).length;
        if (alive === 0) {
          set.bulletTimeLeft(Math.max(get.bulletTimeLeft(), 0.55));
          actions.playSfx("tone:1200:60:sine", 0.5); actions.playSfx("tone:1600:50:sine", 0.4);
        }
      }
    }

    actions.spawnAmmoPickup(ep.u, ep.v, en.dropQty || 12, en.dropAmmo);
    if ((en.dropHealth || 0) > 0) actions.spawnHealthPickup(ep.u, ep.v, en.dropHealth);
    const coinVal = coinByType[en.type] || 1;
    const coinMul = Math.min(8, comboCount);
    if (coinMul > 1) actions.spawnDamageNumber(ep.u, 2.4, ep.v, `x${coinMul}`, "#ffd166");
    actions.spawnCoinDrop(ep.u, ep.v, coinVal * coinMul);
    if (weaponDropMap[en.type]) actions.spawnWeaponPickup(ep.u + 0.5, ep.v + 0.5, weaponDropMap[en.type]);

    if (en.type === "boss" || en.type === "heavy" || en.type === "robot") {
      const blastColor = en.type === "robot" ? "cyan" : en.type === "boss" ? "red" : "orange";
      const pCount = en.type === "boss" ? 150 : 50;
      actions.spawnParticles(ep.u, 0.5, ep.v, pCount, blastColor, 14, 1.2);
      actions.spawnParticles(ep.u, 1.5, ep.v, pCount / 2, "white", 10, 0.8);
      if (en.type === "boss") {
        actions.spawnParticles(ep.u, 2.5, ep.v, 80, "orange", 18, 2.0);
        actions.applyScreenShake(1.0);
        set.score(get.score() + 50);
        actions.showToast("★ BOSS DEFEATED! +50 coins!", "success", 4000);
        actions.addKillFeedEntry("★★ BOSS DEFEATED ★★", "#ffd166");
        set.bulletTimeLeft(Math.max(get.bulletTimeLeft(), 0.6));
      } else if (en.type === "robot") {
        actions.applyScreenShake(0.6);
        set.bulletTimeLeft(Math.max(get.bulletTimeLeft(), 0.4));
      } else if (en.type === "heavy") {
        actions.applyScreenShake(0.4);
        set.bulletTimeLeft(Math.max(get.bulletTimeLeft(), 0.25));
      }
      set.vignetteAmt(Math.min(1, get.vignetteAmt() + (en.type === "boss" ? 0.9 : 0.4)));
      actions.playSfx(`tone:${en.type==="robot"?300:en.type==="boss"?50:200}:${en.type==="boss"?800:180}:sawtooth`, 0.6);
      actions.showToast(`${en.type === "robot" ? "ROBOT" : "HEAVY"} ELIMINATED!`, "danger", 2000);
      if (en.type === "boss" || en.type === "heavy") actions.spawnArmorShard(ep.u, ep.v, en.type === "boss" ? 40 : 22);
    } else {
      actions.spawnParticles(ep.u, 1.2, ep.v, 18, "orange", 7, 0.5);
      actions.emitParticle("sparks", { x: ep.u, y: 1.2, z: ep.v });
      actions.playSfx("tone:880:80:sine", 0.4);
    }
  }

  return { tick };
}
