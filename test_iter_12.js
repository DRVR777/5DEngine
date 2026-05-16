// test_iter_12.js — slot inventory + 4 ammo types.
const Inv = require("./inventory.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

// 1. 4 ammo types present
const ammo = ["pistol_9mm", "rifle_556", "shotgun_12g", "energy_cell"];
for (const t of ammo) {
  const def = Inv.getItemType(t);
  ok(def !== null && def.category === "ammo", `ammo type ${t} registered`);
}

// 2. 7 gun item types present
const guns = ["gun_pistol", "gun_smg", "gun_rifle", "gun_shotgun", "gun_sniper", "gun_rocket", "gun_plasma"];
for (const g of guns) ok(Inv.getItemType(g) !== null, `gun item ${g} registered`);

// 3. Stacking — same type fills first stack
const inv = Inv.makeInventory(24);
let leftover = Inv.addItem(inv, "pistol_9mm", 50);
ok(leftover === 0, "addItem 50 pistol → all fit");
ok(Inv.countItem(inv, "pistol_9mm") === 50, "count = 50");

leftover = Inv.addItem(inv, "pistol_9mm", 30);
ok(leftover === 0, "addItem 30 more → all fit");
ok(Inv.countItem(inv, "pistol_9mm") === 80, "count = 80");
ok(inv.slots.filter(s => s && s.type === "pistol_9mm").length === 1,
   "still one stack (within maxStack=200)");

// 4. Stack overflow into new slot
Inv.addItem(inv, "pistol_9mm", 200); // total now 280
ok(Inv.countItem(inv, "pistol_9mm") === 280, "count after overflow = 280");
ok(inv.slots.filter(s => s && s.type === "pistol_9mm").length === 2,
   "two stacks after maxStack reached");

// 5. Non-stackable: each gun is its own slot
const inv2 = Inv.makeInventory(24);
Inv.addItem(inv2, "gun_pistol", 1);
Inv.addItem(inv2, "gun_pistol", 1);
ok(Inv.countItem(inv2, "gun_pistol") === 2, "two gun_pistol items");
ok(inv2.slots.filter(s => s && s.type === "gun_pistol").length === 2,
   "non-stackable: 2 slots used");

// 6. Inventory full → leftover returned
const small = Inv.makeInventory(2);
Inv.addItem(small, "gun_pistol", 1);
Inv.addItem(small, "gun_smg", 1);
const ovf = Inv.addItem(small, "gun_rifle", 1);
ok(ovf === 1, `full inventory returns leftover qty (got ${ovf})`);

// 7. Remove
const rem = Inv.removeItem(inv, "pistol_9mm", 100);
ok(rem === 100, `removed 100 (got ${rem})`);
ok(Inv.countItem(inv, "pistol_9mm") === 180, "count = 180 after remove");

// Remove more than exists → only what's there
const rem2 = Inv.removeItem(inv, "rifle_556", 50);
ok(rem2 === 0, `remove from empty type returns 0 (got ${rem2})`);

// 8. hasItem
ok(Inv.hasItem(inv, "pistol_9mm", 100) === true, "hasItem: 100 of 180 → true");
ok(Inv.hasItem(inv, "pistol_9mm", 999) === false, "hasItem: 999 of 180 → false");

// 9. totalWeight respects per-item weights
const winv = Inv.makeInventory(8);
Inv.addItem(winv, "pistol_9mm", 100); // 0.01 × 100 = 1.0
Inv.addItem(winv, "rocket", 4);       // 1.5 × 4 = 6.0
const w = Inv.totalWeight(winv);
ok(Math.abs(w - 7.0) < 0.01, `weight: 1.0 + 6.0 = 7.0 (got ${w.toFixed(2)})`);

// 10. registerItemType — modular
Inv.registerItemType("crystal", { category: "currency", stackable: true, maxStack: 999, weight: 0.5 });
ok(Inv.getItemType("crystal").category === "currency", "registered custom type");
let threw = false;
try { Inv.registerItemType("pistol_9mm", {}); } catch (e) { threw = true; }
ok(threw, "duplicate registration throws");

// 11. toRows projection includes hotbar/active flags
const inv3 = Inv.makeInventory(10);
Inv.addItem(inv3, "gun_pistol", 1);
const rows = Inv.toRows(inv3);
ok(rows.length === 10, "toRows: one row per slot");
ok(rows[0].active === true, "first slot is active hotbar");
ok(rows[0].type === "gun_pistol", "first slot has the gun");
ok(rows[8].type === null && rows[8].hotbar === false, "non-hotbar slot empty");

// 12. category filter usability
const ammoCount = rows.filter(r => r.category === "ammo").length;
ok(ammoCount === 0, "no ammo in this inventory");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
