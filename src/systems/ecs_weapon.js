/**
 * ecs_weapon.js — ECS weapon state system for 5DEngine
 *
 * Manages fire-rate cooldown, reload state, magazine/ammo tracking,
 * and weapon switching for entities with a Weapon component.
 *
 * Ported from 5DEngineMassive/index.html: getWeapon(), getAmmo(), setAmmo(),
 * RELOAD_DUR(), weaponAmmo Map, pistolCooldown logic (lines 5856, 6016).
 *
 * Weapon component layout:
 *   Weapon: {
 *     weaponId:      string,   — which weapon def to look up
 *     cooldownLeft:  number,   — seconds until next shot allowed (decrements each tick)
 *     reloadLeft:    number,   — seconds remaining in reload (-1 = not reloading)
 *     magAmmo:       number,   — rounds currently in magazine
 *     reloading:     boolean,
 *   }
 *
 * Inventory component (for ammo pools):
 *   Inventory: { items: { [ammoItemId]: qty } }
 *
 * PerkState (for reload multiplier):
 *   PerkState: { _perkReloadMul }
 *
 * Events emitted on Core:
 *   "weapon:fired"    { entityId, weaponId, damage, spread, pellets }
 *   "weapon:empty"    { entityId, weaponId }
 *   "weapon:reload_start" { entityId, weaponId, duration }
 *   "weapon:reload_done"  { entityId, weaponId, magAmmo }
 *   "weapon:switched" { entityId, weaponId }
 *
 * Events listened to:
 *   "weapon:fire"    { entityId } — attempt to fire
 *   "weapon:reload"  { entityId } — start reload
 *   "weapon:switch"  { entityId, weaponId } — change active weapon
 *
 * Usage:
 *   const sys = createWeaponSystem(weaponDefs);
 *   Core.addSystem(sys, 8, "weapon");  // before combat at 10
 */

/**
 * createWeaponSystem(weaponDefs) → system function
 *
 * @param {object} weaponDefs - Map of weaponId → weapon descriptor
 *   Each descriptor: { id, ammoItem, fireRate, damage, magCap, reloadDuration,
 *                      pellets, spread, automatic, range, speed }
 */
export function createWeaponSystem(weaponDefs = {}) {
  let _wired = false;

  function _getDef(weaponId) {
    return weaponDefs[weaponId] || weaponDefs["pistol"] || null;
  }

  function _reloadDur(def, core, entityId) {
    const perk = core.getComponent(entityId, "PerkState");
    const mul  = perk ? (perk._perkReloadMul ?? 1.0) : 1.0;
    return ((def.reloadDuration || 1200) / 1000) * mul; // convert ms → s, apply perk
  }

  function _tryFire(core, entityId) {
    const weapon = core.getComponent(entityId, "Weapon");
    if (!weapon || weapon.reloading) return;
    if (weapon.cooldownLeft > 0) return;

    const def = _getDef(weapon.weaponId);
    if (!def) return;

    if (weapon.magAmmo <= 0) {
      core.emit("weapon:empty", { entityId, weaponId: weapon.weaponId });
      // Auto-trigger reload
      _triggerReload(core, entityId, weapon, def);
      return;
    }

    weapon.magAmmo--;
    weapon.cooldownLeft = 1 / (def.fireRate || 5);
    core.emit("weapon:fired", {
      entityId,
      weaponId:  weapon.weaponId,
      damage:    def.damage || 20,
      spread:    def.spread || 0,
      pellets:   def.pellets || 1,
      range:     def.range || 30,
      speed:     def.speed || 80,
      magAmmo:   weapon.magAmmo,
    });
  }

  function _triggerReload(core, entityId, weapon, def) {
    if (weapon.reloading) return;
    if (weapon.magAmmo >= (def.magCap || 12)) return;

    const inv = core.getComponent(entityId, "Inventory");
    const ammoQty = inv ? (inv.items[def.ammoItem] || 0) : 0;
    if (ammoQty <= 0) return; // no ammo to reload from

    weapon.reloading  = true;
    weapon.reloadLeft = _reloadDur(def, core, entityId);
    core.emit("weapon:reload_start", {
      entityId, weaponId: weapon.weaponId,
      duration: weapon.reloadLeft,
    });
  }

  function _completeReload(core, entityId, weapon, def) {
    const inv = core.getComponent(entityId, "Inventory");
    if (!inv) { weapon.reloading = false; weapon.reloadLeft = -1; return; }

    const need    = (def.magCap || 12) - weapon.magAmmo;
    const have    = inv.items[def.ammoItem] || 0;
    const take    = Math.min(need, have);
    weapon.magAmmo += take;
    inv.items[def.ammoItem] = Math.max(0, have - take);
    weapon.reloading  = false;
    weapon.reloadLeft = -1;
    core.emit("weapon:reload_done", {
      entityId, weaponId: weapon.weaponId, magAmmo: weapon.magAmmo,
    });
  }

  function system(dt, core) {
    if (!_wired) {
      _wired = true;

      core.on("weapon:fire", ({ entityId }) => _tryFire(core, entityId));

      core.on("weapon:reload", ({ entityId }) => {
        const weapon = core.getComponent(entityId, "Weapon");
        if (!weapon || weapon.reloading) return;
        const def = _getDef(weapon.weaponId);
        if (def) _triggerReload(core, entityId, weapon, def);
      });

      core.on("weapon:switch", ({ entityId, weaponId }) => {
        const weapon = core.getComponent(entityId, "Weapon");
        if (!weapon || weapon.weaponId === weaponId) return;
        const def = _getDef(weaponId);
        if (!def) return;
        weapon.weaponId     = weaponId;
        weapon.reloading    = false;
        weapon.reloadLeft   = -1;
        weapon.cooldownLeft = 0;
        // Restore mag ammo from cached value (or full mag on first switch)
        weapon.magAmmo = def.magCap || 12;
        core.emit("weapon:switched", { entityId, weaponId });
      });
    }

    // Tick all entities with a Weapon component
    const ids = core.query("Weapon");
    for (const entityId of ids) {
      const weapon = core.getComponent(entityId, "Weapon");
      if (!weapon) continue;

      if (weapon.cooldownLeft > 0) weapon.cooldownLeft -= dt;

      if (weapon.reloading && weapon.reloadLeft > 0) {
        weapon.reloadLeft -= dt;
        if (weapon.reloadLeft <= 0) {
          const def = _getDef(weapon.weaponId);
          if (def) _completeReload(core, entityId, weapon, def);
        }
      }
    }
  }

  system.defs    = weaponDefs;
  system.getDef  = _getDef;

  return system;
}

/**
 * makeWeaponComponent(weaponDef) → Weapon component initial value
 */
export function makeWeaponComponent(weaponDef) {
  return {
    weaponId:     weaponDef.id,
    cooldownLeft: 0,
    reloadLeft:   -1,
    magAmmo:      weaponDef.magCap || 12,
    reloading:    false,
  };
}

export default { createWeaponSystem, makeWeaponComponent };
