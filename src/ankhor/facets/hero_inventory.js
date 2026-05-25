/** hero_inventory facet — native replacement for mountHeroInventory */
export default {
  priority: 10,  // init phase — runs first
  tick(_t, data, _dt, _r) {
    if (data._initialized) return;
    data._initialized = true;
    // Default loadout: 24 slots, default weapons, medkits
    data.slots = data.slots || 24;
    data.items = { medkit: 2 };
    for (const w of (data.weapons || [])) {
      data.items["gun_" + w.id] = (data.items["gun_" + w.id] || 0) + 1;
      data.items[w.ammoItem || "pistol_9mm"] = (data.items[w.ammoItem || "pistol_9mm"] || 0) + (w.magCap || 17) * 4;
    }
    data.maxHp = data.heroMaxHp || 100;
    data.hp = data.maxHp;
    data.regenRate = data.heroRegenRate || 5;
    data.regenDelay = data.heroRegenDelay || 5;
  }
};
