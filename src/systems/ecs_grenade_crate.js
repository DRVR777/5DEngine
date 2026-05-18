export const GRENADE_CRATE_COLLECT_DIST = 1.3;
export const GRENADE_CRATE_GRANT        = 3;
export const GRENADE_CRATE_RESPAWN_DELAY = 30.0;

export function createGrenadeCrateSystem() {

  function system(dt, core) {
    const crates = core.query("GrenadeCrate");

    const heroes = core.query("PlayerControl", "Transform");
    let heroU = null, heroV = null;
    for (const hid of heroes) {
      const t = core.getComponent(hid, "Transform");
      if (t) { heroU = t.u; heroV = t.v; break; }
    }

    for (const cid of crates) {
      const gc = core.getComponent(cid, "GrenadeCrate");
      if (!gc) continue;

      if (!gc.active) {
        gc.respawnT -= dt;
        if (gc.respawnT <= 0) {
          gc.active = true;
          gc.respawnT = 0;
          core.emit("grenade_crate:respawned", { u: gc.u, v: gc.v });
        }
        continue;
      }

      core.emit("grenade_crate:tick", { u: gc.u, v: gc.v });

      if (heroU !== null && Math.hypot(heroU - gc.u, heroV - gc.v) < GRENADE_CRATE_COLLECT_DIST) {
        gc.active = false;
        gc.respawnT = GRENADE_CRATE_RESPAWN_DELAY;
        core.emit("grenade_crate:collected", { u: gc.u, v: gc.v, count: GRENADE_CRATE_GRANT });
      }
    }
  }

  function wireListeners(core) {
    core.on("grenade_crate:placed", ({ u, v }) => {
      const id = core.createEntity();
      core.addComponent(id, "GrenadeCrate", {
        u, v,
        active:   true,
        respawnT: 0,
      });
    });
  }

  system.wireListeners = wireListeners;
  return system;
}
