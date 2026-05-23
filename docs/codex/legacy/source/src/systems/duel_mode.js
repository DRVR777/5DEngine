// 10-round 1v1 duel mode.
// mountDuelMode({ mp, get, set, actions }) → { startDuel, cancelDuel, onRoundEnd, isDueling }
//   mp = the LAN session proxy (createLanSession return value)
export function mountDuelMode({ mp, get, set, actions }) {
  const TOTAL_ROUNDS  = 10;
  const ROUND_TIMEOUT = 90;   // seconds per round

  let _state = null;  // null = idle
  // _state: { opponentId, myWins, oppWins, round, phase, roundTimer, roundTimerId }

  // ── HUD overlay (DOM) ────────────────────────────────────────────────────────
  let _hud = null;

  function _ensureHud() {
    if (typeof document === "undefined") return;
    if (_hud) return;
    _hud = document.createElement("div");
    _hud.id = "duelHud";
    _hud.style.cssText = [
      "position:fixed;top:14px;left:50%;transform:translateX(-50%)",
      "background:rgba(4,10,28,0.93);border:1px solid #ff6644;border-radius:8px",
      "padding:8px 22px;color:#fff;font-family:monospace;font-size:14px",
      "text-align:center;z-index:9999;pointer-events:none;display:none",
    ].join(";");
    document.body.appendChild(_hud);
  }

  function _showHud(html) {
    _ensureHud();
    if (!_hud) return;
    _hud.innerHTML = html;
    _hud.style.display = "block";
  }
  function _hideHud() {
    if (_hud) _hud.style.display = "none";
  }

  function _renderHud() {
    if (!_state) { _hideHud(); return; }
    const { myWins, oppWins, round, roundTimer } = _state;
    const oppName = _peerName(_state.opponentId);
    _showHud(
      `<b style="color:#ff6644">⚔️ DUEL</b> &nbsp; Round <b>${round}/${TOTAL_ROUNDS}</b> &nbsp;|&nbsp; ` +
      `You <b style="color:#44ff88">${myWins}</b> — <b style="color:#ff4444">${oppWins}</b> ${oppName} &nbsp;|&nbsp; ` +
      `<b style="color:#ffcc44">${Math.ceil(roundTimer)}s</b>`
    );
  }

  function _peerName(id) {
    if (!id) return "?";
    const p = mp.peers.get(id);
    return p ? p.name : id.slice(0, 6);
  }

  // ── Round timer ──────────────────────────────────────────────────────────────
  let _timerInterval = null;

  function _startRoundTimer() {
    _clearRoundTimer();
    if (!_state) return;
    _state.roundTimer = ROUND_TIMEOUT;
    _timerInterval = setInterval(() => {
      if (!_state) { _clearRoundTimer(); return; }
      _state.roundTimer = Math.max(0, _state.roundTimer - 1);
      _renderHud();
      if (_state.roundTimer <= 0) {
        // Timeout — count as a draw (no winner this round)
        _advanceRound(null);
      }
    }, 1000);
  }

  function _clearRoundTimer() {
    if (_timerInterval) { clearInterval(_timerInterval); _timerInterval = null; }
  }

  // ── Round flow ───────────────────────────────────────────────────────────────
  function _advanceRound(winnerId) {
    _clearRoundTimer();
    if (!_state) return;
    const myId = get.myId ? get.myId() : null;
    if (winnerId === myId)        _state.myWins++;
    else if (winnerId !== null)   _state.oppWins++;

    // Check match end
    const remaining = TOTAL_ROUNDS - _state.round;
    const myCanWin  = _state.myWins  + remaining + 1 > Math.ceil(TOTAL_ROUNDS / 2);
    const oppCanWin = _state.oppWins + remaining + 1 > Math.ceil(TOTAL_ROUNDS / 2);

    if (_state.round >= TOTAL_ROUNDS || (!myCanWin && !oppCanWin)) {
      _endMatch();
      return;
    }

    _state.round++;
    _state.phase = "active";
    actions.showToast(`Round ${_state.round} — FIGHT!`, "info", 2000);
    actions.playSfx("tone:880:80:square", 0.5);
    _spawnDuelPositions();
    _startRoundTimer();
    _renderHud();

    mp.sendEvent("duel_round_start", {
      targetId:  _state.opponentId,
      round:     _state.round,
      myWins:    _state.myWins,
      oppWins:   _state.oppWins,
    });
  }

  function _endMatch() {
    if (!_state) return;
    const { myWins, oppWins, opponentId } = _state;
    const oppName = _peerName(opponentId);
    let msg, variant;
    if (myWins > oppWins) {
      msg = `YOU WIN the duel! ${myWins}–${oppWins} vs ${oppName}`;
      variant = "success";
      actions.playSfx("tone:1174:200:sine", 0.7);
    } else if (oppWins > myWins) {
      msg = `You lost the duel. ${myWins}–${oppWins} vs ${oppName}`;
      variant = "danger";
      actions.playSfx("tone:220:300:sawtooth", 0.5);
    } else {
      msg = `DRAW! ${myWins}–${oppWins} vs ${oppName}`;
      variant = "info";
      actions.playSfx("tone:440:200:triangle", 0.4);
    }
    actions.showToast(msg, variant, 6000);
    actions.addKillFeedEntry(`⚔️ Duel: ${msg}`, myWins > oppWins ? "#44ff88" : "#ff4444");

    mp.sendEvent("duel_match_end", {
      targetId: opponentId,
      myWins, oppWins,
    });

    _state = null;
    _hideHud();

    // Restore normal HP
    set.heroHp(get.HERO_MAX_HP());
  }

  // Teleport both players to spawn-near-each-other positions for each round
  function _spawnDuelPositions() {
    // Spawn the local hero at fixed arena spot — peer will do the same on their side
    // Simple: place hero at world center with small offset
    if (actions.teleportHero) actions.teleportHero(2, 0, 2);
  }

  // ── Incoming hit from peer ───────────────────────────────────────────────────
  mp.onEvent("incoming_hit", (data) => {
    if (!_state || _state.phase !== "active") return;
    if (data.fromId !== _state.opponentId)   return;

    const curHp = get.heroHp();
    const newHp = Math.max(0, curHp - (data.damage || 15));
    set.heroHp(newHp);
    actions.showToast(
      `Hit! -${data.damage}${data.headshot ? " HEADSHOT" : ""} HP: ${newHp}`,
      "danger", 1200
    );
    actions.spawnParticles(0, 1.5, 0, 8, "red", 5, 0.5);

    if (newHp <= 0) {
      _state.phase = "resolving";
      actions.showToast("You died! Round lost.", "danger", 2500);
      mp.sendEvent("duel_round_end", {
        targetId:  _state.opponentId,
        winnerId:  _state.opponentId,
        round:     _state.round,
      });
      setTimeout(() => _advanceRound(_state ? _state.opponentId : null), 2000);
    }
  });

  // ── Remote duel events ───────────────────────────────────────────────────────
  mp.onEvent("duel_challenge", (data) => {
    if (_state) return;   // already in a duel
    const fromName = _peerName(data.id);
    actions.showToast(
      `⚔️ ${fromName} challenges you to a 1v1 duel! Open the computer → 1v1 Duel to accept.`,
      "info", 10000
    );
    // Store pending challenge for the UI to pick up
    _pendingChallenge = { fromId: data.id, fromName };
  });

  mp.onEvent("duel_accept", (data) => {
    if (!_state || _state.phase !== "challenged") return;
    if (data.id !== _state.opponentId) return;
    actions.showToast("Challenge accepted! Duel begins in 3 seconds…", "success", 3000);
    actions.playSfx("tone:660:100:sine", 0.6);
    setTimeout(() => {
      if (!_state) return;
      _state.phase = "active";
      _state.round = 1;
      _spawnDuelPositions();
      _startRoundTimer();
      _renderHud();
      actions.showToast("Round 1 — FIGHT!", "info", 2000);
    }, 3000);
  });

  mp.onEvent("duel_decline", (data) => {
    if (!_state || data.id !== _state.opponentId) return;
    actions.showToast(`${_peerName(data.id)} declined the duel.`, "info", 3000);
    _state = null;
    _hideHud();
  });

  mp.onEvent("duel_round_end", (data) => {
    if (!_state || _state.phase !== "active") return;
    if (data.id !== _state.opponentId) return;
    // Opponent says they died — we won this round
    _state.phase = "resolving";
    const myId = get.myId ? get.myId() : null;
    const winnerId = data.winnerId === myId ? myId : _state.opponentId;
    setTimeout(() => _advanceRound(winnerId), 1500);
  });

  mp.onEvent("duel_cancel", (data) => {
    if (!_state || data.id !== _state.opponentId) return;
    actions.showToast("Duel cancelled (opponent disconnected).", "danger", 3000);
    _clearRoundTimer();
    _state = null;
    _hideHud();
  });

  mp.onEvent("player_left", (data) => {
    if (_state && data.id === _state.opponentId) {
      mp.sendEvent("duel_cancel", { targetId: _state.opponentId });
      actions.showToast("Duel cancelled — opponent left.", "danger", 3000);
      _clearRoundTimer();
      _state = null;
      _hideHud();
    }
  });

  // ── Public API ───────────────────────────────────────────────────────────────
  let _pendingChallenge = null;

  function startDuel(opponentId) {
    if (_state) { actions.showToast("Already in a duel!", "danger", 2000); return; }
    _state = {
      opponentId, myWins: 0, oppWins: 0, round: 0,
      phase: "challenged", roundTimer: ROUND_TIMEOUT,
    };
    mp.sendEvent("duel_challenge", { targetId: opponentId });
    actions.showToast(`Duel challenge sent to ${_peerName(opponentId)}!`, "info", 4000);
    _showHud(`<b style="color:#ff6644">⚔️ Waiting for ${_peerName(opponentId)} to accept…</b>`);
  }

  function acceptDuel(fromId) {
    if (_state) { actions.showToast("Already in a duel!", "danger", 2000); return; }
    _state = {
      opponentId: fromId, myWins: 0, oppWins: 0, round: 1,
      phase: "active", roundTimer: ROUND_TIMEOUT,
    };
    _pendingChallenge = null;
    mp.sendEvent("duel_accept", { targetId: fromId });
    actions.showToast("Duel accepted! Round 1 — FIGHT!", "success", 3000);
    actions.playSfx("tone:660:100:sine", 0.6);
    _spawnDuelPositions();
    _startRoundTimer();
    _renderHud();
  }

  function declineDuel(fromId) {
    _pendingChallenge = null;
    mp.sendEvent("duel_decline", { targetId: fromId });
    actions.showToast("Duel declined.", "info", 2000);
  }

  function cancelDuel() {
    if (!_state) return;
    mp.sendEvent("duel_cancel", { targetId: _state.opponentId });
    _clearRoundTimer();
    _state = null;
    _pendingChallenge = null;
    _hideHud();
    actions.showToast("Duel cancelled.", "info", 2000);
  }

  function isDueling() { return !!_state; }
  function getPendingChallenge() { return _pendingChallenge; }
  function getDuelState() { return _state ? { ..._state } : null; }

  return { startDuel, acceptDuel, declineDuel, cancelDuel, isDueling, getPendingChallenge, getDuelState };
}
