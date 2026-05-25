/** crouch-speed facet — native Ankhor replacement for the legacy
 *  mountCrouchSpeedTick (data/legacy/crouch-speed.json).
 *
 *  Legacy contract (src/systems/crouch_speed_tick.js):
 *
 *    let crouchAmt = 0;
 *    tick(dt, {keys, buildMode, inCar, computerOpen, heroDead,
 *              aiming, isSprinting, isMoving, pointerLocked}) {
 *      const crouching = (keys.ControlLeft || keys.ControlRight)
 *                        && !buildMode && !inCar && !computerOpen;
 *      crouchAmt += ((crouching ? 1 : 0) - crouchAmt) * min(1, dt*12);
 *      const crouchSpeedMul = 1 - crouchAmt * 0.4;
 *      const moveSpreadTarget = aiming
 *        ? 0
 *        : isSprinting ? 1
 *        : isMoving ? (crouching ? 0.18 : 0.45)
 *        : (crouching ? 0 : 0);
 *      if (isSprinting && isMoving && !heroDead && pointerLocked
 *          && Math.random() < 0.45) actions.spawnSprintTrail();
 *      return { crouching, crouchAmt, crouchSpeedMul, moveSpreadTarget };
 *    }
 *
 *  Native version:
 *    - State on hero.inventory: crouch_amt, crouch_speed_mul,
 *      move_spread_target, crouching.
 *    - Reads input-state keys (ControlLeft/Right, ShiftLeft, W/A/S/D,
 *      pointer_locked). buildMode/inCar/computerOpen/heroDead/aiming
 *      gated by substrate state on inv (default false).
 *    - Tuning from hero-tuning: crouch_spring_rate, crouch_speed_factor,
 *      move_spread_aiming/sprint/walk/walk_crouch/idle, sprint_trail_chance,
 *      sprint_trail_ttl, sprint_trail_y.
 *    - Sprint trail spawn matches legacy 45% chance via Math.random
 *      (preserved feel; deterministic test skips the stochastic spawn).
 *
 *  Priority 19: ahead of dodge (20) so other movement facets can
 *  read crouch_speed_mul/move_spread_target this same tick.
 *
 *  NO hardcoded numbers; no `??` fallbacks. */
export default {
  priority: 19,
  tick(_thing, _data, dt, registry) {
    const tn = readHeroTuning(registry);
    if (!tn) return;

    const heroes = registry.byKind("hero");
    if (heroes.length === 0) return;
    const hero = heroes[0];
    const inv = registry.facetData(hero.id, "inventory");
    if (!inv) return;

    const pos = registry.facetData(hero.id, "position");

    const keys = readInputKeys(registry);

    const buildMode    = inv.build_mode    === true;
    const inCar        = inv.in_car        === true;
    const computerOpen = inv.computer_open === true;
    const heroDead     = inv.hero_dead     === true;
    const aiming       = inv.aiming        === true;
    const pointerLocked = readPointerLocked(registry);
    const isSprinting  = keys.ShiftLeft === true;
    const isMoving = keys.KeyW === true || keys.KeyA === true
                  || keys.KeyS === true || keys.KeyD === true;

    const crouching = (keys.ControlLeft === true || keys.ControlRight === true)
                   && !buildMode && !inCar && !computerOpen;

    if (typeof inv.crouch_amt !== "number") inv.crouch_amt = 0;
    inv.crouch_amt += ((crouching ? 1 : 0) - inv.crouch_amt) * Math.min(1, dt * tn.crouch_spring_rate);
    inv.crouch_speed_mul = 1 - inv.crouch_amt * tn.crouch_speed_factor;

    inv.crouching = crouching;
    inv.move_spread_target = aiming ? tn.move_spread_aiming
      : isSprinting ? tn.move_spread_sprint
      : isMoving ? (crouching ? tn.move_spread_walk_crouch : tn.move_spread_walk)
      : tn.move_spread_idle;

    if (isSprinting && isMoving && !heroDead && pointerLocked
        && Math.random() < tn.sprint_trail_chance && pos) {
      spawnSprintTrail(pos, registry, tn);
    }
  },
};

function readHeroTuning(registry) {
  for (const t of registry.byKind("tuning")) {
    if (t.name !== "hero-tuning") continue;
    const tn = registry.facetData(t.id, "tuning");
    if (!tn) return null;
    if (typeof tn.crouch_spring_rate     !== "number") return null;
    if (typeof tn.crouch_speed_factor    !== "number") return null;
    if (typeof tn.move_spread_aiming     !== "number") return null;
    if (typeof tn.move_spread_sprint     !== "number") return null;
    if (typeof tn.move_spread_walk       !== "number") return null;
    if (typeof tn.move_spread_walk_crouch!== "number") return null;
    if (typeof tn.move_spread_idle       !== "number") return null;
    if (typeof tn.sprint_trail_chance    !== "number") return null;
    if (typeof tn.sprint_trail_ttl       !== "number") return null;
    if (typeof tn.sprint_trail_y         !== "number") return null;
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

function readPointerLocked(registry) {
  const inputs = registry.byKind("input");
  if (inputs.length === 0) return false;
  const st = registry.facetData(inputs[0].id, "input-state");
  return st ? st.pointer_locked === true : false;
}

function spawnSprintTrail(pos, registry, tn) {
  const seq = (registry._sprintTrailSeq = (registry._sprintTrailSeq || 0) + 1);
  const id  = `decal-particle/sprint-trail-${seq}`;
  try {
    registry.spawn({
      id, kind: "decal-particle", name: id,
      facets: [
        { name: "position",    data: { x: pos.x, y: pos.y + tn.sprint_trail_y, z: pos.z } },
        { name: "mesh",        data: { tuning_ref: "decal-particle-impact-tuning" } },
        { name: "ttl",         data: { remaining: tn.sprint_trail_ttl } },
        { name: "expand-fade", data: {} },
      ],
    });
  } catch (_) { /* duplicate within same ms ok */ }
}
