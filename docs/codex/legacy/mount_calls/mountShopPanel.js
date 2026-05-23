// Legacy clone of mountShopPanel call site(s).
// Source: game.html @ sha256:c7b57cf73a695b8d
// Cloned by tools/clone_legacy_mounts.mjs — DO NOT EDIT BY HAND.
// Purpose: preserve the exact legacy invocation so substrate work
// can diff against it. Per CLAUDE.md the legacy authority is
// readable until the substrate equivalent proves identical behavior.

// occurrence 1 of 1
// game.html lines 768..775
// (context lines 764..779)

  { id: "mines_x3",    name: "Mine Kit ×3",     desc: "+3 trap mines (M)",         cost: 5,  action: () => { _mineCount = Math.min(9, _mineCount + 3); } },
  { id: "ammo_smg",    name: "SMG Ammo",        desc: "+40 rounds (SMG uses pistol ammo)", cost: 3,  action: () => { Inv.addItem(heroInv, "pistol_9mm", 40); } },
  { id: "ammo_sniper", name: "Sniper Rounds",   desc: "+10 rounds (sniper uses rifle ammo)", cost: 4,  action: () => { Inv.addItem(heroInv, "rifle_556", 10); } },
];
const _shop = mountShopPanel({
  items: _SHOP_ITEMS,
  getScore: () => score,
  setScore: (n) => { score = n; },
  showToast,
  playSfx: (t, v) => playSfx(t, v),
  isBlocked: () => computerOpen || buildMode,
});

// Settings panel — O key opens, Escape closes
const _settings = mountSettingsPanel({
  getCFG: () => (typeof CFG !== "undefined" ? CFG : {}),
