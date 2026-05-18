// Hero death screen, respawn, and countdown timer
// mountHeroLifecycle(deps) → { heroShowDeathScreen, heroRespawn, tickDeath }

export function mountHeroLifecycle({ get, set, actions, }) {
  if (typeof document === "undefined") return { heroShowDeathScreen: () => {}, heroRespawn: () => {}, tickDeath: () => {} };

  const RESPAWN_DELAY = 5;
  let _deathCountdownT = 0;

  function heroShowDeathScreen() {
    set.heroDead(true);
    set.grenadePressT(0);
    set.heroKbT(0);
    document.exitPointerLock && document.exitPointerLock();
    const overlay = document.getElementById("deathOverlay");
    const stats   = document.getElementById("deathStats");
    const cntEl   = document.getElementById("deathCountdown");
    if (!overlay) return;
    const sf = get.shotsFired(), sh = get.shotsHit();
    const _acc = sf > 0 ? Math.round(sh / sf * 100) : 0;
    const _waveNum = actions.waveNum();
    const _newBest = actions.checkHighScore(get.enemyKills(), _waveNum, _acc);
    const _prevRec = actions.highScoreGet();
    const _prev = _prevRec && !_newBest
      ? `<br><span style="color:#557799;font-size:11px">Best: ${_prevRec.kills} kills · Wave ${_prevRec.wave} · ${_prevRec.acc}% acc</span>`
      : "";
    if (stats) stats.innerHTML =
      (_newBest ? `<div style="color:#ffd166;font-size:16px;margin-bottom:6px;animation:pulse 0.8s ease infinite">★ NEW BEST SCORE! ★</div>` : "") +
      `Kills: <b style="color:#ff8888">${get.enemyKills()}</b> &nbsp;|&nbsp; ` +
      `Wave: <b style="color:#aef060">${_waveNum}</b><br>` +
      `Coins: <b style="color:#ffd166">${get.score()}</b> &nbsp;|&nbsp; ` +
      `Damage dealt: <b style="color:#ff9944">${get.damageDealt()}</b><br>` +
      `Shots fired: <b style="color:#aaddff">${sf}</b> &nbsp;|&nbsp; ` +
      `Accuracy: <b style="color:${_acc >= 50 ? "#aef060" : _acc >= 25 ? "#ffd166" : "#ff8888"}">${_acc}%</b>` +
      _prev;
    if (cntEl) cntEl.textContent = RESPAWN_DELAY;
    overlay.style.display = "flex";
    _deathCountdownT = RESPAWN_DELAY;
  }

  function heroRespawn() {
    set.heroDead(false);
    const overlay = document.getElementById("deathOverlay");
    if (overlay) overlay.style.display = "none";
    const sp = actions.getSpawnPoint();
    actions.worldSetPlayer(sp.u, sp.v);
    set.heroHp(get.HERO_MAX_HP() + get.perkMaxHpBonus());
    set.heroArmor(0);
    set.heroLastDamageT(-999);
    set.velocityY(0);
    set.stamina(get.STAMINA_MAX());
    set.shotsFired(0); set.shotsHit(0); set.damageDealt(0);
    set.comboCount(0); set.comboAnnouncedMul(0);
    set.heroFireT(0); set.heroEmpT(0); set.heroBlindT(0);
    set.heroKbU(0); set.heroKbV(0); set.heroKbT(0);
    set.slideT(0); set.speedBoostT(0); set.bulletTimeLeft(0);
    set.killMarkerUntil(0);
    actions.playSfx("tone:440:120:sine", 0.5);
    actions.heroRespawnedEvent(sp);
    actions.requestPointerLock();
  }

  function tickDeath(dt) {
    _deathCountdownT -= dt;
    const cntEl = document.getElementById("deathCountdown");
    if (cntEl) cntEl.textContent = Math.max(0, Math.ceil(_deathCountdownT));
    if (_deathCountdownT <= 0) heroRespawn();
  }

  return { heroShowDeathScreen, heroRespawn, tickDeath };
}
