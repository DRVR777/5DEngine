/** heartbeat facet - native Ankhor replacement for the legacy
 *  mountHeartbeat (data/legacy/heartbeat.json).
 *
 * Native state lives on hero.inventory.heartbeatT. The SFX action has no
 * audio consumer in the substrate yet, so the facet records the last
 * requested heartbeat sound on hero.inventory.lastHeartbeatSfx.
 */
export default {
  priority: 21,
  tick(thing, _data, dt, registry) {
    const tn = readHeroTuning(registry);
    if (!tn) return;

    const hero = thing.kind === "hero" ? thing : registry.byKind("hero")[0];
    if (!hero) return;
    const health = registry.facetData(hero.id, "health");
    const inv = registry.facetData(hero.id, "inventory");
    if (!health || !inv || typeof health.hp !== "number" || typeof health.maxHp !== "number") return;

    if (typeof inv.heartbeatT !== "number") inv.heartbeatT = 0;

    const threshold = health.maxHp * tn.heartbeat_threshold_frac;
    if (threshold <= 0) {
      inv.heartbeatT = 0;
      return;
    }

    if (health.hp < threshold && inv.heroDead !== true) {
      const next = inv.heartbeatT - dt;
      inv.heartbeatT = next;
      if (next <= 0) {
        const hbFrac = health.hp / threshold;
        inv.heartbeatT = tn.heartbeat_min_period + hbFrac * tn.heartbeat_period_range;
        inv.lastHeartbeatSfx = {
          id: tn.heartbeat_sfx_id,
          volume: tn.heartbeat_sfx_base_volume + (1 - hbFrac) * tn.heartbeat_sfx_volume_range,
        };
      }
    } else {
      inv.heartbeatT = 0;
    }
  }
};

function readHeroTuning(registry) {
  for (const t of registry.byKind("tuning")) {
    if (t.name !== "hero-tuning") continue;
    const tn = registry.facetData(t.id, "tuning");
    if (!tn) return null;
    if (typeof tn.heartbeat_threshold_frac !== "number") return null;
    if (typeof tn.heartbeat_min_period !== "number") return null;
    if (typeof tn.heartbeat_period_range !== "number") return null;
    if (typeof tn.heartbeat_sfx_id !== "string") return null;
    if (typeof tn.heartbeat_sfx_base_volume !== "number") return null;
    if (typeof tn.heartbeat_sfx_volume_range !== "number") return null;
    return tn;
  }
  return null;
}
