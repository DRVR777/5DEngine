/** sniper-sway facet — native Ankhor replacement for the legacy
 *  mountSniperSway (data/legacy/sniper-sway.json).
 *
 *  Legacy contract (src/systems/sniper_sway.js):
 *
 *    tick(dt, { isSniperScope, heroDead, holdingBreath, crouching }) {
 *      if (isSniperScope && !heroDead) {
 *        scopeSwayT += dt
 *        breathHoldT = holdingBreath
 *          ? min(breathHoldT + dt, 3.0)
 *          : max(0, breathHoldT - dt * 2.5)
 *        breathMul = breathHoldT < 1.5
 *          ? (holdingBreath ? 0.05 + (breathHoldT/1.5)*0.05 : 1.0)
 *          : 1.0 + (breathHoldT - 1.5) * 2.2
 *        swayMul = (crouching ? 0.25 : 1.0) * breathMul
 *        camPitch -= lastSwayPitch  // subtract previous absolute sway
 *        camYaw   -= lastSwayYaw
 *        newPitch = sin(scopeSwayT * 0.9) * 0.0025 * swayMul
 *        newYaw   = sin(scopeSwayT * 0.6 + 1.2) * 0.002 * swayMul
 *        lastSwayPitch = newPitch; lastSwayYaw = newYaw
 *        camPitch += newPitch; camYaw += newYaw
 *      } else {
 *        camPitch -= lastSwayPitch; camYaw -= lastSwayYaw
 *        lastSwayPitch = 0; lastSwayYaw = 0
 *        scopeSwayT = 0; breathHoldT = 0
 *      }
 *    }
 *
 *  Native version:
 *    - State on hero.inventory: scope_sway_t, breath_hold_t,
 *      last_sway_pitch, last_sway_yaw, cam_pitch, cam_yaw.
 *      cam_pitch is the same field cam-pitch-springs writes; sway
 *      adds to it after subtracting previous frame's sway, so the
 *      two facets compose cleanly.
 *    - Inputs from hero.inventory: is_sniper_scope, hero_dead;
 *      holding_breath via input-state key (KeyB) and crouching via
 *      ControlLeft (matches legacy spec bindings).
 *    - All 9 constants in hero-tuning.
 *
 *  Priority 24: after cam-pitch-springs (21) so its recoil/hitpunch
 *  is committed to cam_pitch before sway adjusts. Same frame ordering
 *  the legacy mount* sequence enforced.
 *
 *  NO hardcoded numbers; no `??` fallbacks. */
export default {
  priority: 24,
  tick(_thing, _data, dt, registry) {
    const tn = readHeroTuning(registry);
    if (!tn) return;

    const heroes = registry.byKind("hero");
    if (heroes.length === 0) return;
    const inv = registry.facetData(heroes[0].id, "inventory");
    if (!inv) return;

    if (typeof inv.cam_pitch        !== "number") inv.cam_pitch        = 0;
    if (typeof inv.cam_yaw          !== "number") inv.cam_yaw          = 0;
    if (typeof inv.scope_sway_t     !== "number") inv.scope_sway_t     = 0;
    if (typeof inv.breath_hold_t    !== "number") inv.breath_hold_t    = 0;
    if (typeof inv.last_sway_pitch  !== "number") inv.last_sway_pitch  = 0;
    if (typeof inv.last_sway_yaw    !== "number") inv.last_sway_yaw    = 0;

    const keys           = readInputKeys(registry);
    const isSniperScope  = inv.is_sniper_scope === true;
    const heroDead       = inv.hero_dead       === true;
    const holdingBreath  = keys.KeyB        === true;
    const crouching      = keys.ControlLeft === true;

    if (isSniperScope && !heroDead) {
      inv.scope_sway_t += dt;
      inv.breath_hold_t = holdingBreath
        ? Math.min(inv.breath_hold_t + dt, tn.breath_hold_cap)
        : Math.max(0, inv.breath_hold_t - dt * tn.breath_release_rate);
      const breathMul = inv.breath_hold_t < tn.breath_steady_threshold
        ? (holdingBreath
            ? tn.breath_steady_min + (inv.breath_hold_t / tn.breath_steady_threshold) * tn.breath_steady_min
            : tn.breath_neutral_mul)
        : tn.breath_neutral_mul + (inv.breath_hold_t - tn.breath_steady_threshold) * tn.breath_overshoot_rate;
      const swayMul = (crouching ? tn.sway_crouch_mul : tn.sway_stand_mul) * breathMul;

      inv.cam_pitch -= inv.last_sway_pitch;
      inv.cam_yaw   -= inv.last_sway_yaw;
      const newPitch = Math.sin(inv.scope_sway_t * tn.sway_pitch_freq) * tn.sway_pitch_amp * swayMul;
      const newYaw   = Math.sin(inv.scope_sway_t * tn.sway_yaw_freq + tn.sway_yaw_phase) * tn.sway_yaw_amp * swayMul;
      inv.last_sway_pitch = newPitch;
      inv.last_sway_yaw   = newYaw;
      inv.cam_pitch += newPitch;
      inv.cam_yaw   += newYaw;
    } else {
      inv.cam_pitch -= inv.last_sway_pitch;
      inv.cam_yaw   -= inv.last_sway_yaw;
      inv.last_sway_pitch = 0;
      inv.last_sway_yaw   = 0;
      inv.scope_sway_t    = 0;
      inv.breath_hold_t   = 0;
    }
  },
};

function readHeroTuning(registry) {
  for (const t of registry.byKind("tuning")) {
    if (t.name !== "hero-tuning") continue;
    const tn = registry.facetData(t.id, "tuning");
    if (!tn) return null;
    if (typeof tn.breath_hold_cap         !== "number") return null;
    if (typeof tn.breath_release_rate     !== "number") return null;
    if (typeof tn.breath_steady_threshold !== "number") return null;
    if (typeof tn.breath_steady_min       !== "number") return null;
    if (typeof tn.breath_neutral_mul      !== "number") return null;
    if (typeof tn.breath_overshoot_rate   !== "number") return null;
    if (typeof tn.sway_crouch_mul         !== "number") return null;
    if (typeof tn.sway_stand_mul          !== "number") return null;
    if (typeof tn.sway_pitch_freq         !== "number") return null;
    if (typeof tn.sway_pitch_amp          !== "number") return null;
    if (typeof tn.sway_yaw_freq           !== "number") return null;
    if (typeof tn.sway_yaw_amp            !== "number") return null;
    if (typeof tn.sway_yaw_phase          !== "number") return null;
    return tn;
  }
  return null;
}

function readInputKeys(registry) {
  const inputs = registry.byKind("input");
  if (inputs.length === 0) return {};
  const st = registry.facetData(inputs[0].id, "input-state");
  return (st && st.keys) ? st.keys : {};
}
