export const ARMOR_SHARD_COLLECT_DIST = 1.2;
export const ARMOR_SHARD_MAGNET_DIST  = 3.0;
export const ARMOR_SHARD_MAGNET_SPEED = 9.0;

export function createArmorShardSystem() {

  function system(dt, core) {
    const shards = core.query("ArmorShard");

    const heroes = core.query("PlayerControl", "Transform");
    let heroU = null, heroV = null;
    for (const hid of heroes) {
      const t = core.getComponent(hid, "Transform");
      if (t) { heroU = t.u; heroV = t.v; break; }
    }

    for (const sid of shards) {
      const as = core.getComponent(sid, "ArmorShard");
      if (!as) continue;

      if (heroU === null) {
        core.emit("armor_shard:tick", { u: as.u, v: as.v });
        continue;
      }

      const d = Math.hypot(heroU - as.u, heroV - as.v);

      if (d < ARMOR_SHARD_COLLECT_DIST) {
        core.emit("armor_shard:collected", { u: as.u, v: as.v, amount: as.amount });
        core.destroyEntity(sid);
        continue;
      }

      if (d < ARMOR_SHARD_MAGNET_DIST && d > 0) {
        const pull = ARMOR_SHARD_MAGNET_SPEED * (1 - d / ARMOR_SHARD_MAGNET_DIST);
        as.u += ((heroU - as.u) / d) * pull * dt;
        as.v += ((heroV - as.v) / d) * pull * dt;
      }

      core.emit("armor_shard:tick", { u: as.u, v: as.v });
    }
  }

  function wireListeners(core) {
    core.on("armor_shard:spawned", ({ u, v, amount }) => {
      const id = core.createEntity();
      core.addComponent(id, "ArmorShard", { u, v, amount: amount ?? 1 });
    });
  }

  system.wireListeners = wireListeners;
  return system;
}
