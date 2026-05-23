/**
 * ecs_morale_panic.js — Enemy morale break + panic flee system for 5DEngine
 *
 * Ported from 5DEngineMassive/index.html:
 *   Lines 1231:    _recentKillPos tracker (morale tracker)
 *   Lines 1315-1327: trigger: 3+ kills in 4s within 10m → _panicT = 3.0
 *   Lines 7126-7152: flee behavior: move away from hero at 1.3× moveSpeed for panicT seconds
 *
 * Phase 1 — Trigger (per-kill via "enemy:killed" event):
 *   Maintain a rolling kill list (u, v, t) pruned to a 4s window.
 *   When ≥3 kills exist AND panic broadcast CD (4s) has elapsed:
 *     scan all alive enemies within 10m of any kill position → set ai._panicT = 3.0
 *     emit "morale:panic_broadcast { count }"
 *
 * Phase 2 — Flee (per-tick):
 *   For each enemy with ai._panicT > 0:
 *     decrement timer, move directly away from hero at moveSpeed × 1.3
 *     emit "enemy:panicking { entityId }" each tick for VFX
 *
 * Events emitted on Core:
 *   "morale:panic_broadcast" { count }                — when panic spreads
 *   "enemy:panicking"        { entityId }             — every tick while fleeing
 *
 * Events listened to on Core:
 *   "enemy:killed" { entityId, type, u, v }
 *
 * Usage:
 *   const sys = createMoralePanicSystem();
 *   Core.addSystem(sys, 15, "morale_panic"); // after ai_movement:12
 */

export const MORALE_KILL_WINDOW    = 4.0;   // monolith line 1316: kills tracked within 4s
export const MORALE_KILL_THRESHOLD = 3;     // monolith line 1317: 3+ kills trigger panic
export const MORALE_PANIC_RADIUS   = 10;    // monolith line 1325: 10m radius from kill pos
export const MORALE_PANIC_DUR      = 3.0;   // monolith line 1325: panic lasts 3s
export const MORALE_PANIC_SPEED_MUL = 1.3;  // monolith line 7133: flee at 1.3× moveSpeed
export const MORALE_BROADCAST_CD   = 4.0;   // monolith line 1317: min between broadcasts

/**
 * createMoralePanicSystem() → system function
 */
export function createMoralePanicSystem() {
  let _elapsed          = 0;
  let _recentKills      = [];   // [{ u, v, t }] — pruned to MORALE_KILL_WINDOW
  let _panicBroadcastT  = -999;
  let _wired            = false;

  function system(dt, core) {
    _elapsed += dt;

    // Wire kill listener once
    if (!_wired) {
      _wired = true;
      core.on("enemy:killed", ({ u, v }) => {
        if (u == null || v == null) return;
        _recentKills.push({ u, v, t: _elapsed });
      });
    }

    // Prune old kills
    _recentKills = _recentKills.filter(k => _elapsed - k.t < MORALE_KILL_WINDOW);

    // Panic broadcast — 3+ kills in window AND broadcast CD elapsed
    if (_recentKills.length >= MORALE_KILL_THRESHOLD &&
        _elapsed - _panicBroadcastT >= MORALE_BROADCAST_CD) {
      _panicBroadcastT = _elapsed;
      const enemies = core.query("EnemyAI", "Transform", "Health");
      let count = 0;
      for (const id of enemies) {
        const ai = core.getComponent(id, "EnemyAI");
        const t  = core.getComponent(id, "Transform");
        const h  = core.getComponent(id, "Health");
        if (!ai || !t || !h) continue;
        if (h.hp <= 0 || ai._panicT > 0) continue;
        for (const k of _recentKills) {
          if (Math.hypot(t.u - k.u, t.v - k.v) < MORALE_PANIC_RADIUS) {
            ai._panicT = MORALE_PANIC_DUR;
            count++;
            break;
          }
        }
      }
      if (count > 0) {
        core.emit("morale:panic_broadcast", { count });
      }
    }

    // Per-tick: flee behavior for panicking enemies
    const heroIds = core.query("PlayerControl", "Transform");
    const heroId  = heroIds[0] ?? null;
    const heroT   = heroId != null ? core.getComponent(heroId, "Transform") : null;

    const enemies = core.query("EnemyAI", "Transform", "Health");
    for (const id of enemies) {
      const ai = core.getComponent(id, "EnemyAI");
      const t  = core.getComponent(id, "Transform");
      const h  = core.getComponent(id, "Health");
      if (!ai || !t || !h) continue;
      if (!(ai._panicT > 0)) continue;
      if (h.hp <= 0) { ai._panicT = 0; continue; }

      ai._panicT -= dt;

      if (heroT) {
        // Move directly away from hero (enemy → away, not toward)
        const dx  = t.u - heroT.u;
        const dz  = t.v - heroT.v;
        const mag = Math.hypot(dx, dz) || 1;
        const spd = (ai.moveSpeed ?? 2.4) * MORALE_PANIC_SPEED_MUL;
        t.u += (dx / mag) * spd * dt;
        t.v += (dz / mag) * spd * dt;
      }

      core.emit("enemy:panicking", { entityId: id });
    }
  }

  return system;
}

export default {
  createMoralePanicSystem,
  MORALE_KILL_WINDOW, MORALE_KILL_THRESHOLD,
  MORALE_PANIC_RADIUS, MORALE_PANIC_DUR,
  MORALE_PANIC_SPEED_MUL, MORALE_BROADCAST_CD,
};
