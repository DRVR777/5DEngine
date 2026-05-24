/** hero-face facet — native Ankhor replacement for mountHeroFaceTick. */

export default {
  priority: 12,

  tick(thing, data, dt, registry) {
    const input = readInput(registry);
    const pos = registry.facetData(thing.id, "position");
    const mesh = registry.facetData(thing.id, "mesh");
    const current = typeof data.rotY === "number"
      ? data.rotY
      : typeof pos?.heading === "number" ? pos.heading : 0;

    const aiming = input.mouseHeld === true;
    const inputF = movementAxis(input.keys, "KeyW", "KeyS");
    const inputR = movementAxis(input.keys, "KeyD", "KeyA");
    const yaw = input.yaw || 0;
    const forward = { x: -Math.sin(yaw), z: -Math.cos(yaw) };
    const right = { x: Math.cos(yaw), z: -Math.sin(yaw) };

    const targetY = aiming
      ? yaw
      : (inputF !== 0 || inputR !== 0)
          ? Math.atan2(forward.x * inputF + right.x * inputR,
                       forward.z * inputF + right.z * inputR)
          : yaw;
    const turnRate = aiming ? 25 : 10;
    let diff = targetY - current;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const next = current + diff * Math.min(1, dt * turnRate);

    data.rotY = next;
    if (pos) pos.heading = next;
    if (mesh?.threeObj?.rotation) mesh.threeObj.rotation.y = next;
  },
};

function readInput(registry) {
  const inputThing = registry.byKind("input")[0];
  return inputThing ? registry.facetData(inputThing.id, "input-state") || {} : {};
}

function movementAxis(keys = {}, positive, negative) {
  let value = 0;
  if (keys[positive]) value += 1;
  if (keys[negative]) value -= 1;
  return value;
}
