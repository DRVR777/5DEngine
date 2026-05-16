// test_iter_19.js — buy/sell shop.
const Shop = require("./shop.js");
const Inv  = require("./inventory.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}
const invOps = { countItem: Inv.countItem, removeItem: Inv.removeItem, addItem: Inv.addItem };

// 1. makeShop
const shop = Shop.makeShop({
  name: "Ammo Cabinet", kind: "ammo",
  stock: [
    { type: "pistol_9mm", qty: 100, price: 1 },
    { type: "rifle_556",  qty: 60,  price: 2 },
    { type: "rocket",     qty: 4,   price: 50 },
  ],
  buybackRate: 0.5,
});
ok(shop.name === "Ammo Cabinet", "shop name set");
ok(shop.stock.length === 3, "3 stock entries");
ok(shop.currency === "coin", "default currency = coin");

// 2. Buy succeeds when stock + coins available
const inv = Inv.makeInventory(24);
Inv.addItem(inv, "coin", 100);
const r1 = Shop.buy(shop, inv, "pistol_9mm", 30, invOps);
ok(r1.ok === true, "buy 30 9mm ok");
ok(r1.paid === 30, "paid = 30");
ok(Inv.countItem(inv, "coin") === 70, "coins decremented to 70");
ok(Inv.countItem(inv, "pistol_9mm") === 30, "30 9mm in inv");
ok(shop.stock[0].qty === 70, "shop stock decremented");

// 3. Insufficient currency
const r2 = Shop.buy(shop, inv, "rocket", 4, invOps);
ok(r2.ok === false, "buy 4 rockets fails (need 200, have 70)");
ok(r2.reason === "insufficient_currency", `reason = ${r2.reason}`);
ok(Inv.countItem(inv, "coin") === 70, "coins not touched on failed buy");

// 4. Out of stock
const r3 = Shop.buy(shop, inv, "rocket", 10, invOps);
ok(r3.ok === false, "buy more than stocked fails");
ok(r3.reason === "insufficient_stock", `reason = ${r3.reason}`);

// 5. Not in stock
const r4 = Shop.buy(shop, inv, "medkit", 1, invOps);
ok(r4.ok === false && r4.reason === "not_in_stock", "unknown item rejected");

// 6. Sell back
const r5 = Shop.sell(shop, inv, "pistol_9mm", 20, invOps);
ok(r5.ok === true, "sell 20 9mm ok");
ok(r5.received === 10, `received 10 coin (price 1 × rate 0.5 × qty 20 = 10), got ${r5.received}`);
ok(Inv.countItem(inv, "coin") === 80, "coin inventory + 10");
ok(Inv.countItem(inv, "pistol_9mm") === 10, "9mm inv - 20");
ok(shop.stock[0].qty === 90, "shop stock + 20");

// 7. Sell unknown item — adds to shop stock at default price
const r6 = Shop.sell(shop, inv, "pistol_9mm", 5, invOps);
ok(r6.ok === true, "sell more pistol_9mm ok");

const inv2 = Inv.makeInventory(24);
Inv.addItem(inv2, "medkit", 3);
const beforeStock = shop.stock.length;
const r7 = Shop.sell(shop, inv2, "medkit", 2, invOps);
ok(r7.ok === true, "sell unknown item to shop ok");
ok(shop.stock.length === beforeStock + 1, "shop stock entry created for new type");

// 8. Sell more than have
const r8 = Shop.sell(shop, inv2, "medkit", 99, invOps);
ok(r8.ok === false, "sell more than owned fails");

// 9. Restock
Shop.restock(shop, "rocket", 10);
ok(shop.stock.find(s => s.type === "rocket").qty === 10, "restock set qty");

// 10. Buy after restock + lots of coin
Inv.addItem(inv, "coin", 1000);
const r9 = Shop.buy(shop, inv, "rocket", 4, invOps);
ok(r9.ok === true, "buy 4 rockets after restock");
ok(r9.paid === 200, "paid 200 for 4 rockets");
ok(Inv.countItem(inv, "rocket") === 4, "4 rockets received");

// 11. Vehicle dealership scenario — selling high-cost item
// Register the blueprint type for this test process
if (!Inv.getItemType("vehicle_blueprint_sedan")) {
  Inv.registerItemType("vehicle_blueprint_sedan", { category: "blueprint", stackable: false, weight: 0 });
}
const dealership = Shop.makeShop({
  name: "Cars", kind: "vehicle",
  stock: [
    { type: "vehicle_blueprint_sedan", qty: 3, price: 2000 },
  ],
  buybackRate: 0.6,
});
const richInv = Inv.makeInventory(24);
Inv.addItem(richInv, "coin", 5000);
const r10 = Shop.buy(dealership, richInv, "vehicle_blueprint_sedan", 1, invOps);
ok(r10.ok === true, `buy a sedan blueprint (paid ${r10.paid})`);
ok(Inv.countItem(richInv, "vehicle_blueprint_sedan") === 1, "blueprint in inv");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
