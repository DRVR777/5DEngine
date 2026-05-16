// test_iter_117.js — housing: list/buy/sell/rent + storage + decor + rent tick.
const H = require("./housing.js");

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
    set: (p, c, a) => bal.set(k(p,c), a),
  };
}

// 1. listProperty
const sys = H.createSystem();
ok(sys.listProperty({ id: "lake_house", price: 50000, location: "lake" }).ok, "list ok");
ok(sys.listProperty({}).ok === false, "missing id");
ok(sys.listProperty({ id: "lake_house", price: 1 }).ok === false, "duplicate");
ok(sys.listProperty({ id: "x", price: -1 }).ok === false, "neg price");

ok(sys.listProperties().length === 1, "1 property");
ok(sys.listProperties("listed").length === 1, "1 listed");

// 2. buy
const econ = mkEcon();
econ.deposit("alice", "coin", 100000);
const b1 = sys.buy("lake_house", "alice", { economy: econ });
ok(b1.ok === true, "alice bought");
ok(b1.paid === 50000, "paid 50000");
ok(econ.balance("alice", "coin") === 50000, "alice balance reduced");
ok(sys.getProperty("lake_house").owner === "alice", "alice is owner");
ok(sys.getProperty("lake_house").state === "owned", "state owned");

// 3. Cannot buy owned
const econBob = mkEcon();
econBob.deposit("bob", "coin", 100000);
ok(sys.buy("lake_house", "bob", { economy: econBob }).ok === false, "already owned");

// Insufficient funds
sys.listProperty({ id: "mansion", price: 999999 });
ok(sys.buy("mansion", "alice", { economy: econ }).ok === false, "insufficient");

// No property
ok(sys.buy("ghost", "alice").ok === false, "ghost property");

// 4. sell
const s1 = sys.sell("lake_house", "alice", { economy: econ, refundRate: 0.7 });
ok(s1.ok && s1.refund === 35000, "refund 35000");
ok(sys.getProperty("lake_house").owner === null, "no owner");
ok(sys.getProperty("lake_house").state === "listed", "back to listed");

// Non-owner can't sell
sys.buy("lake_house", "alice", { economy: econ });
ok(sys.sell("lake_house", "intruder").ok === false, "non-owner can't sell");

// 5. rent
sys.listProperty({ id: "apt_5b", price: 10000, rentPerDay: 50 });
sys.buy("apt_5b", "bob", { economy: econBob });
const econCarol = mkEcon();
econCarol.deposit("carol", "coin", 5000);
const r1 = sys.rent("apt_5b", "carol", { economy: econCarol, day: 0 });
ok(r1.ok === true, "carol rented");
ok(r1.firstPayment === 1500, `first month 50*30=1500 (got ${r1.firstPayment})`);
ok(econCarol.balance("carol", "coin") === 3500, "carol paid 1500");
// bob's rent goes into the SAME economy carol withdrew from (single bridge)
ok(econCarol.balance("bob", "coin") === 1500, "bob got 1500 rent in shared economy");
ok(sys.getProperty("apt_5b").tenant === "carol", "tenant set");
ok(sys.getProperty("apt_5b").state === "rented", "state rented");

// Can't rent already-rented
const econDave = mkEcon();
econDave.deposit("dave", "coin", 5000);
ok(sys.rent("apt_5b", "dave", { economy: econDave }).ok === false, "already rented");

// Rent unowned
sys.listProperty({ id: "vacant_lot", price: 1000, rentPerDay: 10 });
ok(sys.rent("vacant_lot", "anyone").ok === false, "no owner");

// 6. moveOut
ok(sys.moveOut("apt_5b", "carol").ok === true, "carol moves out");
ok(sys.getProperty("apt_5b").tenant === null, "tenant cleared");
ok(sys.moveOut("apt_5b", "carol").ok === false, "double move-out fails");

// 7. tickRent — auto-debit tenant
const sys2 = H.createSystem();
sys2.listProperty({ id: "rent_unit", price: 5000, rentPerDay: 10 });
const econOwner = mkEcon();
econOwner.deposit("landlord", "coin", 10000);
sys2.buy("rent_unit", "landlord", { economy: econOwner });
const econT = mkEcon();
econT.deposit("tenant", "coin", 1000);
sys2.rent("rent_unit", "tenant", { economy: econT, day: 0 });

// Advance day → bill tenant
// rentPerDay=10, first-month rent = 10*30 = 300. tenant deposit 1000 → 700 after first month.
// Then tickRent(5) bills 5 days × 10 = 50 more.
const tick1 = sys2.tickRent(5, { economy: econT });
ok(tick1.some(e => e.kind === "paid"), "rent paid event");
ok(econT.balance("tenant", "coin") === 1000 - 300 - 50, "tenant paid 300 first + 50 tick");

// 8. Missed rent → eviction
const sys3 = H.createSystem({ config: { evictAfterMissedN: 2 } });
sys3.listProperty({ id: "u", price: 1000, rentPerDay: 100 });
const econL = mkEcon();
econL.deposit("ll", "coin", 5000);
sys3.buy("u", "ll", { economy: econL });
const econPoor = mkEcon();
econPoor.deposit("poorT", "coin", 5000);   // can afford first month
sys3.rent("u", "poorT", { economy: econPoor, day: 0 });

// Drain tenant
econPoor.set("poorT", "coin", 0);
const t1 = sys3.tickRent(5, { economy: econPoor });
ok(t1.some(e => e.kind === "missed"), "missed rent");
const t2 = sys3.tickRent(10, { economy: econPoor });
ok(t2.some(e => e.kind === "evicted"), "evicted after 2 misses");
ok(sys3.getProperty("u").tenant === null, "tenant evicted");

// 9. Storage
sys.buy("vacant_lot", "alice", { economy: econ });
ok(sys.storeItem("vacant_lot", "alice", "gold", 50).ok, "store gold");
ok(sys.storageContents("vacant_lot").gold === 50, "stored");
ok(sys.storeItem("vacant_lot", "intruder", "gem", 1).ok === false, "non-owner can't store");

// Capacity
const sys4 = H.createSystem({ config: { defaultStorageCapacity: 10 } });
sys4.listProperty({ id: "small", price: 100 });
const econ4 = mkEcon();
econ4.deposit("o", "coin", 1000);
sys4.buy("small", "o", { economy: econ4 });
ok(sys4.storeItem("small", "o", "x", 10).ok, "fill capacity");
ok(sys4.storeItem("small", "o", "y", 1).ok === false, "over capacity");

// take
ok(sys.takeItem("vacant_lot", "alice", "gold", 20).ok, "take 20");
ok(sys.storageContents("vacant_lot").gold === 30, "30 left");
ok(sys.takeItem("vacant_lot", "alice", "gold", 999).ok === false, "insufficient");

// take all
sys.takeItem("vacant_lot", "alice", "gold", 30);
ok(sys.storageContents("vacant_lot").gold === undefined, "empty slot removed");

// 10. Tenant can also store
const sys5 = H.createSystem();
sys5.listProperty({ id: "shared", price: 1000, rentPerDay: 1 });
const eL = mkEcon(); eL.deposit("L", "coin", 5000);
sys5.buy("shared", "L", { economy: eL });
const eT = mkEcon(); eT.deposit("T", "coin", 5000);
sys5.rent("shared", "T", { economy: eT, day: 0 });
ok(sys5.storeItem("shared", "T", "x", 5).ok === true, "tenant can store");
ok(sys5.takeItem("shared", "L", "x", 1).ok === true, "owner can take too");

// 11. Decorations
ok(sys.placeDecoration("vacant_lot", "alice", { id: "rug", name: "Persian Rug" }).ok, "place rug");
ok(sys.placeDecoration("vacant_lot", "intruder", { id: "x" }).ok === false, "non-owner can't decorate");
ok(sys.placeDecoration("vacant_lot", "alice", {}).ok === false, "bad decor");

ok(sys.decorationsOf("vacant_lot").length === 1, "1 decoration");
ok(sys.removeDecoration("vacant_lot", "alice", 0).ok, "remove ok");
ok(sys.decorationsOf("vacant_lot").length === 0, "empty");

ok(sys.removeDecoration("vacant_lot", "alice", 99).ok === false, "bad slot");

// Decoration cap
const sys6 = H.createSystem({ config: { decorationSlots: 2 } });
sys6.listProperty({ id: "tiny", price: 100 });
const e6 = mkEcon(); e6.deposit("o", "coin", 1000);
sys6.buy("tiny", "o", { economy: e6 });
sys6.placeDecoration("tiny", "o", { id: "a" });
sys6.placeDecoration("tiny", "o", { id: "b" });
ok(sys6.placeDecoration("tiny", "o", { id: "c" }).ok === false, "slot cap");

// 12. unlist
const sys7 = H.createSystem();
sys7.listProperty({ id: "rm", price: 100 });
ok(sys7.unlist("rm") === true, "unlist");
ok(sys7.getProperty("rm") === null, "removed");

// 13. recentEvents
ok(sys.recentEvents().length > 0, "events");
ok(sys.recentEvents().some(e => e.kind === "bought"), "bought event");

// 14. storageContents on missing
ok(sys.storageContents("ghost") === null, "ghost storage null");
ok(sys.decorationsOf("ghost") === null, "ghost decor null");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
