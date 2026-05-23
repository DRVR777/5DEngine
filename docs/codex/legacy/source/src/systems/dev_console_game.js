// In-game dev console (backtick key) — game-command handler layer
// mountDevConsoleGame(actions) → void
// Distinct from src/core/dev_console.js (the UI shell); this module
// owns the command dispatch for game-state commands.

export function mountDevConsoleGame(actions) {
  if (typeof document === "undefined") return;

  const _con = document.getElementById("devConsole");
  const _log = document.getElementById("devConsoleLogs");
  const _inp = document.getElementById("devConsoleInput");
  if (!_con || !_log || !_inp) return;

  let _open = false;
  const _hist = [], _histIdx = { v: -1 };

  function _conPrint(msg, color) {
    const line = document.createElement("div");
    line.style.color = color || "#88ccdd";
    line.textContent = msg;
    _log.appendChild(line);
    if (_log.children.length > 80) _log.removeChild(_log.firstChild);
    _log.scrollTop = _log.scrollHeight;
  }

  function _conExec(raw) {
    const parts = raw.trim().split(/\s+/);
    const cmd = (parts[0] || "").toLowerCase();
    _conPrint("› " + raw, "#4488aa");
    switch (cmd) {
      case "god":
        actions.toggleGodMode();
        _conPrint("God mode: " + (actions.isGodMode() ? "ON" : "OFF"), "#ffd166");
        break;
      case "noclip":
        actions.toggleNoclip();
        _conPrint("Noclip: " + (actions.isNoclip() ? "ON" : "OFF"), "#ffd166");
        break;
      case "heal":
        actions.heal();
        _conPrint("HP + Armor full.", "#00ff88");
        break;
      case "ammo":
        actions.refillAmmo();
        _conPrint("All weapon ammo refilled.", "#00ff88");
        break;
      case "spawn": {
        const type = parts[1] || "grunt";
        actions.spawnEnemy(type);
        _conPrint(`Spawned ${type}.`, "#aaffcc");
        break;
      }
      case "tp": {
        const tu = parseFloat(parts[1]), tv = parseFloat(parts[2]);
        if (!isNaN(tu) && !isNaN(tv)) {
          actions.teleport(tu, tv);
          _conPrint(`Teleported to (${tu}, ${tv}).`, "#aaffcc");
        } else { _conPrint("Usage: tp <u> <v>", "#ff8844"); }
        break;
      }
      case "wave": {
        const wn = parseInt(parts[1], 10);
        if (!isNaN(wn)) {
          actions.setWave(wn);
          _conPrint(`Wave set to ${wn}.`, "#aaffcc");
        } else { _conPrint("Usage: wave <n>", "#ff8844"); }
        break;
      }
      case "restart":
        actions.resetGameState();
        _conPrint("Game reset.", "#00ff88");
        break;
      case "help":
        _conPrint("Commands: god  noclip  heal  ammo  spawn <type>  tp <u> <v>  wave <n>  restart", "#aaddff");
        _conPrint("Enemy types: grunt fast heavy poisoner incendiary robot", "#556677");
        break;
      default:
        if (cmd) _conPrint("Unknown command. Type 'help' for list.", "#ff6644");
    }
  }

  document.addEventListener("keydown", function(e) {
    if (e.code === "Backquote") {
      _open = !_open;
      _con.style.display = _open ? "flex" : "none";
      if (_open) { setTimeout(() => _inp.focus(), 10); document.exitPointerLock && document.exitPointerLock(); }
      e.preventDefault(); return;
    }
    if (!_open) return;
    if (e.code === "Enter") {
      const v = _inp.value.trim();
      if (v) { _hist.unshift(v); _histIdx.v = -1; _conExec(v); _inp.value = ""; }
      e.preventDefault();
    } else if (e.code === "ArrowUp") {
      _histIdx.v = Math.min(_histIdx.v + 1, _hist.length - 1);
      _inp.value = _hist[_histIdx.v] || ""; e.preventDefault();
    } else if (e.code === "ArrowDown") {
      _histIdx.v = Math.max(_histIdx.v - 1, -1);
      _inp.value = _histIdx.v >= 0 ? _hist[_histIdx.v] : ""; e.preventDefault();
    } else if (e.code === "Escape") {
      _open = false; _con.style.display = "none";
    }
  });

  _conPrint("5DEngine dev console ready. Type 'help' for commands.", "#00ccff");
}
