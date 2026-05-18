export const POISON_PUDDLE_RADIUS         = 1.2;
export const POISON_PUDDLE_DURATION       = 4.0;
export const POISON_PUDDLE_APPLY_INTERVAL = 0.8;

export function createPoisonPuddleSystem() {

  function system(dt, core) {
    const puddles = core.query("PoisonPuddle");

    const heroes = core.query("PlayerControl", "Transform");
    let heroU = null, heroV = null;
    for (const hid of heroes) {
      const t = core.getComponent(hid, "Transform");
      if (t) { heroU = t.u; heroV = t.v; break; }
    }

    for (const pid of puddles) {
      const pp = core.getComponent(pid, "PoisonPuddle");
      if (!pp) continue;

      pp.timeLeft -= dt;

      if (pp.timeLeft <= 0) {
        core.emit("poison:puddle_expired", { u: pp.u, v: pp.v });
        core.destroyEntity(pid);
        continue;
      }

      core.emit("poison:puddle_tick", { u: pp.u, v: pp.v, timeLeft: pp.timeLeft });

      if (heroU !== null && Math.hypot(heroU - pp.u, heroV - pp.v) < pp.radius) {
        pp.applyT -= dt;
        if (pp.applyT <= 0) {
          pp.applyT = POISON_PUDDLE_APPLY_INTERVAL;
          core.emit("poison:hero_apply", { u: pp.u, v: pp.v });
        }
      }
    }
  }

  function wireListeners(core) {
    core.on("poison:puddle_spawned", ({ u, v }) => {
      const id = core.createEntity();
      core.addComponent(id, "PoisonPuddle", {
        u, v,
        radius:   POISON_PUDDLE_RADIUS,
        timeLeft: POISON_PUDDLE_DURATION,
        applyT:   0,
      });
    });
  }

  system.wireListeners = wireListeners;
  return system;
}
