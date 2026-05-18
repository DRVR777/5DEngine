/**
 * ecs_pickup.js — ECS pickup collection system for 5DEngine
 *
 * Ported from 5DEngineMassive/index.html lines 8135-8179 (ammo + health pickup loop).
 *
 * Two exports:
 *   pickupSystem   — ECS system fn (dt, core, ctx) → void
 *   spawnPickup    — helper: (core, kind, u, v, data) → entityId
 *
 * Pickup entity components (created by spawnPickup):
 *   Pickup:    { kind, ammoItem?, qty?, amount?, value? }
 *   Transform: { u, v, y }
 *   Faction:   { id: "pickup" }
 *
 * Pickup kinds:
 *   "ammo"   — ammoItem (string) + qty (number)
 *   "health" — amount (number, HP to restore)
 *   "coin"   — value (number, score credits)
 *   "weapon" — weaponId (string)
 *
 * The system emits on Core:
 *   "pickup:collected"  { kind, entityId, heroId }
 *   "pickup:ammo"       { ammoItem, qty, entityId }
 *   "pickup:health"     { amount, gained, entityId }
 *   "pickup:coin"       { value, entityId }
 *   "pickup:weapon"     { weaponId, entityId }
 *
 * Rendering (bob, rotation, magnetic glow) is the monolith's job until
 * the render system is extracted. This system handles pure data logic only.
 */

// Pickup collection radius — mirrored from monolith line 8140: d < 1.2
const COLLECT_RADIUS = 1.2;

// Magnetic pull radius — mirrored from monolith line 8150: d < 3.0
const MAGNET_RADIUS = 3.0;

// Magnetic pull speed factor (units/s per normalized distance factor)
// monolith uses: _mag = 8 * (1 - d/3.0) → at d=0 max=8, at d=2 → 2.67
const MAGNET_FORCE = 8;

/**
 * spawnPickup(core, kind, u, v, data) → entityId
 *
 * Creates a pickup entity at (u, v).
 * @param {object} core   - Core API
 * @param {string} kind   - "ammo"|"health"|"coin"|"weapon"
 * @param {number} u      - world U position
 * @param {number} v      - world V position
 * @param {object} data   - { ammoItem?, qty?, amount?, value?, weaponId? }
 */
export function spawnPickup(core, kind, u, v, data = {}) {
  const id = core.createEntity();
  core.addComponent(id, "Pickup",    Object.assign({ kind }, data));
  core.addComponent(id, "Transform", { u, v, y: 0.4 });
  core.addComponent(id, "Faction",   { id: "pickup" });
  return id;
}

/**
 * pickupSystem(dt, core, ctx) — call at priority 20 (after combat).
 *
 * ctx is not required for this system (no external lookups needed).
 */
export function pickupSystem(dt, core) {
  // Find hero
  const heroIds = core.query("PlayerControl", "Health", "Transform", "Faction");
  if (!heroIds.length) return;
  const heroId = heroIds.find(id => core.getComponent(id, "Faction").id === "player");
  if (!heroId) return;

  const heroPos    = core.getComponent(heroId, "Transform");
  const heroHealth = core.getComponent(heroId, "Health");
  if (!heroPos || !heroHealth) return;

  const pickupIds = core.query("Pickup", "Transform", "Faction");
  for (const id of pickupIds) {
    const faction = core.getComponent(id, "Faction");
    if (faction.id !== "pickup") continue;

    const pos    = core.getComponent(id, "Transform");
    const pickup = core.getComponent(id, "Pickup");
    if (!pos || !pickup) continue;

    const du = heroPos.u - pos.u;
    const dv = heroPos.v - pos.v;
    const dist = Math.hypot(du, dv);

    // Collect if hero is close enough
    if (dist < COLLECT_RADIUS) {
      _collect(core, id, pickup, heroId, heroHealth, heroPos);
      core.destroyEntity(id);
      continue;
    }

    // Magnetic pull — slide toward hero within MAGNET_RADIUS
    if (dist > 0 && dist < MAGNET_RADIUS) {
      const mag = MAGNET_FORCE * (1 - dist / MAGNET_RADIUS);
      pos.u += (du / dist) * mag * dt;
      pos.v += (dv / dist) * mag * dt;
    }
  }
}

function _collect(core, id, pickup, heroId, heroHealth, heroPos) {
  const { kind } = pickup;

  if (kind === "ammo") {
    core.emit("pickup:ammo", { ammoItem: pickup.ammoItem, qty: pickup.qty || 12, entityId: id });
    core.emit("pickup:collected", { kind, entityId: id, heroId });
    return;
  }

  if (kind === "health") {
    const gained = Math.min(pickup.amount || 0, (heroHealth.maxHp || 100) - heroHealth.hp);
    heroHealth.hp = Math.min(heroHealth.maxHp || 100, heroHealth.hp + (pickup.amount || 0));
    core.emit("pickup:health", { amount: pickup.amount, gained, entityId: id });
    core.emit("pickup:collected", { kind, entityId: id, heroId });
    return;
  }

  if (kind === "coin") {
    core.emit("pickup:coin", { value: pickup.value || 1, entityId: id });
    core.emit("pickup:collected", { kind, entityId: id, heroId });
    return;
  }

  if (kind === "weapon") {
    core.emit("pickup:weapon", { weaponId: pickup.weaponId, entityId: id });
    core.emit("pickup:collected", { kind, entityId: id, heroId });
    return;
  }

  // Unknown kind — still emit collected so listeners can handle it
  core.emit("pickup:collected", { kind, entityId: id, heroId });
}

export default { pickupSystem, spawnPickup };
