/**
 * ecs_wave.js — ECS wave spawner system for 5DEngine
 *
 * Ported from src/systems/wave_manager.js (monolith wrapper) into a pure ECS
 * system that uses Core.instantiate() and Core.emit() instead of window globals.
 *
 * Usage:
 *   import { createWaveSystem } from "./src/systems/ecs_wave.js";
 *   const waveSystem = createWaveSystem(waveConfig);
 *   Core.addSystem(waveSystem, 5, "wave");
 *   waveSystem.start();
 *
 * The system emits on Core's event bus:
 *   "wave:countdown"    { wave, seconds }
 *   "wave:start"        { wave, total }
 *   "wave:waiting"      { wave }
 *   "wave:end"          { wave }
 *   "wave:all_complete" {}
 *
 * Enemy death tracking: listen to "entity:destroyed" or set EnemyAI.hp to 0.
 * The system counts alive enemies via core.query("EnemyAI","Health") each tick.
 *
 * Spawn positions: ctx.getSpawnPos() → { u, v, y } (required in ctx).
 * If ctx.getSpawnPos is absent, enemies spawn at { u:0, v:0, y:0 }.
 */

// Wave definitions — mirrored from src/systems/wave_manager.js _defaultWaves.
// Wave N-1 (0-indexed). pauseAfter = seconds of calm after wave is cleared.
const DEFAULT_WAVES = [
  { enemies: [{ type: "grunt",  count: 3 }],                                         pauseAfter: 8  },
  { enemies: [{ type: "grunt",  count: 4 }, { type: "fast",       count: 2 }],       pauseAfter: 8  },
  { enemies: [{ type: "grunt",  count: 3 }, { type: "poisoner",   count: 2 }],       pauseAfter: 10 },
  { enemies: [{ type: "heavy",  count: 1 }, { type: "grunt",      count: 4 }],       pauseAfter: 10 },
  { enemies: [{ type: "fast",   count: 5 }, { type: "incendiary", count: 2 }],       pauseAfter: 12 },
  { enemies: [{ type: "boss",   count: 1 }],                                          pauseAfter: 18 },
  { enemies: [{ type: "heavy",  count: 2 }, { type: "sniper",    count: 1 }],        pauseAfter: 12 },
  { enemies: [{ type: "sniper", count: 2 }, { type: "fast",      count: 4 }],        pauseAfter: 14 },
  { enemies: [{ type: "robot",  count: 1 }, { type: "sniper",    count: 1 }, { type: "fast",   count: 3 }], pauseAfter: 15 },
  { enemies: [{ type: "robot",  count: 2 }, { type: "sniper",    count: 2 }, { type: "boss",   count: 1 }], pauseAfter: 20 },
];

const COUNTDOWN_SECONDS = 5;    // warning before each wave
const SPAWN_INTERVAL    = 0.35; // seconds between individual enemy spawns

/**
 * createWaveSystem(waves?) → system function with start/stop/reset/getState API.
 * @param {Array} [waves] - optional override of DEFAULT_WAVES
 */
export function createWaveSystem(waves = DEFAULT_WAVES) {
  // ── mutable state ──
  let _waveIdx    = 0;
  let _totalWave  = 0;       // never resets on loop — for difficulty scaling
  let _phase      = "idle";  // idle | countdown | spawning | waiting | pausing | done
  let _countdown  = 0;
  let _pauseLeft  = 0;
  let _spawnQueue = [];      // [{ type, remaining }]
  let _spawnTimer = 0;
  let _aliveCount = 0;
  let _started    = false;
  let _core       = null;    // set on first system call

  // ── helpers ──
  function _waveTotal(waveDef) {
    return (waveDef.enemies || []).reduce((s, g) => s + g.count, 0);
  }

  function _beginCountdown() {
    _phase     = "countdown";
    _countdown = COUNTDOWN_SECONDS;
    _core.emit("wave:countdown", { wave: _waveIdx + 1, seconds: _countdown });
  }

  function _beginSpawning() {
    _phase = "spawning";
    _totalWave++;
    const def = waves[_waveIdx];
    _spawnQueue = (def.enemies || []).map(g => ({ type: g.type, remaining: g.count }));
    _spawnTimer = 0;
    _aliveCount = _waveTotal(def);
    _core.emit("wave:start", { wave: _waveIdx + 1, total: _aliveCount });
  }

  function _spawnOne(ctx) {
    for (const group of _spawnQueue) {
      if (group.remaining > 0) {
        group.remaining--;
        const spawnPos = (ctx && ctx.getSpawnPos) ? ctx.getSpawnPos() : { u: 0, v: 0, y: 0 };
        try {
          const id = _core.instantiate(`enemy_${group.type}`);
          const t  = _core.getComponent(id, "Transform");
          if (t) { t.u = spawnPos.u; t.v = spawnPos.v; t.y = spawnPos.y; }
        } catch (e) {
          // Prefab not registered yet — emit event for monolith to handle
          _core.emit("wave:spawn_enemy", { type: group.type, pos: spawnPos });
        }
        return true;
      }
    }
    return false;
  }

  function _countAlive() {
    if (!_core) return 0;
    const ids = _core.query("EnemyAI", "Health");
    return ids.filter(id => {
      const h = _core.getComponent(id, "Health");
      return h && h.hp > 0;
    }).length;
  }

  function _beginWaiting() {
    _phase = "waiting";
    _core.emit("wave:waiting", { wave: _waveIdx + 1 });
  }

  function _beginPause() {
    const def = waves[_waveIdx];
    _phase     = "pausing";
    _pauseLeft = def.pauseAfter != null ? def.pauseAfter : 10;
    _core.emit("wave:end", { wave: _waveIdx + 1 });
    _waveIdx++;
  }

  // ── system function — called every fixed tick ──
  function system(dt, core, ctx) {
    _core = core;
    if (!_started || _phase === "idle" || _phase === "done") return;

    if (_phase === "countdown") {
      _countdown -= dt;
      if (_countdown <= 0) _beginSpawning();
      return;
    }

    if (_phase === "spawning") {
      const allEmpty = _spawnQueue.every(g => g.remaining === 0);
      if (allEmpty) { _beginWaiting(); return; }
      _spawnTimer -= dt;
      if (_spawnTimer <= 0) {
        _spawnOne(ctx);
        _spawnTimer = SPAWN_INTERVAL;
      }
      return;
    }

    if (_phase === "waiting") {
      _aliveCount = _countAlive();
      if (_aliveCount <= 0) _beginPause();
      return;
    }

    if (_phase === "pausing") {
      _pauseLeft -= dt;
      if (_pauseLeft <= 0) {
        if (_waveIdx >= waves.length) {
          _core.emit("wave:all_complete", {});
          _waveIdx = 0;        // loop from beginning
        }
        _beginCountdown();
      }
      return;
    }
  }

  // ── public API on the system function ──
  system.start = function (core) {
    if (_started) return;
    if (core) _core = core;
    _started  = true;
    _waveIdx  = 0;
    if (_core) _beginCountdown();
    else _phase = "countdown"; // _beginCountdown will fire on first tick
  };

  system.stop = function () {
    _phase   = "idle";
    _started = false;
    _spawnQueue = [];
  };

  system.reset = function () {
    system.stop();
    _waveIdx   = 0;
    _totalWave = 0;
  };

  system.getState = function () {
    return {
      wave:       _waveIdx + 1,
      totalWave:  _totalWave,
      phase:      _phase,
      countdown:  _countdown,
      aliveCount: _aliveCount,
      started:    _started,
    };
  };

  return system;
}

export default { createWaveSystem };
