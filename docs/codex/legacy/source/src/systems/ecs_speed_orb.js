export const SPEED_ORB_COLLECT_DIST = 1.2;
export const SPEED_ORB_BOOST_DURATION = 4.0;

export function createSpeedOrbSystem() {

  function system(dt, core) {
    const orbs = core.query("SpeedOrb");

    const heroes = core.query("PlayerControl", "Transform");
    let heroU = null, heroV = null;
    for (const hid of heroes) {
      const t = core.getComponent(hid, "Transform");
      if (t) { heroU = t.u; heroV = t.v; break; }
    }

    for (const oid of orbs) {
      const so = core.getComponent(oid, "SpeedOrb");
      if (!so) continue;

      if (heroU !== null && Math.hypot(heroU - so.u, heroV - so.v) < SPEED_ORB_COLLECT_DIST) {
        core.emit("speed_orb:collected", { u: so.u, v: so.v, boostDuration: SPEED_ORB_BOOST_DURATION });
        core.destroyEntity(oid);
        continue;
      }

      core.emit("speed_orb:tick", { u: so.u, v: so.v });
    }
  }

  function wireListeners(core) {
    core.on("speed_orb:spawned", ({ u, v }) => {
      const id = core.createEntity();
      core.addComponent(id, "SpeedOrb", { u, v });
    });
  }

  system.wireListeners = wireListeners;
  return system;
}
