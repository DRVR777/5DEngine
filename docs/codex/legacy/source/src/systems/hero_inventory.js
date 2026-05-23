// Hero starting inventory and health component factory.
// mountHeroInventory({ Inv, Health, CFG }) → { heroInv, heroHealth }
export function mountHeroInventory({ Inv, Health, CFG }) {
  const heroInv = Inv.makeInventory(24);
  for (const w of (CFG.weapons || [])) {
    Inv.addItem(heroInv, "gun_" + w.id, 1);
    Inv.addItem(heroInv, w.ammoItem || "pistol_9mm", w.magCap * 4);
  }
  Inv.addItem(heroInv, "medkit", 2);

  const heroHealth = Health.makeHealth(
    CFG.heroMaxHp || 100,
    { regenRate: CFG.heroRegenRate || 5, regenDelay: CFG.heroRegenDelay || 5 }
  );

  return { heroInv, heroHealth };
}
