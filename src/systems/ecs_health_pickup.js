export const HEALTH_PICKUP_COLLECT_DIST = 1.2;

export function createHealthPickupSystem() {

  function system(dt, core) {
    const pickups = core.query("HealthPickup");

    const heroes = core.query("PlayerControl", "Transform");
    let heroU = null, heroV = null;
    for (const hid of heroes) {
      const t = core.getComponent(hid, "Transform");
      if (t) { heroU = t.u; heroV = t.v; break; }
    }

    for (const pid of pickups) {
      const pk = core.getComponent(pid, "HealthPickup");
      if (!pk) continue;

      if (heroU !== null && Math.hypot(heroU - pk.u, heroV - pk.v) < HEALTH_PICKUP_COLLECT_DIST) {
        core.emit("health_pickup:collected", { u: pk.u, v: pk.v, amount: pk.amount });
        core.destroyEntity(pid);
        continue;
      }

      core.emit("health_pickup:tick", { u: pk.u, v: pk.v });
    }
  }

  function wireListeners(core) {
    core.on("health_pickup:spawned", ({ u, v, amount }) => {
      const id = core.createEntity();
      core.addComponent(id, "HealthPickup", { u, v, amount: amount ?? 25 });
    });
  }

  system.wireListeners = wireListeners;
  return system;
}
