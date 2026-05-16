// test_iter_115.js — vendor restock + dynamic pricing.
const V = require("./vendor_restock.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

function mkEcon() {
  const bal = new Map();
  const k = (p, c) => p + "::" + c;
  return {
    deposit: (p, c, a) => bal.set(k(p,c), (bal.get(k(p,c)) || 0) + a),
    withdraw: (p, c, a) => {
      const cur = bal.get(k(p,c)) || 0;
      if (cur < a) return { ok: false };
      bal.set(k(p,c), cur - a);
      return { ok: true };
    },
    balance: (p, c) => bal.get(k(p,c)) || 0,
  };
}

// 1. registerVendor
const sys = V.createSystem();
ok(sys.registerVendor({ id: "shop1", name: "Apothecary" }).ok, "register");
ok(sys.registerVendor({}).ok === false, "missing id");
ok(sys.registerVendor({ id: "shop1" }).ok === false, "duplicate");

// 2. setItem
ok(sys.setItem("shop1", { itemId: "potion", basePrice: 10, baseStock: 20 }).ok, "set potion");
ok(sys.setItem("shop1", { itemId: "scroll", basePrice: 50, baseStock: 5 }).ok, "set scroll");

ok(sys.setItem("ghost", { itemId: "x", basePrice: 1 }).ok === false, "no vendor");
ok(sys.setItem("shop1", { basePrice: 1 }).ok === false, "no item");
ok(sys.setItem("shop1", { itemId: "x", basePrice: -1 }).ok === false, "neg price");

// 3. priceOf at full stock = basePrice
ok(sys.priceOf("shop1", "potion") === 10, "full stock = base price");
ok(sys.stockOf("shop1", "potion") === 20, "stock=20");

// 4. buy reduces stock + raises price
const buy1 = sys.buy("shop1", "potion", 5);
ok(buy1.ok && buy1.totalCost === 50, "bought 5 @ 10");
ok(sys.stockOf("shop1", "potion") === 15, "stock=15");

// Price went up: ratio 15/20=0.75, mul = 1 + 1*(1-0.75) = 1.25
const newPrice = sys.priceOf("shop1", "potion");
ok(newPrice === 12.5, `price rose to 12.5 (got ${newPrice})`);

// 5. Buy more → higher prices
sys.buy("shop1", "potion", 10);
const scarcityPrice = sys.priceOf("shop1", "potion");
ok(scarcityPrice > newPrice, "price keeps rising");

// 6. Insufficient stock
ok(sys.buy("shop1", "potion", 99).ok === false, "insufficient");

// 7. Buy missing item
ok(sys.buy("shop1", "ghost", 1).ok === false, "no item");
ok(sys.buy("ghost", "potion", 1).ok === false, "no vendor");

// Bad quantity
ok(sys.buy("shop1", "potion", 0).ok === false, "0 qty");
ok(sys.buy("shop1", "potion", -1).ok === false, "neg qty");

// 8. Buy with economy
const econ = mkEcon();
econ.deposit("alice", "coin", 1000);
sys.setItem("shop1", { itemId: "sword", basePrice: 100, baseStock: 10 });
const b2 = sys.buy("shop1", "sword", 2, { economy: econ, buyerId: "alice" });
ok(b2.ok, "buy via economy");
ok(econ.balance("alice", "coin") === 800, "alice paid 200");

// Insufficient funds
const econPoor = mkEcon();
const bP = sys.buy("shop1", "sword", 1, { economy: econPoor, buyerId: "poor" });
ok(bP.ok === false && bP.reason === "insufficient_funds", "poor blocked");

// 9. Restock tick
const sys2 = V.createSystem({ config: { restockRatePerSec: 1.0, restockMode: "linear" } });
sys2.registerVendor({ id: "s" });
sys2.setItem("s", { itemId: "i", basePrice: 10, baseStock: 100, currentStock: 50 });
sys2.tick(1);
// linear mode: inc = 1.0 * 1 * 100 = 100, capped at base
ok(sys2.stockOf("s", "i") === 100, "restocked to base (cap)");

// Exponential mode
const sys3 = V.createSystem({ config: { restockMode: "exponential", restockRatePerSec: 0.5 } });
sys3.registerVendor({ id: "s" });
sys3.setItem("s", { itemId: "i", basePrice: 10, baseStock: 100, currentStock: 50 });
sys3.tick(1);
// inc = (100 - 50) * 0.5 * 1 = 25
ok(sys3.stockOf("s", "i") === 75, `exp restock to 75 (got ${sys3.stockOf("s", "i")})`);

// Tick again
sys3.tick(1);   // inc = 25 * 0.5 = 12.5
ok(Math.abs(sys3.stockOf("s", "i") - 87.5) < 0.001, "exp restock continues");

// 10. Restock doesn't exceed base
sys2.tick(100);   // way more
ok(sys2.stockOf("s", "i") === 100, "never above base");

// 11. Restock at full stock = no-op
const sys4 = V.createSystem();
sys4.registerVendor({ id: "s" });
sys4.setItem("s", { itemId: "i", basePrice: 1, baseStock: 5 });   // currentStock=5
const r4 = sys4.tick(10);
ok(r4.restocked === 0, "no restock needed");

// 12. Overstock keeps price low (sensitivity > 1)
const sys5 = V.createSystem({ config: { sensitivity: 2.0, minPriceFactor: 0.1 } });
sys5.registerVendor({ id: "s" });
sys5.setItem("s", { itemId: "junk", basePrice: 100, baseStock: 10, currentStock: 20 });
// ratio = 20/10 = 2, mul = 1 + 2 * (1 - 2) = -1, clamped to 0.1
const overP = sys5.priceOf("s", "junk");
ok(overP === 10, `overstock = 0.1 × base = 10 (got ${overP})`);

// 13. Out-of-stock price capped at max
const sys6 = V.createSystem({ config: { sensitivity: 100, maxPriceFactor: 5.0 } });
sys6.registerVendor({ id: "s" });
sys6.setItem("s", { itemId: "rare", basePrice: 100, baseStock: 10, currentStock: 0 });
ok(sys6.priceOf("s", "rare") === 500, "zero stock = 5x cap");

// 14. sellBack
const sys7 = V.createSystem();
sys7.registerVendor({ id: "s" });
sys7.setItem("s", { itemId: "x", basePrice: 10, baseStock: 5, currentStock: 0 });
const sb = sys7.sellBack("s", "x", 3);
ok(sb.ok === true, "sellback ok");
// currentPrice at 0/5 stock: mul = 1 + 1*(1-0) = 2 capped at 3 → 2; * 0.5 sellback = 1 per unit; * 3 = 3
const sellPaid = sb.totalPaid;
ok(sellPaid > 0, `paid ${sellPaid}`);
ok(sys7.stockOf("s", "x") === 3, "stock raised");

const econ7 = mkEcon();
sys7.sellBack("s", "x", 1, { economy: econ7, sellerId: "seller" });
ok(econ7.balance("seller", "coin") > 0, "seller got paid via economy");

// sellBack bad cases
ok(sys7.sellBack("ghost", "x", 1).ok === false, "ghost vendor");
ok(sys7.sellBack("s", "ghost", 1).ok === false, "ghost item");
ok(sys7.sellBack("s", "x", 0).ok === false, "0 qty");

// 15. removeItem
const sys8 = V.createSystem();
sys8.registerVendor({ id: "s" });
sys8.setItem("s", { itemId: "x", basePrice: 1 });
ok(sys8.removeItem("s", "x") === true, "removed");
ok(sys8.stockOf("s", "x") === 0, "stock zero after remove");
ok(sys8.removeItem("ghost", "x") === false, "ghost vendor");

// 16. unregisterVendor
const sys9 = V.createSystem();
sys9.registerVendor({ id: "s" });
ok(sys9.unregisterVendor("s") === true, "unreg ok");

// 17. vendorInventory projection
const sys10 = V.createSystem();
sys10.registerVendor({ id: "shop" });
sys10.setItem("shop", { itemId: "a", basePrice: 10, baseStock: 10 });
sys10.setItem("shop", { itemId: "b", basePrice: 20, baseStock: 5 });
sys10.buy("shop", "a", 3);

const inv = sys10.vendorInventory("shop");
ok(inv.length === 2, "2 items");
const a = inv.find(i => i.itemId === "a");
ok(a.stock === 7, "a stock=7");
ok(a.soldTotal === 3, "sold 3");
ok(a.currentPrice > 10, "price > base");
ok(a.baseStock === 10, "baseStock exposed");

ok(sys10.vendorInventory("ghost") === null, "ghost null");

// 18. listVendors
ok(sys10.listVendors().length === 1, "1 vendor");

// 19. priceOf missing
ok(sys.priceOf("shop1", "ghost") === null, "ghost item price null");
ok(sys.priceOf("ghost", "potion") === null, "ghost vendor price null");

// 20. recentEvents
ok(sys.recentEvents().length > 0, "events");
ok(sys.recentEvents().some(e => e.kind === "sale"), "sale event");
ok(sys.recentEvents().some(e => e.kind === "set_item"), "set_item event");

// 21. getConfig
ok(sys.getConfig().restockRatePerSec > 0, "config");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
