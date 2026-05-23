/** pickup-radius facet — when the broadcast hero pose falls within
 *  `radius`, dispatch the pickup's effect to the hero, mark collected,
 *  and despawn the Thing. Caller (hero-broadcaster) injects heroU/heroV.
 *
 *  Effects (by `on_pickup_action`):
 *    "heal-hero" | "heal"        — restore hero.health.hp (capped at maxHp)
 *    "give-ammo" | "ammo"        — add qty of item to hero.inventory.items[item]
 *    "give-armor"| "armor"       — add to hero.health.armor (uncapped this iter)
 *    "score-add" | "coin"        — increment hero.inventory.score
 *    "speed-boost"               — set hero.inventory.speed_boost_until_sec
 *
 *  Amount source order:
 *    1. inline `on_pickup_amount` on the pickup-radius data (drop-on-death uses this)
 *    2. sibling facet on the pickup Thing (heal.amount / ammo.qty / armor.amount / value.amount)
 *
 *  Item (for ammo) source order:
 *    1. inline `on_pickup_item`
 *    2. ammo facet's `item` field
 *
 *  Lift-ready per docs/ACTOR_TRAJECTORY.md: builds a `{to, message}`
 *  envelope as a local before applying. After the lift, the apply
 *  becomes `emit` and the hero owns the inventory update.
 *
 *  Data: { radius, heroU?, heroV?, on_pickup_action?,
 *          on_pickup_amount?, on_pickup_item?, collected? } */
export default {
  priority: 40,
  tick(thing, data, _dt, registry) {
    if (!data || data.collected) return;
    const pos = registry.facetData(thing.id, "position");
    if (!pos) return;
    const hu = data.heroU, hv = data.heroV;
    if (hu == null || hv == null) return;
    const du = hu - pos.x, dv = hv - pos.z;
    if (du * du + dv * dv >= data.radius * data.radius) return;

    const heroes = registry.byKind("hero");
    if (heroes.length === 0) return;
    const hero = heroes[0];

    const action = data.on_pickup_action || "default";
    const envelope = buildEnvelope(action, data, thing, registry);
    if (envelope) applyToHero(envelope, hero, registry);

    data.collected = true;
    data.collected_at = (typeof performance !== "undefined" ? performance.now() : Date.now()) / 1000;
    try { registry.despawn(thing.id, `pickup:${action}`); }
    catch (e) { console.warn(`[ankhor] pickup despawn ${thing.id}:`, e.message); }
  }
};

function buildEnvelope(action, data, thing, registry) {
  if (action === "heal" || action === "heal-hero") {
    return { kind: "heal", amount: resolveAmount(data, thing, registry, "heal", "amount") };
  }
  if (action === "ammo" || action === "give-ammo") {
    return {
      kind: "ammo",
      item:   resolveItem(data, thing, registry, "ammo", "item", "pistol_9mm"),
      amount: resolveAmount(data, thing, registry, "ammo", "qty"),
    };
  }
  if (action === "give-armor" || action === "armor") {
    return { kind: "armor", amount: resolveAmount(data, thing, registry, "armor", "amount") };
  }
  if (action === "score-add" || action === "coin") {
    return { kind: "score", amount: resolveAmount(data, thing, registry, "value", "amount") };
  }
  if (action === "speed-boost") {
    return { kind: "speed-boost", duration_sec: 4 };
  }
  return null;
}

function resolveAmount(data, thing, registry, siblingFacet, siblingField) {
  if (typeof data.on_pickup_amount === "number") return data.on_pickup_amount;
  const sib = registry.facetData(thing.id, siblingFacet);
  if (sib && typeof sib[siblingField] === "number") return sib[siblingField];
  return 0;
}

function resolveItem(data, thing, registry, siblingFacet, siblingField, fallback) {
  if (typeof data.on_pickup_item === "string" && data.on_pickup_item) return data.on_pickup_item;
  const sib = registry.facetData(thing.id, siblingFacet);
  if (sib && typeof sib[siblingField] === "string" && sib[siblingField]) return sib[siblingField];
  return fallback;
}

function applyToHero(envelope, hero, registry) {
  const inv = registry.facetData(hero.id, "inventory");
  if (envelope.kind === "heal") {
    const h = registry.facetData(hero.id, "health");
    if (!h || typeof h.hp !== "number") return;
    const maxHp = (typeof h.maxHp === "number" && h.maxHp > 0) ? h.maxHp : h.hp;
    const newHp = Math.min(maxHp, h.hp + envelope.amount);
    h.hp = newHp;
    return;
  }
  if (envelope.kind === "ammo") {
    if (!inv) return;
    if (!inv.items || typeof inv.items !== "object") inv.items = {};
    inv.items[envelope.item] = (inv.items[envelope.item] || 0) + envelope.amount;
    return;
  }
  if (envelope.kind === "armor") {
    const h = registry.facetData(hero.id, "health");
    if (!h) return;
    h.armor = (typeof h.armor === "number" ? h.armor : 0) + envelope.amount;
    return;
  }
  if (envelope.kind === "score") {
    if (!inv) return;
    inv.score = (typeof inv.score === "number" ? inv.score : 0) + envelope.amount;
    return;
  }
  if (envelope.kind === "speed-boost") {
    if (!inv) return;
    inv.speed_boost_until_sec = (Date.now() / 1000) + envelope.duration_sec;
    return;
  }
}
