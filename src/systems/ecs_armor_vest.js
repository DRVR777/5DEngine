export const ARMOR_VEST_COLLECT_DIST  = 1.3;
export const ARMOR_VEST_GRANT         = 25;
export const ARMOR_VEST_RESPAWN_DELAY = 60.0;

export function createArmorVestSystem() {

  function system(dt, core) {
    const vests = core.query("ArmorVest");

    const heroes = core.query("PlayerControl", "Transform");
    let heroU = null, heroV = null;
    for (const hid of heroes) {
      const t = core.getComponent(hid, "Transform");
      if (t) { heroU = t.u; heroV = t.v; break; }
    }

    for (const vid of vests) {
      const av = core.getComponent(vid, "ArmorVest");
      if (!av) continue;

      if (!av.active) {
        av.respawnT -= dt;
        if (av.respawnT <= 0) {
          av.active = true;
          av.respawnT = 0;
          core.emit("armor_vest:respawned", { u: av.u, v: av.v });
        }
        continue;
      }

      core.emit("armor_vest:tick", { u: av.u, v: av.v });

      if (heroU !== null && Math.hypot(heroU - av.u, heroV - av.v) < ARMOR_VEST_COLLECT_DIST) {
        av.active = false;
        av.respawnT = ARMOR_VEST_RESPAWN_DELAY;
        core.emit("armor_vest:collected", { u: av.u, v: av.v, amount: ARMOR_VEST_GRANT });
      }
    }
  }

  function wireListeners(core) {
    core.on("armor_vest:placed", ({ u, v }) => {
      const id = core.createEntity();
      core.addComponent(id, "ArmorVest", {
        u, v,
        active:   true,
        respawnT: 0,
      });
    });
  }

  system.wireListeners = wireListeners;
  return system;
}
