/** hero-input-move facet — reads byKind("input")[0]'s input-state
 *  and the hero's tuning (walk_speed, sprint_speed), and moves the
 *  hero's position accordingly. Movement is yaw-relative: W goes
 *  forward in the camera's facing direction.
 *
 *  Lift-ready per docs/ACTOR_TRAJECTORY.md: builds the new position
 *  as locals before assigning. After the lift, the assignment
 *  becomes a `patch` returned to the scheduler.
 *
 *  Cross-Thing reach into byKind("input") and byKind("tuning") is
 *  the same pattern chase-target/attack-target already use. Strike
 *  count toward actor-lift unchanged.
 *
 *  Data: { } — no per-hero state needed; everything comes from the
 *  input Thinga + the hero-tuning Thinga. */
export default {
  priority: 10,
  tick(thing, _data, dt, registry) {
    const inv = registry.facetData(thing.id, "inventory");
    if (inv && inv.in_vehicle_id) return;  // hero drives via vehicle-drive while seated
    const pos = registry.facetData(thing.id, "position");
    if (!pos) return;

    const inputs = registry.byKind("input");
    if (inputs.length === 0) return;
    const inputState = registry.facetData(inputs[0].id, "input-state");
    if (!inputState) return;
    const keys = inputState.keys || {};
    const yaw  = inputState.yaw  || 0;

    const { walkSpeed, sprintSpeed, keyMap } = resolveTuning(registry);
    const speed = keys[keyMap.sprint] ? sprintSpeed : walkSpeed;
    if (speed <= 0) return;

    let intentForward = 0, intentRight = 0;
    if (keys[keyMap.forward]) intentForward += 1;
    if (keys[keyMap.back])    intentForward -= 1;
    if (keys[keyMap.right])   intentRight   += 1;
    if (keys[keyMap.left])    intentRight   -= 1;
    if (intentForward === 0 && intentRight === 0) {
      pos.heading = yaw;
      return;
    }

    const len = Math.hypot(intentForward, intentRight);
    const fNorm = intentForward / len;
    const rNorm = intentRight   / len;

    const forwardX = -Math.sin(yaw);
    const forwardZ = -Math.cos(yaw);
    const rightX   =  Math.cos(yaw);
    const rightZ   = -Math.sin(yaw);

    const dx = (forwardX * fNorm + rightX * rNorm) * speed * dt;
    const dz = (forwardZ * fNorm + rightZ * rNorm) * speed * dt;

    const newX = pos.x + dx;
    const newZ = pos.z + dz;
    pos.x = newX;
    pos.z = newZ;
    pos.heading = yaw;
  }
};

function resolveTuning(registry) {
  let walkSpeed = 0, sprintSpeed = 0;
  let keyMap = { forward: "", back: "", left: "", right: "", sprint: "" };
  for (const t of registry.byKind("tuning")) {
    if (t.name === "hero-tuning") {
      const tuning = registry.facetData(t.id, "tuning") || {};
      if (typeof tuning.walk_speed   === "number") walkSpeed   = tuning.walk_speed;
      if (typeof tuning.sprint_speed === "number") sprintSpeed = tuning.sprint_speed;
    } else if (t.name === "input-default-tuning") {
      const tuning = registry.facetData(t.id, "tuning") || {};
      keyMap = {
        forward: tuning.key_forward || "",
        back:    tuning.key_back    || "",
        left:    tuning.key_left    || "",
        right:   tuning.key_right   || "",
        sprint:  tuning.key_sprint  || "",
      };
    }
  }
  return { walkSpeed, sprintSpeed, keyMap };
}
