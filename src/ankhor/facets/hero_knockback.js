/** hero-knockback facet — native Ankhor replacement for the legacy
 *  mountHeroKnockbackTick (data/legacy/hero-knockback.json).
 *
 *  Legacy contract (src/systems/hero_knockback_tick.js):
 *
 *    mountHeroKnockbackTick({ get, set, actions })
 *      tick(dt) {
 *        if (get.kbT() <= 0) return;
 *        set.kbT(get.kbT() - dt);
 *        const pos = actions.getPos();
 *        const mover = { u: pos.u, v: pos.v, hitbox: { w: 0.5, d: 0.5 } };
 *        actions.resolveMove(mover, get.kbU() * dt, get.kbV() * dt);
 *        actions.setPos(pos.x, pos.y, pos.z, mover.u, mover.v);
 *        set.kbU(get.kbU() * Math.max(0, 1 - dt * 8));
 *        set.kbV(get.kbV() * Math.max(0, 1 - dt * 8));
 *      }
 *
 *  Native version:
 *    - State on hero.inventory: kb_t, kb_x, kb_z (legacy u/v map to
 *      world x/z; hero stays on 3D position facet for now per
 *      CLAUDE.md "legacy 3D facets stay 3D until their migration iter
 *      adds u, v").
 *    - resolveMove was bound to $noop in legacy spec — preserved as
 *      direct vector application (collision facet handles AABB
 *      resolution downstream, not this facet's job).
 *    - Decay rate from hero-tuning: knockback_decay_rate (8).
 *
 *  Priority 22: matches speed-boost slot; runs before stamina and
 *  hero-regen so any knockback-driven position change is visible to
 *  damage zones that read hero.position later in the frame.
 *
 *  NO hardcoded numbers; no `??` fallbacks. */
export default {
  priority: 22,
  tick(_thing, _data, dt, registry) {
    const tn = readHeroTuning(registry);
    if (!tn) return;

    const heroes = registry.byKind("hero");
    if (heroes.length === 0) return;
    const hero = heroes[0];
    const inv = registry.facetData(hero.id, "inventory");
    const pos = registry.facetData(hero.id, "position");
    if (!inv || !pos) return;

    if (typeof inv.kb_t !== "number") inv.kb_t = 0;
    if (typeof inv.kb_x !== "number") inv.kb_x = 0;
    if (typeof inv.kb_z !== "number") inv.kb_z = 0;

    if (inv.kb_t <= 0) return;

    inv.kb_t -= dt;
    pos.x += inv.kb_x * dt;
    pos.z += inv.kb_z * dt;

    const decay = Math.max(0, 1 - dt * tn.knockback_decay_rate);
    inv.kb_x *= decay;
    inv.kb_z *= decay;
  },
};

function readHeroTuning(registry) {
  for (const t of registry.byKind("tuning")) {
    if (t.name !== "hero-tuning") continue;
    const tn = registry.facetData(t.id, "tuning");
    if (!tn) return null;
    if (typeof tn.knockback_decay_rate !== "number") return null;
    return tn;
  }
  return null;
}
