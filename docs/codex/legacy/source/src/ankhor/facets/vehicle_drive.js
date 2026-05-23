/** vehicle-drive facet — on each vehicle. Drives the vehicle when a
 *  hero's inventory.in_vehicle_id == this thing's id.
 *
 *  Throttle = (W-S) * acceleration applied along heading.
 *  Steering = (D-A) * turn_rate * dt added to heading; only effective
 *  while the vehicle is moving (no in-place pivot).
 *  Drag decays speed each tick; brake_drag applies if S is held while
 *  moving forward.
 *  All numbers from the vehicle's variant tuning via mesh.tuning_ref.
 *
 *  Each tick also teleports the driver hero to the passenger seat
 *  above the vehicle so the hero mesh tracks the car visually. (Camera
 *  follows the vehicle independently via boot.js updateCamera.)
 *
 *  Priority 11: same slot as aabb-collision. Runs only when driven,
 *  so non-driven vehicles cost ~nothing.
 *
 *  Lift-ready: builds new position + heading + speed as locals first.
 *
 *  Data: { speed? } */
export default {
  priority: 11,
  tick(thing, data, dt, registry) {
    if (!data) return;
    const driverHero = findDriverHero(thing.id, registry);
    if (!driverHero) {
      if (typeof data.speed === "number" && data.speed !== 0) data.speed = 0;
      return;
    }
    const pos = registry.facetData(thing.id, "position");
    if (!pos) return;
    const tn = resolveVehicleTuning(thing, registry);
    if (!tn) return;
    const inputs = registry.byKind("input");
    if (inputs.length === 0) return;
    const input = registry.facetData(inputs[0].id, "input-state");
    if (!input) return;
    const keyMap = resolveInputKeyMap(registry);
    if (!keyMap) return;

    const keys = input.keys || {};
    const fwd  = keys[keyMap.forward] ? 1 : 0;
    const back = keys[keyMap.back]    ? 1 : 0;
    const right = keys[keyMap.right]  ? 1 : 0;
    const left  = keys[keyMap.left]   ? 1 : 0;

    let speed = typeof data.speed === "number" ? data.speed : 0;
    const heading = typeof pos.heading === "number" ? pos.heading : 0;

    if (fwd && !back)      speed += tn.acceleration * dt;
    else if (back && !fwd) speed -= tn.acceleration * tn.reverse_factor * dt;
    if (speed > tn.max_speed) speed = tn.max_speed;
    if (speed < -tn.max_speed * tn.reverse_factor) speed = -tn.max_speed * tn.reverse_factor;

    const drag = (back && speed > 0) ? tn.brake_drag : tn.drag;
    if (Math.abs(speed) > 0) {
      const decay = Math.min(Math.abs(speed), drag * dt);
      speed -= Math.sign(speed) * decay;
    }

    let newHeading = heading;
    if (Math.abs(speed) > 0.01) {
      const steer = (right - left) * tn.turn_rate_rad * dt;
      const directionFactor = speed >= 0 ? 1 : -1;
      newHeading += steer * directionFactor;
    }

    const dirX = -Math.sin(newHeading);
    const dirZ = -Math.cos(newHeading);
    const newX = pos.x + dirX * speed * dt;
    const newZ = pos.z + dirZ * speed * dt;

    pos.x = newX;
    pos.z = newZ;
    pos.heading = newHeading;
    data.speed = speed;

    const heroPos = registry.facetData(driverHero.id, "position");
    if (heroPos) {
      heroPos.x = newX;
      heroPos.y = tn.passenger_seat_y;
      heroPos.z = newZ;
      heroPos.heading = newHeading;
    }
  }
};

function findDriverHero(vehicleId, registry) {
  for (const h of registry.byKind("hero")) {
    const inv = registry.facetData(h.id, "inventory");
    if (inv && inv.in_vehicle_id === vehicleId) return h;
  }
  return null;
}

function resolveVehicleTuning(thing, registry) {
  const mesh = registry.facetData(thing.id, "mesh");
  if (!mesh || typeof mesh.tuning_ref !== "string") return null;
  for (const t of registry.byKind("tuning")) {
    if (t.name !== mesh.tuning_ref) continue;
    const tn = registry.facetData(t.id, "tuning");
    if (!tn) return null;
    if (typeof tn.acceleration      !== "number") return null;
    if (typeof tn.max_speed         !== "number") return null;
    if (typeof tn.reverse_factor    !== "number") return null;
    if (typeof tn.drag              !== "number") return null;
    if (typeof tn.brake_drag        !== "number") return null;
    if (typeof tn.turn_rate_rad     !== "number") return null;
    if (typeof tn.passenger_seat_y  !== "number") return null;
    return tn;
  }
  return null;
}

function resolveInputKeyMap(registry) {
  for (const t of registry.byKind("tuning")) {
    if (t.name !== "input-default-tuning") continue;
    const tn = registry.facetData(t.id, "tuning");
    if (!tn) return null;
    return {
      forward: tn.key_forward,
      back:    tn.key_back,
      left:    tn.key_left,
      right:   tn.key_right,
    };
  }
  return null;
}
