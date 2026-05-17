// src/systems/wave_manager.js — progressive wave spawner
// Each wave spawns a configurable set of enemies with increasing difficulty.
// Integrates with window._spawnEnemyAtHero and Engine/EventBus.
//
// API (window.WaveManager):
//   init(opts)        — opts: { onWaveStart, onWaveEnd, onAllWaves, pauseBetween }
//   start()           — begin wave sequence from wave 1
//   stop()            — halt all waves
//   tick(dt)          — call every frame
//   getState()        → { wave, phase, countdown, aliveCount }
//   addWave(def)      — push a custom wave def at the end
//   reset()           — back to wave 1, not started

(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.WaveManager = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Wave definitions: each wave is [{ type, count }] + optional pauseAfter (s)
  const _defaultWaves = [
    { enemies: [{ type: "grunt",  count: 3 }],                                          pauseAfter: 8 },
    { enemies: [{ type: "grunt",  count: 4 }, { type: "fast",       count: 2 }],        pauseAfter: 8 },
    { enemies: [{ type: "grunt",  count: 3 }, { type: "poisoner",   count: 2 }],        pauseAfter: 10 },
    { enemies: [{ type: "heavy",  count: 1 }, { type: "grunt",      count: 4 }],        pauseAfter: 10 },
    { enemies: [{ type: "fast",   count: 5 }, { type: "incendiary", count: 2 }],        pauseAfter: 12 },
    { enemies: [{ type: "boss",   count: 1 }],                                           pauseAfter: 18 },
    { enemies: [{ type: "heavy",  count: 2 }, { type: "sniper",    count: 1 }],        pauseAfter: 12 },
    { enemies: [{ type: "sniper", count: 2 }, { type: "fast",      count: 4 }],        pauseAfter: 14 },
    { enemies: [{ type: "robot", count: 1 }, { type: "sniper", count: 1 }, { type: "fast", count: 3 }],     pauseAfter: 15 },
    { enemies: [{ type: "robot", count: 2 }, { type: "sniper", count: 2 }, { type: "boss", count: 1 }],     pauseAfter: 20 },
  ];

  let _waves = _defaultWaves.map(w => Object.assign({}, w));
  let _waveIdx   = 0;
  let _totalWave = 0;          // never resets on loop — used for persistent scaling
  let _phase     = "idle";    // idle | countdown | spawning | waiting | pausing | done
  let _countdown = 0;
  let _pauseLeft = 0;
  let _spawnQueue = [];       // [{type, count}] remaining to spawn
  let _spawnTimer  = 0;
  let _spawnInterval = 0.35;  // seconds between individual enemy spawns
  let _aliveTrack    = 0;     // enemies spawned this wave still alive (approx.)
  let _started = false;

  let _opts = {};

  function _totalInWave(waveDef) {
    return (waveDef.enemies || []).reduce((s, g) => s + g.count, 0);
  }

  function _emit(name, data) {
    if (typeof Engine !== "undefined" && Engine.events) Engine.events.emit(name, data);
    else if (typeof EventBus !== "undefined") EventBus.emit(name, data);
  }

  function init(opts) {
    _opts = opts || {};
    _waveIdx  = 0;
    _phase    = "idle";
    _started  = false;
  }

  function start() {
    if (_started) return;
    _started  = true;
    _waveIdx  = 0;
    _beginCountdown();
  }

  function stop() {
    _phase   = "idle";
    _started = false;
    _spawnQueue = [];
  }

  function reset() {
    stop();
    _waveIdx   = 0;
    _totalWave = 0;
  }

  function _beginCountdown() {
    _phase     = "countdown";
    _countdown = 5;                 // 5-second warning before wave
    const wNum = _waveIdx + 1;
    _emit("wave:countdown", { wave: wNum, seconds: _countdown });
    if (_opts.onWaveStart) _opts.onWaveStart(wNum, _countdown);
  }

  function _beginSpawning() {
    _phase = "spawning";
    _totalWave++;                // persistent across loops
    const waveDef = _waves[_waveIdx];
    // Build a flat queue: [{type, remaining}]
    _spawnQueue = (waveDef.enemies || []).map(g => ({ type: g.type, remaining: g.count }));
    _spawnTimer  = 0;
    _aliveTrack  = _totalInWave(waveDef);
    const wNum = _waveIdx + 1;
    _emit("wave:start", { wave: wNum, total: _aliveTrack });
    if (typeof DevConsole !== "undefined") DevConsole.print(`[Wave ${wNum}] Starting — ${_aliveTrack} enemies`, "warn");
  }

  function _doSpawn() {
    for (let i = 0; i < _spawnQueue.length; i++) {
      if (_spawnQueue[i].remaining > 0) {
        _spawnQueue[i].remaining--;
        if (typeof window !== "undefined" && typeof window._spawnEnemyAtHero === "function") {
          window._spawnEnemyAtHero(_spawnQueue[i].type);
        }
        return true;
      }
    }
    return false; // queue exhausted
  }

  function _beginWaiting() {
    _phase = "waiting";
    _emit("wave:waiting", { wave: _waveIdx + 1 });
  }

  function _beginPause() {
    const waveDef = _waves[_waveIdx];
    _phase     = "pausing";
    _pauseLeft = (waveDef.pauseAfter != null ? waveDef.pauseAfter : (_opts.pauseBetween || 10));
    const wNum = _waveIdx + 1;
    _emit("wave:end", { wave: wNum });
    if (_opts.onWaveEnd) _opts.onWaveEnd(wNum);
    if (typeof DevConsole !== "undefined") DevConsole.print(`[Wave ${wNum}] Clear! Next in ${Math.round(_pauseLeft)}s`, "success");
    _waveIdx++;
  }

  function tick(dt) {
    if (!_started || _phase === "idle" || _phase === "done") return;

    if (_phase === "countdown") {
      _countdown -= dt;
      if (_countdown <= 0) _beginSpawning();
      return;
    }

    if (_phase === "spawning") {
      // Spawn enemies from queue at fixed intervals
      const allEmpty = _spawnQueue.every(g => g.remaining === 0);
      if (allEmpty) {
        _beginWaiting();
        return;
      }
      _spawnTimer -= dt;
      if (_spawnTimer <= 0) {
        _doSpawn();
        _spawnTimer = _spawnInterval;
      }
      return;
    }

    if (_phase === "waiting") {
      // Count alive tracked enemies by checking global enemies array
      if (typeof window !== "undefined" && Array.isArray(window._enemies)) {
        _aliveTrack = window._enemies.filter(e => !e.dead && e.id.startsWith("en_spawned_")).length;
      } else {
        // Decrement by elapsed time as approximate fallback (1 enemy per 5s)
        _aliveTrack = Math.max(0, _aliveTrack - dt * 0.2);
      }
      if (_aliveTrack <= 0) _beginPause();
      return;
    }

    if (_phase === "pausing") {
      _pauseLeft -= dt;
      if (_pauseLeft <= 0) {
        if (_waveIdx >= _waves.length) {
          _phase = "done";
          _emit("wave:all_complete", {});
          if (_opts.onAllWaves) _opts.onAllWaves();
          if (typeof DevConsole !== "undefined") DevConsole.print("[Wave] All waves complete! Looping.", "success");
          // Loop from the beginning
          _waveIdx = 0;
          _beginCountdown();
        } else {
          _beginCountdown();
        }
      }
      return;
    }
  }

  function getState() {
    return {
      wave:       _waveIdx + 1,
      totalWave:  _totalWave,          // never resets — use for persistent enemy scaling
      totalWaves: _waves.length,
      phase:      _phase,
      countdown:  _phase === "countdown" ? Math.ceil(_countdown) : 0,
      pauseLeft:  _phase === "pausing"   ? Math.ceil(_pauseLeft) : 0,
      aliveCount: _aliveTrack,
      started:    _started,
    };
  }

  function addWave(def) {
    _waves.push(def);
  }

  return { init, start, stop, reset, tick, getState, addWave };
});
