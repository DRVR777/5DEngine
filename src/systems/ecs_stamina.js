/**
 * ecs_stamina.js — ECS sprint/stamina system for 5DEngine
 *
 * Ported from 5DEngineMassive/index.html lines 6009-6013, 6286-6290, 2770:
 *   STAMINA_MAX     = 100   → line 6009
 *   STAMINA_DRAIN   = 22    → line 6011 (per second while sprinting)
 *   STAMINA_REGEN   = 14    → line 6012 (per second when not sprinting)
 *   STAMINA_LOCKOUT = 15    → line 6013 (minimum to re-enter sprint)
 *   LVL 3 perk: extraStaminaMax += 25  → line 2770
 *   Dodge cost: -20 stamina → line 5292
 *
 * Stamina component (on hero entity):
 *   Stamina: { stamina, staminaMax, extraStaminaMax, wantsSprint, isSprinting }
 *   - stamina: current value [0 .. staminaMax + extraStaminaMax]
 *   - staminaMax: base cap (100)
 *   - extraStaminaMax: bonus cap from LVL 3 perk (default 0)
 *   - wantsSprint: true when sprint input held
 *   - isSprinting: true when actually sprinting (may differ if locked out)
 *
 * Events listened to on Core:
 *   "player:sprint_start"  { heroId }    — player pressed sprint key
 *   "player:sprint_stop"   { heroId }    — player released sprint key
 *   "player:dodge"         { heroId }    — player triggered dodge roll (-20 stamina)
 *   "stamina:add_max"      { heroId, amount } — perk LVL 3 extends max stamina
 *
 * Events emitted on Core:
 *   "stamina:changed"       { heroId, stamina, max, isSprinting }
 *   "stamina:depleted"      { heroId }   — stamina hit 0 (sprint force-stopped)
 *   "stamina:sprint_blocked" { heroId }  — tried to sprint but stamina < LOCKOUT
 *
 * Usage:
 *   const sys = createStaminaSystem();
 *   Core.addSystem(sys, 18, "stamina"); // between inventory:5 and weapon:8? No — after weapon
 *   // Actually priority 18: after weapon(8), ai(12), status(15), before regen(35)
 */

export const STAMINA_MAX     = 100;
export const STAMINA_DRAIN   = 22;   // HP/s while sprinting
export const STAMINA_REGEN   = 14;   // HP/s when not sprinting
export const STAMINA_LOCKOUT = 15;   // must have ≥ this to re-enter sprint
export const DODGE_COST      = 20;   // stamina cost per dodge roll

export function createStaminaSystem() {
  let _wired = false;

  function _getMax(st) {
    return (st.staminaMax ?? STAMINA_MAX) + (st.extraStaminaMax ?? 0);
  }

  function system(dt, core) {
    if (!_wired) {
      _wired = true;

      core.on("player:sprint_start", ({ heroId }) => {
        const st = core.getComponent(heroId, "Stamina");
        if (st) st.wantsSprint = true;
      });

      core.on("player:sprint_stop", ({ heroId }) => {
        const st = core.getComponent(heroId, "Stamina");
        if (st) { st.wantsSprint = false; st.isSprinting = false; }
      });

      core.on("player:dodge", ({ heroId }) => {
        const st = core.getComponent(heroId, "Stamina");
        if (!st) return;
        st.stamina = Math.max(0, st.stamina - DODGE_COST);
        core.emit("stamina:changed", { heroId, stamina: st.stamina, max: _getMax(st), isSprinting: st.isSprinting ?? false });
      });

      core.on("stamina:add_max", ({ heroId, amount }) => {
        const st = core.getComponent(heroId, "Stamina");
        if (!st) return;
        st.extraStaminaMax = (st.extraStaminaMax ?? 0) + amount;
        // Immediately top up by the bonus amount (monolith line 2770)
        st.stamina = Math.min(_getMax(st), st.stamina + amount);
        core.emit("stamina:changed", { heroId, stamina: st.stamina, max: _getMax(st), isSprinting: st.isSprinting ?? false });
      });
    }

    // Per-tick update for all entities with Stamina + PlayerControl
    const ids = core.query("PlayerControl", "Stamina");
    for (const heroId of ids) {
      const st = core.getComponent(heroId, "Stamina");
      if (!st) continue;

      const maxSt = _getMax(st);
      const prevSt = st.stamina;

      if (st.wantsSprint) {
        // Can enter sprint if stamina >= LOCKOUT (or already sprinting with any stamina left)
        const canSprint = st.isSprinting ? st.stamina >= 1 : st.stamina >= STAMINA_LOCKOUT;
        if (canSprint) {
          st.isSprinting = true;
          st.stamina = Math.max(0, st.stamina - STAMINA_DRAIN * dt);
          if (st.stamina === 0 && prevSt > 0) {
            st.isSprinting = false;
            core.emit("stamina:depleted", { heroId });
          }
        } else {
          if (!st.isSprinting) core.emit("stamina:sprint_blocked", { heroId });
          st.isSprinting = false;
          // Regen even when wanting to sprint but blocked
          st.stamina = Math.min(maxSt, st.stamina + STAMINA_REGEN * dt);
        }
      } else {
        st.isSprinting = false;
        if (st.stamina < maxSt) {
          st.stamina = Math.min(maxSt, st.stamina + STAMINA_REGEN * dt);
        }
      }

      if (st.stamina !== prevSt) {
        core.emit("stamina:changed", { heroId, stamina: st.stamina, max: maxSt, isSprinting: st.isSprinting });
      }
    }
  }

  return system;
}

export default { createStaminaSystem, STAMINA_MAX, STAMINA_DRAIN, STAMINA_REGEN, STAMINA_LOCKOUT, DODGE_COST };
