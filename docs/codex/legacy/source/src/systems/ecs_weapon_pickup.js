export const WEAPON_PICKUP_COLLECT_DIST = 1.2;

export function createWeaponPickupSystem() {

  function system(dt, core) {
    const pickups = core.query("WeaponPickup");

    const heroes = core.query("PlayerControl", "Transform");
    let heroU = null, heroV = null;
    for (const hid of heroes) {
      const t = core.getComponent(hid, "Transform");
      if (t) { heroU = t.u; heroV = t.v; break; }
    }

    for (const pid of pickups) {
      const wp = core.getComponent(pid, "WeaponPickup");
      if (!wp) continue;

      if (heroU !== null && Math.hypot(heroU - wp.u, heroV - wp.v) < WEAPON_PICKUP_COLLECT_DIST) {
        core.emit("weapon_pickup:collected", { u: wp.u, v: wp.v, weaponId: wp.weaponId });
        core.destroyEntity(pid);
        continue;
      }

      core.emit("weapon_pickup:tick", { u: wp.u, v: wp.v, weaponId: wp.weaponId });
    }
  }

  function wireListeners(core) {
    core.on("weapon_pickup:spawned", ({ u, v, weaponId }) => {
      const id = core.createEntity();
      core.addComponent(id, "WeaponPickup", { u, v, weaponId: weaponId ?? "pistol" });
    });
  }

  system.wireListeners = wireListeners;
  return system;
}
