// src/core/engine.js — single root namespace for 5DEngine
// Exposes window.Engine as the authoritative registry for all subsystems.
// Other modules attach themselves here instead of creating new window.X globals.
//
// Usage:
//   Engine.register("audio", AudioSystem);   // subsystem registers itself
//   Engine.get("audio")                      // retrieve it later
//   Engine.time.now                          // game clock (seconds since start)
//   Engine.time.dt                           // last frame delta
//   Engine.time.scale                        // time multiplier (1 = normal)
//   Engine.debug.enabled                     // true when debug overlay is open

(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Engine = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const _subsystems = new Map();

  // ---- Time ----
  const time = {
    now:   0,       // seconds since Engine.start() was called
    dt:    0,
    scale: 1.0,
    _startMs: null,
    _lastMs:  null,

    tick(nowMs) {
      if (this._startMs === null) this._startMs = nowMs;
      const elapsed = (nowMs - this._startMs) / 1000;
      this.dt  = this._lastMs !== null ? Math.min((nowMs - this._lastMs) / 1000, 0.1) * this.scale : 0;
      this.now = elapsed * this.scale;
      this._lastMs = nowMs;
    },
  };

  // ---- Debug flags ----
  const debug = {
    enabled:    false,
    showAStarGrid: false,
    showHitboxes:  false,
    showAI:        false,
    godMode:       false,
    noClip:        false,
    fpsHistory:    [],          // last 60 frame times for sparkline
  };

  // ---- Subsystem registry ----
  function register(name, subsystem) {
    _subsystems.set(name, subsystem);
  }

  function get(name) {
    return _subsystems.get(name) || null;
  }

  function has(name) { return _subsystems.has(name); }

  function list() { return [..._subsystems.keys()]; }

  // ---- Commands (for dev console) ----
  const _commands = new Map();

  function addCommand(name, desc, fn) {
    _commands.set(name, { desc, fn });
  }

  function runCommand(line) {
    const parts  = line.trim().split(/\s+/);
    const name   = parts[0].toLowerCase();
    const args   = parts.slice(1);
    const cmd    = _commands.get(name);
    if (!cmd) return `Unknown command: ${name}. Type 'help' for list.`;
    try {
      return cmd.fn(args) || "";
    } catch (e) {
      return `Error: ${e.message}`;
    }
  }

  function listCommands() { return [..._commands.entries()]; }

  // Built-in commands
  addCommand("help", "List all commands", () =>
    listCommands().map(([n, c]) => `  ${n.padEnd(14)} ${c.desc}`).join("\n")
  );
  addCommand("time", "Get/set time scale  time [scale]", (args) => {
    if (args[0] !== undefined) time.scale = Math.max(0, parseFloat(args[0]) || 1);
    return `time.scale = ${time.scale}`;
  });
  addCommand("now", "Print game clock in seconds", () => `now = ${time.now.toFixed(2)}s`);
  addCommand("god", "Toggle god mode (no damage)", () => {
    debug.godMode = !debug.godMode;
    return `god mode ${debug.godMode ? "ON" : "OFF"}`;
  });
  addCommand("noclip", "Toggle no-clip (walk through walls)", () => {
    debug.noClip = !debug.noClip;
    return `noclip ${debug.noClip ? "ON" : "OFF"}`;
  });
  addCommand("fps", "Print current FPS", () => {
    if (debug.fpsHistory.length === 0) return "No FPS data yet";
    const avg = debug.fpsHistory.reduce((a, b) => a + b, 0) / debug.fpsHistory.length;
    return `avg FPS: ${avg.toFixed(1)}`;
  });
  addCommand("subsystems", "List registered subsystems", () =>
    list().map(n => `  ${n}`).join("\n") || "  (none yet)"
  );
  addCommand("heal", "Heal hero to full HP", () => {
    if (typeof window !== "undefined" && typeof window._entityHeal === "function") {
      window._entityHeal("hero", 9999);
      return "Hero healed.";
    }
    return "No heal hook found.";
  });
  addCommand("spawn", "Spawn enemy at hero pos  spawn [count]", (args) => {
    if (typeof window !== "undefined" && typeof window._spawnEnemyAtHero === "function") {
      const n = parseInt(args[0]) || 1;
      for (let i = 0; i < n; i++) window._spawnEnemyAtHero();
      return `Spawned ${n} enemy.`;
    }
    return "No _spawnEnemyAtHero hook found.";
  });
  addCommand("tp", "Teleport hero  tp <u> <v>", (args) => {
    const u = parseFloat(args[0]), v = parseFloat(args[1]);
    if (isNaN(u) || isNaN(v)) return "Usage: tp <u> <v>";
    if (typeof window !== "undefined" && typeof window._teleportHero === "function") {
      window._teleportHero(u, v);
      return `Teleported to (${u}, ${v})`;
    }
    return "No _teleportHero hook found.";
  });
  addCommand("debug", "Toggle debug overlays  debug [ai|hitbox|astar|all|off]", (args) => {
    const t = (args[0] || "").toLowerCase();
    if (t === "off" || t === "") { debug.showAI = debug.showHitboxes = debug.showAStarGrid = false; return "Debug overlays OFF"; }
    if (t === "all") { debug.showAI = debug.showHitboxes = debug.showAStarGrid = true; return "All debug ON"; }
    if (t === "ai")    { debug.showAI         = !debug.showAI;         return `AI debug ${debug.showAI ? "ON" : "OFF"}`; }
    if (t === "hitbox"){ debug.showHitboxes   = !debug.showHitboxes;   return `Hitbox debug ${debug.showHitboxes ? "ON" : "OFF"}`; }
    if (t === "astar") { debug.showAStarGrid  = !debug.showAStarGrid;  return `A* grid ${debug.showAStarGrid ? "ON" : "OFF"}`; }
    return "Unknown overlay. Try: ai, hitbox, astar, all, off";
  });

  return { register, get, has, list, time, debug, addCommand, runCommand, listCommands };
});
