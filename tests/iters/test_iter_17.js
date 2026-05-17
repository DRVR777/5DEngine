// test_iter_17.js — recipes + craft.
const Craft = require("./crafting.js");
const Inv   = require("./inventory.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

const invOps = { countItem: Inv.countItem, removeItem: Inv.removeItem, addItem: Inv.addItem };

// part_body, part_engine, part_wheel are pre-registered in inventory.js (iter 12).
// Just register the blueprint type the recipe outputs.
Inv.registerItemType("vehicle_blueprint_sedan", { category: "blueprint", stackable: false, weight: 0 });

// 1. Recipe registry
ok(Craft.getRecipe("medkit_basic") !== null, "medkit_basic registered");
ok(Craft.recipeNames().length >= 5, ">= 5 recipes registered");

// 2. Craft a medkit (anywhere — null tier required)
const inv = Inv.makeInventory(24);
Inv.addItem(inv, "coin", 10);
const r1 = Craft.craft(inv, "medkit_basic", null, invOps);
ok(r1.ok === true, "craft medkit_basic ok");
ok(Inv.countItem(inv, "coin") === 5, `coins decremented to 5 (got ${Inv.countItem(inv, "coin")})`);
ok(Inv.countItem(inv, "medkit") === 1, "medkit added");

// 3. Insufficient inputs
Inv.removeItem(inv, "coin", 99);
const r2 = Craft.craft(inv, "medkit_basic", null, invOps);
ok(r2.ok === false, "craft fails when broke");
ok(r2.reason === "missing_coin", `reason = missing_coin (got ${r2.reason})`);

// 4. Wrong workbench tier
Inv.addItem(inv, "coin", 100);
const r3 = Craft.craft(inv, "pistol_ammo_box", null, invOps);
ok(r3.ok === false, "pistol_ammo_box requires workbench_basic, null tier fails");

const r4 = Craft.craft(inv, "pistol_ammo_box", "workbench_basic", invOps);
ok(r4.ok === true, "pistol_ammo_box at basic workbench succeeds");
ok(Inv.countItem(inv, "pistol_9mm") === 30, "9mm produced");

// 5. Advanced workbench can do basic recipes too
const inv2 = Inv.makeInventory(24);
Inv.addItem(inv2, "coin", 100);
const r5 = Craft.craft(inv2, "pistol_ammo_box", "workbench_advanced", invOps);
ok(r5.ok === true, "advanced workbench can do basic recipes");

// 6. Advanced-only recipe at basic = fail
Inv.addItem(inv2, "energy_cell", 5);
Inv.addItem(inv2, "coin", 100);
const r6 = Craft.craft(inv2, "rocket_round", "workbench_basic", invOps);
ok(r6.ok === false, "rocket_round needs workbench_advanced");

const r7 = Craft.craft(inv2, "rocket_round", "workbench_advanced", invOps);
ok(r7.ok === true, "rocket_round at advanced succeeds");
ok(Inv.countItem(inv2, "rocket") === 1, "1 rocket produced");
ok(Inv.countItem(inv2, "energy_cell") < 5, "energy cells consumed");

// 7. availableRecipes lists what's craftable now
Inv.removeItem(inv2, "coin", 999);  // strip coins
const avail0 = Craft.availableRecipes(inv2, "workbench_advanced", Inv.countItem);
ok(!avail0.includes("medkit_basic"), "without coins, medkit not available");

Inv.addItem(inv2, "coin", 5);
const avail1 = Craft.availableRecipes(inv2, "workbench_advanced", Inv.countItem);
ok(avail1.includes("medkit_basic"), "with 5 coins, medkit available");

// At basic workbench, advanced recipes are filtered
Inv.addItem(inv2, "coin", 200);
Inv.addItem(inv2, "energy_cell", 10);
const availBasic = Craft.availableRecipes(inv2, "workbench_basic", Inv.countItem);
ok(!availBasic.includes("rocket_round"), "rocket not in basic workbench list");
ok(availBasic.includes("pistol_ammo_box"), "pistol ammo in basic list");

// 8. Custom recipe
Craft.registerRecipe("super_medkit", {
  inputs: [{ type: "medkit", qty: 3 }, { type: "coin", qty: 50 }],
  output: { type: "medkit", qty: 5 },
  requires: "workbench_basic",
});
ok(Craft.getRecipe("super_medkit") !== null, "custom recipe registered");
let threw = false;
try { Craft.registerRecipe("medkit_basic", {}); } catch (e) { threw = true; }
ok(threw, "duplicate recipe throws");

// 9. Output overflow refunds inputs.
// Set up: 2-slot inv, both maxed with pistol_9mm (200 each). Recipe consumes
// 1 pistol_9mm so neither slot empties; output (medkit, different type) has
// no slot to land in → overflow → inputs must be refunded.
Craft.registerRecipe("test_overflow", {
  inputs: [{ type: "pistol_9mm", qty: 1 }],
  output: { type: "medkit", qty: 1 },
  requires: null,
});
const inv3 = Inv.makeInventory(2);
Inv.addItem(inv3, "pistol_9mm", 200);  // fills slot 0 to maxStack
Inv.addItem(inv3, "pistol_9mm", 200);  // fills slot 1 to maxStack
const before = Inv.countItem(inv3, "pistol_9mm");
const r8 = Craft.craft(inv3, "test_overflow", null, invOps);
ok(r8.ok === false, `output overflow → fail (got ok=${r8.ok}, reason=${r8.reason})`);
ok(Inv.countItem(inv3, "pistol_9mm") === before, "inputs refunded after overflow");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
