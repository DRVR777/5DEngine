export const AMMO_PICKUP_COLLECT_DIST = 1.2;
export const AMMO_PICKUP_MAGNET_DIST  = 3.0;
export const AMMO_PICKUP_MAGNET_SPEED = 8.0;

export function createAmmoPickupSystem() {

  function system(dt, core) {
    const pickups = core.query("AmmoPickup");

    const heroes = core.query("PlayerControl", "Transform");
    let heroU = null, heroV = null;
    for (const hid of heroes) {
      const t = core.getComponent(hid, "Transform");
      if (t) { heroU = t.u; heroV = t.v; break; }
    }

    for (const pid of pickups) {
      const ap = core.getComponent(pid, "AmmoPickup");
      if (!ap) continue;

      if (heroU === null) {
        core.emit("ammo_pickup:tick", { u: ap.u, v: ap.v });
        continue;
      }

      const d = Math.hypot(heroU - ap.u, heroV - ap.v);

      if (d < AMMO_PICKUP_COLLECT_DIST) {
        core.emit("ammo_pickup:collected", { u: ap.u, v: ap.v, qty: ap.qty, ammoItem: ap.ammoItem });
        core.destroyEntity(pid);
        continue;
      }

      if (d < AMMO_PICKUP_MAGNET_DIST && d > 0) {
        const pull = AMMO_PICKUP_MAGNET_SPEED * (1 - d / AMMO_PICKUP_MAGNET_DIST);
        ap.u += ((heroU - ap.u) / d) * pull * dt;
        ap.v += ((heroV - ap.v) / d) * pull * dt;
      }

      core.emit("ammo_pickup:tick", { u: ap.u, v: ap.v });
    }
  }

  function wireListeners(core) {
    core.on("ammo_pickup:spawned", ({ u, v, qty, ammoItem }) => {
      const id = core.createEntity();
      core.addComponent(id, "AmmoPickup", {
        u, v,
        qty:      qty      ?? 12,
        ammoItem: ammoItem ?? "pistol_9mm",
      });
    });
  }

  system.wireListeners = wireListeners;
  return system;
}
