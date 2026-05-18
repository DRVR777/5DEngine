export const COIN_DROP_COLLECT_DIST = 1.2;
export const COIN_DROP_MAGNET_DIST  = 3.0;
export const COIN_DROP_MAGNET_SPEED = 9.0;

export function createCoinDropSystem() {

  function system(dt, core) {
    const coins = core.query("CoinDrop");

    const heroes = core.query("PlayerControl", "Transform");
    let heroU = null, heroV = null;
    for (const hid of heroes) {
      const t = core.getComponent(hid, "Transform");
      if (t) { heroU = t.u; heroV = t.v; break; }
    }

    for (const cid of coins) {
      const cd = core.getComponent(cid, "CoinDrop");
      if (!cd) continue;

      if (heroU === null) {
        core.emit("coin:tick", { u: cd.u, v: cd.v });
        continue;
      }

      const d = Math.hypot(heroU - cd.u, heroV - cd.v);

      if (d < COIN_DROP_COLLECT_DIST) {
        core.emit("coin:collected", { u: cd.u, v: cd.v, value: cd.value });
        core.destroyEntity(cid);
        continue;
      }

      if (d < COIN_DROP_MAGNET_DIST && d > 0) {
        const pull = COIN_DROP_MAGNET_SPEED * (1 - d / COIN_DROP_MAGNET_DIST);
        cd.u += ((heroU - cd.u) / d) * pull * dt;
        cd.v += ((heroV - cd.v) / d) * pull * dt;
      }

      core.emit("coin:tick", { u: cd.u, v: cd.v });
    }
  }

  function wireListeners(core) {
    core.on("coin:drop_spawned", ({ u, v, value }) => {
      const id = core.createEntity();
      core.addComponent(id, "CoinDrop", { u, v, value: value ?? 1 });
    });
  }

  system.wireListeners = wireListeners;
  return system;
}
