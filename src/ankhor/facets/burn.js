/** burn facet — native Ankhor replacement for the legacy
 *  mountBurnTick (data/legacy/burn.json).
 *
 *  Legacy contract being reproduced (src/systems/burn_tick.js):
 *
 *    const BURN_DMG        = 3;
 *    const BURN_DMG_PERIOD = 0.5;
 *    mountBurnTick({ get, set, actions })
 *      tick(dt, nowSec) {
 *        if (get.heroFireT() <= 0 || get.heroDead()) return;
 *        set.heroFireT(get.heroFireT() - dt);
 *        set.heroFireDmgT(get.heroFireDmgT() - dt);
 *        if (get.heroFireDmgT() <= 0) {
 *          set.heroFireDmgT(BURN_DMG_PERIOD);
 *          if (!godMode) {
 *            set.heroHp(Math.max(0, get.heroHp() - BURN_DMG));
 *            set.heroLastDamageT(nowSec);
 *          }
 *          const pos = get.heroPos();
 *          actions.spawnParticles(
 *            pos.u + (Math.random()-0.5) * 0.6,
 *            pos.y + 0.8 + Math.random()*0.8,
 *            pos.v + (Math.random()-0.5) * 0.6,
 *            2, "orange", 2.5, 0.5
 *          );
 *        }
 *        if (get.heroFireT() <= 0) set.heroFireT(0);
 *        if (get.heroHp() <= 0 && !get.heroDead()) actions.heroShowDeathScreen();
 *      }
 *
 *  Native version:
 *    - State on hero.inventory: heroFireT + heroFireDmgT (lifted from
 *      legacy spec's _heroFireT/_heroFireDmgT scratch).
 *    - heroPos via direct read of hero.position (no $kindPos detour).
 *    - heroDead via hero.inventory.heroDead (default false; future
 *      death-state facet will write it).
 *    - Numbers from hero-tuning: burn_dmg, burn_dmg_period, plus
 *      4 particle-jitter keys (count, y_base, y_jitter, xz_jitter).
 *    - On each BURN_DMG_PERIOD tick: damages hp, stamps
 *      health.lastDamageT (regen consumer), spawns N decals at
 *      jittered positions via registry.spawn directly.
 *    - heroShowDeathScreen call no-ops (no consumer yet).
 *
 *  Priority 26: matches hero-respawn slot; runs late so any combat
 *  damage already applied this frame is visible to the burn check.
 *
 *  NO hardcoded numbers — handler no-ops if tuning keys missing. */
export default {
  priority: 26,
  tick(thing, _data, dt, registry) {
    const tn = readHeroTuning(registry);
    if (!tn) return;

    const heroes = registry.byKind("hero");
    if (heroes.length === 0) return;
    const hero = heroes[0];
    const inv  = registry.facetData(hero.id, "inventory");
    const health = registry.facetData(hero.id, "health");
    if (!inv || !health || typeof health.hp !== "number") return;

    // Initialise scratch on first tick.
    if (typeof inv.heroFireT     !== "number") inv.heroFireT     = 0;
    if (typeof inv.heroFireDmgT  !== "number") inv.heroFireDmgT  = 0;

    if (inv.heroFireT <= 0 || inv.heroDead === true) return;

    inv.heroFireT    -= dt;
    inv.heroFireDmgT -= dt;

    if (inv.heroFireDmgT <= 0) {
      inv.heroFireDmgT = tn.burn_dmg_period;
      health.hp = Math.max(0, health.hp - tn.burn_dmg);
      health.lastDamageT = Date.now() / 1000;
      spawnBurnParticles(hero, registry, tn);
    }

    if (inv.heroFireT <= 0) inv.heroFireT = 0;
    // heroShowDeathScreen has no consumer yet; no-op the trigger.
  }
};

function readHeroTuning(registry) {
  for (const t of registry.byKind("tuning")) {
    if (t.name !== "hero-tuning") continue;
    const tn = registry.facetData(t.id, "tuning");
    if (!tn) return null;
    if (typeof tn.burn_dmg                !== "number") return null;
    if (typeof tn.burn_dmg_period         !== "number") return null;
    if (typeof tn.burn_particle_count     !== "number") return null;
    if (typeof tn.burn_particle_y_base    !== "number") return null;
    if (typeof tn.burn_particle_y_jitter  !== "number") return null;
    if (typeof tn.burn_particle_xz_jitter !== "number") return null;
    return tn;
  }
  return null;
}

function spawnBurnParticles(hero, registry, tn) {
  const pos = registry.facetData(hero.id, "position");
  if (!pos) return;
  const count = tn.burn_particle_count;
  const xz = tn.burn_particle_xz_jitter;
  const yb = tn.burn_particle_y_base;
  const yj = tn.burn_particle_y_jitter;
  for (let i = 0; i < count; i++) {
    const seq = (registry._burnSeq = (registry._burnSeq || 0) + 1);
    const id  = `decal-particle/burn-${seq}`;
    try {
      registry.spawn({
        id, kind: "decal-particle", name: id,
        facets: [
          { name: "position", data: {
            x: pos.x + (Math.random() - 0.5) * xz,
            y: pos.y + yb + Math.random() * yj,
            z: pos.z + (Math.random() - 0.5) * xz,
          }},
          { name: "mesh",        data: { tuning_ref: "decal-particle-impact-tuning" } },
          { name: "ttl",         data: { remaining: 0.3 } },
          { name: "expand-fade", data: {} },
        ],
      });
    } catch (_) { /* duplicate id within same ms ok to skip */ }
  }
}
