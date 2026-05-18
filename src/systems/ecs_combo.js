/**
 * ecs_combo.js — Kill combo multiplier system for 5DEngine
 *
 * Ported from 5DEngineMassive/index.html lines 1264-1266, 8831-8851:
 *   Line 1264: _comboCount = 0 — kill streak counter
 *   Line 1266: _COMBO_DECAY = 3.5s — seconds without kill to break combo
 *   Line 8836: COMBO_MAX_MUL = 8 (Math.min(8, _comboCount))
 *   Lines 8838-8851: milestones at x2, x4, x6, x8 → toast + audio
 *
 * Listens on Core:
 *   "enemy:killed" { entityId } → increments combo count, resets decay timer
 *
 * Events emitted on Core:
 *   "combo:updated"   { count, multiplier }   — on every kill
 *   "combo:milestone" { multiplier, label }   — first time reaching x2/x4/x6/x8
 *   "combo:reset"     { prevCount }           — when decay timer expires
 *
 * Usage:
 *   const sys = createComboSystem();
 *   sys.wireListeners(Core);
 *   Core.addSystem(sys, 6, "combo"); // early, before score/loot systems
 */

export const COMBO_DECAY        = 3.5;  // monolith line 1266: 3.5s without kill breaks combo
export const COMBO_MAX_MUL      = 8;    // monolith line 8836: Math.min(8, _comboCount)
export const COMBO_MILESTONES   = [2, 4, 6, 8];
export const COMBO_MILESTONE_LABELS = {
  2: "DOUBLE KILL!",
  4: "QUAD KILL!",
  6: "RAMPAGE!",
  8: "GODLIKE!",
};

/**
 * createComboSystem() → system function
 */
export function createComboSystem() {
  let _comboCount        = 0;
  let _comboLastT        = -999;
  let _announcedMul      = 0;
  let _elapsed           = 0;

  function system(dt, core) {
    _elapsed += dt;

    if (_comboCount > 0 && _elapsed - _comboLastT > COMBO_DECAY) {
      const prev = _comboCount;
      _comboCount   = 0;
      _announcedMul = 0;
      core.emit("combo:reset", { prevCount: prev });
    }
  }

  function wireListeners(core) {
    core.on("enemy:killed", () => {
      _comboCount++;
      _comboLastT = _elapsed;

      const mul = Math.min(COMBO_MAX_MUL, _comboCount);
      core.emit("combo:updated", { count: _comboCount, multiplier: mul });

      for (const m of COMBO_MILESTONES) {
        if (mul >= m && _announcedMul < m) {
          _announcedMul = m;
          core.emit("combo:milestone", {
            multiplier: m,
            label: COMBO_MILESTONE_LABELS[m],
          });
          break;
        }
      }
    });
  }

  // Expose state for tests and HUD
  system.getCount      = () => _comboCount;
  system.getMultiplier = () => Math.min(COMBO_MAX_MUL, _comboCount);
  system.wireListeners = wireListeners;
  return system;
}

export default {
  createComboSystem,
  COMBO_DECAY, COMBO_MAX_MUL, COMBO_MILESTONES, COMBO_MILESTONE_LABELS,
};
