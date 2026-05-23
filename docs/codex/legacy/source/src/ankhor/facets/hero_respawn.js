/** hero-respawn facet — when hero's health.hp drops to or below 0,
 *  teleport hero to spawn (0,0,0) and restore hp to maxHp. No
 *  death screen UI this iter — that's a later HUD slice per
 *  GAME_HTML_INVENTORY §1.
 *
 *  Brief invuln window via `respawning_until_sec` blocks attack-target
 *  damage when set on the hero (attack-target will respect this in a
 *  subsequent iter; today the field is set but unread).
 *
 *  Lift-ready: writes to local fields first, assigns last.
 *
 *  Data: { respawning_until_sec? } */
export default {
  priority: 26,
  tick(thing, data, _dt, registry) {
    const health = registry.facetData(thing.id, "health");
    if (!health || typeof health.hp !== "number") return;
    if (health.hp > 0) return;

    const pos = registry.facetData(thing.id, "position");
    if (!pos) return;

    const maxHp = (typeof health.maxHp === "number" && health.maxHp > 0) ? health.maxHp : 100;
    const newHp = maxHp;
    const newX = 0, newY = 0, newZ = 0;
    const newUntil = (Date.now() / 1000) + 1.5;

    health.hp = newHp;
    pos.x = newX;
    pos.y = newY;
    pos.z = newZ;
    if (data) data.respawning_until_sec = newUntil;
  }
};
