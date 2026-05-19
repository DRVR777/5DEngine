const BANNER_DUR_MS      = 2500;
const BANNER_HIDE_DELAY  = 200;
const COUNTDOWN_BEEP_BASE = 440;
const COUNTDOWN_BEEP_STEP = 40;
const FINAL_BEEP_FREQ    = 1100;
const SPEED_URGENT_THRESH = 10;
const HS_HEADSHOTS_NEEDED = 3;

export function mountWaveHudTick({ get, set, actions }) {
  function tick(_dt, { ws, nowMs }) {
    const waveHud = actions.getWaveHud();
    if (!waveHud) return;

    const show = ws.started && ws.phase !== "idle";
    waveHud.style.display = show ? "block" : "none";
    if (!show) {
      _tickBanner(ws, nowMs);
      return;
    }

    // Wave label (e.g. "LOOP 2 · WAVE 3/5")
    const wl = actions.getWaveLabel();
    if (wl) {
      const loopNum = ws.totalWave > ws.totalWaves ? Math.floor((ws.totalWave - 1) / ws.totalWaves) + 1 : 1;
      wl.textContent = loopNum > 1
        ? `LOOP ${loopNum} · WAVE ${ws.wave}/${ws.totalWaves}`
        : `WAVE ${ws.wave}/${ws.totalWaves}`;
    }

    // Detail text
    const det = actions.getWaveDetail();
    if (det) {
      if (ws.phase === "countdown") {
        const prevEn = (ws.enemies || []).map(g => `${g.count}× ${g.type.toUpperCase()}`).join(" · ");
        det.innerHTML = `starting in ${ws.countdown}…<br><span style="font-size:9px;color:#ff8888;letter-spacing:0.06em">${prevEn}</span>`;
        if (ws.countdown > 0 && ws.countdown !== get.waveBeepLast()) {
          set.waveBeepLast(ws.countdown);
          const freq = ws.countdown === 1 ? FINAL_BEEP_FREQ : COUNTDOWN_BEEP_BASE + (5 - ws.countdown) * COUNTDOWN_BEEP_STEP;
          actions.playSfx(`tone:${freq}:55:sine`, ws.countdown === 1 ? 0.35 : 0.18);
        }
      } else if (ws.phase === "spawning" || ws.phase === "waiting") {
        det.textContent = `${ws.aliveCount} alive`;
      } else if (ws.phase === "pausing") {
        det.textContent = `clear! next in ${ws.pauseLeft}s`;
      } else if (ws.phase === "done") {
        det.textContent = "all waves done";
      } else {
        det.textContent = "";
      }
    }

    // Level HUD
    const lvHud = actions.getLevelHud();
    if (lvHud) {
      const heroLevel = get.heroLevel();
      const levelThresholds = get.levelThresholds();
      if (heroLevel >= levelThresholds.length) {
        lvHud.textContent = "LVL MAX";
      } else {
        lvHud.textContent = `LVL ${heroLevel} (${get.enemyKills()}/${levelThresholds[heroLevel]})`;
      }
    }

    // Wave challenge HUD
    const waveChallenge = get.waveChallenge();
    if (waveChallenge && (ws.phase === "spawning" || ws.phase === "waiting")) {
      const chHud = actions.getChallengeHud();
      if (chHud) {
        const bonus = waveChallenge.bonus * ws.wave;
        if (waveChallenge.type === "speed") {
          const chLeft = Math.max(0, (waveChallenge.limit || 60) - (nowMs / 1000 - get.waveChallengeStart()));
          const urgent = chLeft < SPEED_URGENT_THRESH;
          chHud.style.color = urgent ? "#ff4444" : "#ffd166";
          chHud.textContent = `CHALLENGE: ${waveChallenge.label} (+${bonus}) — ${chLeft.toFixed(1)}s`;
        } else if (waveChallenge.type === "hs") {
          const hits = get.waveChallengeHits();
          chHud.style.color = hits >= HS_HEADSHOTS_NEEDED ? "#00ff88" : "#ffd166";
          chHud.textContent = `CHALLENGE: ${waveChallenge.label} (+${bonus}) — ${hits}/${HS_HEADSHOTS_NEEDED}`;
        }
      }
    }

    _tickBanner(ws, nowMs);
  }

  function _tickBanner(ws, nowMs) {
    if (ws.started && ws.wave !== get.lastWaveNum() && ws.phase === "spawning") {
      set.lastWaveNum(ws.wave);
      set.waveBeepLast(0);
      set.waveBannerUntil(nowMs + BANNER_DUR_MS);
      const wbl = actions.getBannerLabel();
      const wbs = actions.getBannerSub();
      const banner = actions.getBanner();
      if (wbl) wbl.textContent = `WAVE ${ws.wave}`;
      if (wbs) wbs.textContent = ws.wave >= ws.totalWaves ? "FINAL WAVE" : "GET READY";
      if (banner) { banner.style.display = "block"; banner.style.transform = "scaleY(1)"; }
      actions.playSfx(`tone:${220 + ws.wave * 20}:120:square`, 0.25);
    }
    const bannerUntil = get.waveBannerUntil();
    const banner = actions.getBanner();
    if (banner && bannerUntil > 0 && nowMs > bannerUntil) {
      banner.style.transform = "scaleY(0)";
      setTimeout(() => { banner.style.display = "none"; }, BANNER_HIDE_DELAY);
      set.waveBannerUntil(0);
    }
  }

  return { tick };
}
