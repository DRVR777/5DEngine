// Extracted from index.html (iter 684) — WaveManager event callbacks + Engine "wave" command.
export function mountWaveEvents({
  WaveManager, Engine, THREE, scene, ambLight, sun,
  get, set, actions,
}) {
  const {
    score: getScore, heroHp: getHeroHp, HERO_MAX_HP: getMaxHp, perkMaxHpBonus: getPerkMaxHpBonus,
    shotsFired: getShotsFired, shotsHit: getShotsHit,
    waveChallenge: getWaveChallenge, waveChallengeStart: getWaveChallengeStart,
    waveChallengeHits: getWaveChallengeHits, waveChallengeNoDmg: getWaveChallengeNoDmg,
    bulletTimeLeft: getBulletTimeLeft, enemyKills: getEnemyKills,
    crates: getCrates, barrels: getBarrels, skyboxPresets: getSkyboxPresets,
  } = get;
  const {
    score: setScore, heroHp: setHeroHp,
    waveChallenge: setWaveChallenge, waveChallengeStart: setWaveChallengeStart,
    waveChallengeHits: setWaveChallengeHits, waveChallengeNoDmg: setWaveChallengeNoDmg,
    eliteSpawnedThisWave: setEliteSpawnedThisWave,
    shotsFired: setShotsFired, shotsHit: setShotsHit, bulletTimeLeft: setBulletTimeLeft,
  } = set;
  const {
    showToast, playSfx, addKillFeedEntry, applyScreenShake, spawnSpeedOrb,
    showPerkPicker, checkHighScore, exitPointerLock,
    getWaveChallengeHud, getWaveClearBanner, getWaveClearTitle, getWaveClearSub,
    getVictoryOverlay, getVictoryStats,
  } = actions;

  function onWaveStart(w) {
    showToast(`Wave ${w} incoming!`, "danger", 3000);
    const wn = ((w - 1) % 10) + 1;
    const skyName = wn <= 3 ? "day" : wn <= 6 ? "sunset" : wn <= 9 ? "night" : "holo";
    const skyP = getSkyboxPresets()[skyName];
    if (skyP) {
      scene.background = new THREE.Color(skyP.bg);
      if (scene.fog) { scene.fog.color.set(skyP.fog); scene.fog.near = skyP.fogNear; scene.fog.far = skyP.fogFar; }
      ambLight.color.set(skyP.ambColor); ambLight.intensity = skyP.ambInt;
      sun.color.set(skyP.sunColor); sun.intensity = skyP.sunInt;
    }
    if (w >= 2) for (const cr of getCrates()) { if (cr.broken) { cr.broken = false; cr.hp = cr.maxHp; cr.mesh.visible = true; } }
    if (w >= 2) {
      const oAng = Math.random() * Math.PI * 2, oDist = 4 + Math.random() * 6;
      spawnSpeedOrb(Math.cos(oAng) * oDist, Math.sin(oAng) * oDist);
    }
    const cTypes = [
      { type: "speed", label: `Clear in ${Math.max(30, 75 - w * 5)}s`, bonus: 8, limit: Math.max(30, 75 - w * 5) },
      { type: "nodmg", label: "No damage taken", bonus: 12 },
      { type: "hs", label: "3+ headshots", bonus: 6 },
    ];
    const challenge = cTypes[Math.floor(Math.random() * cTypes.length)];
    setWaveChallenge(challenge);
    setWaveChallengeStart(performance.now() / 1000);
    setWaveChallengeHits(0);
    setWaveChallengeNoDmg(true);
    setEliteSpawnedThisWave(false);
    const chEl = getWaveChallengeHud();
    if (chEl) chEl.textContent = `CHALLENGE: ${challenge.label} (+${challenge.bonus * w} coins)`;
  }

  function onWaveEnd(w) {
    const bonus = w * 3;
    setScore(getScore() + bonus);
    setHeroHp(Math.min(getMaxHp() + getPerkMaxHpBonus(), getHeroHp() + 15));
    const acc = getShotsFired() > 0 ? getShotsHit() / getShotsFired() : 0;
    const accBonus = (acc >= 0.6 && getShotsFired() >= 5) ? Math.round(acc * w * 5) : 0;
    const accPct = Math.round(acc * 100);
    if (accBonus > 0) { setScore(getScore() + accBonus); playSfx("tone:1600:60:sine", 0.3); }
    playSfx("tone:800:100:sine", 0.5);
    playSfx("tone:1000:80:sine", 0.45);
    setTimeout(() => playSfx("tone:1300:160:sine", 0.4), 180);
    showToast(`Wave ${w} clear! +${bonus} coins +15 HP${accBonus > 0 ? ` +${accBonus} acc!` : ""}`, "success", 2800);
    addKillFeedEntry(`★ WAVE ${w} CLEAR — +${bonus} coins · ${accPct}% accuracy${accBonus > 0 ? ` +${accBonus}` : ""}`, "#00ffcc");
    const wcb = getWaveClearBanner();
    const wct = getWaveClearTitle();
    const wcs = getWaveClearSub();
    if (wcb) {
      if (wct) wct.textContent = `WAVE ${w} CLEAR`;
      if (wcs) wcs.textContent = `+${bonus} coins · +15 HP · ${accPct}% accuracy${accBonus > 0 ? ` · +${accBonus} ACCURACY BONUS!` : ""} · next wave in ${WaveManager ? (WaveManager.getState().pauseLeft || "…") : "…"}s`;
      wcb.style.display = "block";
      wcb.style.animation = "waveClearIn 2.8s ease forwards";
      setTimeout(() => { wcb.style.display = "none"; wcb.style.animation = ""; }, 2900);
    }
    const challenge = getWaveChallenge();
    if (challenge) {
      const elapsed = performance.now() / 1000 - getWaveChallengeStart();
      let chMet = false;
      if (challenge.type === "speed") chMet = elapsed <= (challenge.limit || 60);
      if (challenge.type === "nodmg") chMet = getWaveChallengeNoDmg();
      if (challenge.type === "hs")    chMet = getWaveChallengeHits() >= 3;
      if (chMet) {
        const chBonus = challenge.bonus * w;
        setScore(getScore() + chBonus);
        playSfx("tone:1800:80:sine", 0.5); playSfx("tone:2200:60:sine", 0.4);
        showToast(`CHALLENGE MET: ${challenge.label} +${chBonus} coins!`, "success", 3500);
        addKillFeedEntry(`★ CHALLENGE +${chBonus}: ${challenge.label}`, "#ffd166");
      }
      setWaveChallenge(null);
      const chEl = getWaveChallengeHud();
      if (chEl) chEl.textContent = "";
    }
    setTimeout(() => showPerkPicker(w), 3200);
    setShotsFired(0); setShotsHit(0);
    for (const bar of getBarrels()) {
      if (bar.exploded) { bar.exploded = false; bar.hp = bar.maxHp; bar.mesh.visible = true; }
    }
  }

  function onAllWaves() {
    setBulletTimeLeft(0.55);
    setScore(getScore() + 30);
    playSfx("tone:1200:200:sine", 0.7);
    setTimeout(() => playSfx("tone:1500:180:sine", 0.6), 200);
    setTimeout(() => playSfx("tone:1800:300:sine", 0.55), 420);
    applyScreenShake(0.8);
    exitPointerLock();
    const vEl = getVictoryOverlay();
    const vStats = getVictoryStats();
    if (vEl && vStats) {
      const acc = getShotsFired() > 0 ? Math.round(getShotsHit() / getShotsFired() * 100) : 0;
      const newBest = checkHighScore(getEnemyKills(), 10, acc);
      vStats.innerHTML =
        (newBest ? `<div style="color:#ffd166;font-size:15px;margin-bottom:6px">★ NEW BEST SCORE! ★</div>` : "") +
        `Kills: <b style="color:#ff8888">${getEnemyKills()}</b> &nbsp;|&nbsp; ` +
        `Coins: <b style="color:#ffd166">${getScore()}</b><br>` +
        `Shots fired: <b style="color:#aaddff">${getShotsFired()}</b> &nbsp;|&nbsp; ` +
        `Accuracy: <b style="color:#aef060">${acc}%</b>`;
      vEl.style.display = "flex";
    }
  }

  WaveManager.init({ onWaveStart, onWaveEnd, onAllWaves });
  Engine.addCommand("wave", "Wave control  wave start|stop|reset|status", (args) => {
    const sub = (args[0] || "status").toLowerCase();
    if (sub === "start") { WaveManager.start(); return "Wave sequence started."; }
    if (sub === "stop")  { WaveManager.stop();  return "Wave sequence stopped."; }
    if (sub === "reset") { WaveManager.reset(); return "Wave sequence reset."; }
    const s = WaveManager.getState();
    return `wave=${s.wave}/${s.totalWaves} phase=${s.phase} alive=${s.aliveCount}`;
  });
}
