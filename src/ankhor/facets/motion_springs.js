/** motion-springs facet — native Ankhor replacement for the legacy
 *  mountMotionSprings (data/legacy/motion-springs.json).
 *
 *  Legacy contract (src/systems/motion_springs.js):
 *
 *    tick(dt, { moveSpreadTarget, isMoving, inCar, buildMode, heroDead,
 *               canSprint, inputR, aiming }) {
 *      moveSpread += (moveSpreadTarget - moveSpread) * min(1, dt*5)
 *      if (isMoving && !inCar && !buildMode && !heroDead)
 *        gunBobPhase += (canSprint ? 11 : 7) * dt
 *      else
 *        gunBobPhase *= exp(-dt * 8)
 *      const rollTarget = inputR * (aiming ? 0.3 : 1.0)
 *      strafeRollAmt += (rollTarget - strafeRollAmt) * min(1, dt*8)
 *    }
 *
 *  Native version:
 *    - State on hero.inventory: move_spread, gun_bob_phase,
 *      strafe_roll_amt.
 *    - move_spread_target read from inv (written by crouch-speed
 *      facet at iter 802).
 *    - isMoving / canSprint from input-state keys (W/A/S/D + Shift).
 *    - in_car, build_mode, hero_dead, aiming, input_r read from inv.
 *    - All 7 constants in hero-tuning with provenance.
 *
 *  Priority 23: after crouch-speed (19) so move_spread_target reflects
 *  this frame's input; before stamina (24) so the spring follows
 *  before stamina-driven movement reactions.
 *
 *  NO hardcoded numbers; no `??` fallbacks. */
export default {
  priority: 23,
  tick(_thing, _data, dt, registry) {
    const tn = readHeroTuning(registry);
    if (!tn) return;

    const heroes = registry.byKind("hero");
    if (heroes.length === 0) return;
    const inv = registry.facetData(heroes[0].id, "inventory");
    if (!inv) return;

    if (typeof inv.move_spread        !== "number") inv.move_spread        = 0;
    if (typeof inv.gun_bob_phase      !== "number") inv.gun_bob_phase      = 0;
    if (typeof inv.strafe_roll_amt    !== "number") inv.strafe_roll_amt    = 0;
    if (typeof inv.move_spread_target !== "number") inv.move_spread_target = 0;
    if (typeof inv.input_r            !== "number") inv.input_r            = 0;

    const keys      = readInputKeys(registry);
    const canSprint = keys.ShiftLeft === true;
    const isMoving  = keys.KeyW === true || keys.KeyA === true
                   || keys.KeyS === true || keys.KeyD === true;
    const inCar     = inv.in_car    === true;
    const buildMode = inv.build_mode === true;
    const heroDead  = inv.hero_dead === true;
    const aiming    = inv.aiming    === true;

    inv.move_spread += (inv.move_spread_target - inv.move_spread)
                       * Math.min(1, dt * tn.move_spread_spring_rate);

    if (isMoving && !inCar && !buildMode && !heroDead) {
      const rate = canSprint ? tn.gun_bob_phase_sprint_rate : tn.gun_bob_phase_walk_rate;
      inv.gun_bob_phase += rate * dt;
    } else {
      inv.gun_bob_phase *= Math.exp(-dt * tn.gun_bob_decay_rate);
    }

    const rollMul    = aiming ? tn.strafe_roll_aiming_mul : tn.strafe_roll_normal_mul;
    const rollTarget = inv.input_r * rollMul;
    inv.strafe_roll_amt += (rollTarget - inv.strafe_roll_amt)
                           * Math.min(1, dt * tn.strafe_roll_spring_rate);
  },
};

function readHeroTuning(registry) {
  for (const t of registry.byKind("tuning")) {
    if (t.name !== "hero-tuning") continue;
    const tn = registry.facetData(t.id, "tuning");
    if (!tn) return null;
    if (typeof tn.move_spread_spring_rate    !== "number") return null;
    if (typeof tn.gun_bob_phase_sprint_rate  !== "number") return null;
    if (typeof tn.gun_bob_phase_walk_rate    !== "number") return null;
    if (typeof tn.gun_bob_decay_rate         !== "number") return null;
    if (typeof tn.strafe_roll_aiming_mul     !== "number") return null;
    if (typeof tn.strafe_roll_normal_mul     !== "number") return null;
    if (typeof tn.strafe_roll_spring_rate    !== "number") return null;
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
