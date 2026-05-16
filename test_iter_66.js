// test_iter_66.js — mod marketplace: list, buy, settle payouts, review.
const MM = require("./mod_marketplace.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

// Mock economy ops
function makeEcon() {
  const bal = new Map();
  const _w = (p) => { if (!bal.has(p)) bal.set(p, new Map()); return bal.get(p); };
  return {
    bal,
    balance: (p, c) => _w(p).get(c) || 0,
    withdraw: (p, c, a) => {
      const cur = _w(p).get(c) || 0;
      if (cur < a) return { ok: false, reason: "insufficient" };
      _w(p).set(c, cur - a);
      return { ok: true };
    },
    deposit: (p, c, a) => {
      _w(p).set(c, (_w(p).get(c) || 0) + a);
      return { ok: true };
    },
  };
}

const mkt = MM.createMarketplace({ platformFee: 0.20 });

// 1. list
const l1 = mkt.list("epic_mod", { sellerId: "alice", price: 100, ccy: "coin", name: "Epic Mod" });
ok(l1.ok === true, "list epic_mod");
ok(mkt.get("epic_mod").price === 100, "price stored");
ok(mkt.get("epic_mod").downloads === 0, "downloads start at 0");

// Duplicate
ok(mkt.list("epic_mod", { sellerId: "alice", price: 100, ccy: "coin" }).ok === false,
   "duplicate listing rejected");

// Bad listings
ok(mkt.list("bad", {}).ok === false, "missing fields rejected");
ok(mkt.list("bad2", { sellerId: "a", price: -10, ccy: "coin" }).ok === false, "negative price rejected");
ok(mkt.list("bad3", { sellerId: "a", price: 10 }).ok === false, "missing ccy rejected");

// More listings
mkt.list("free_mod", { sellerId: "bob", price: 0, ccy: "coin", name: "Free Mod" });
mkt.list("dx_pack", { sellerId: "carol", price: 250, ccy: "coin", name: "Deluxe Pack" });

ok(mkt.listAll().length === 3, "3 listings");

// 2. search
const all = mkt.search();
ok(all.length === 3, "search '' returns all");
ok(mkt.search("epic").length === 1, "search 'epic'");
ok(mkt.search("", { maxPrice: 100 }).length === 2, "maxPrice 100 → 2 (epic + free)");
ok(mkt.search("", { ccy: "ghost" }).length === 0, "search by missing ccy");

// 3. Free mod purchase
const fpurchase = mkt.purchase("buyer1", "free_mod");
ok(fpurchase.ok === true, "free purchase ok");
ok(fpurchase.price === 0, "price = 0");
ok(mkt.owns("buyer1", "free_mod"), "buyer owns it");
ok(mkt.get("free_mod").downloads === 1, "downloads incremented");

// 4. Paid purchase (insufficient)
const econ = makeEcon();
const r1 = mkt.purchase("dave", "epic_mod", econ);
ok(r1.ok === false && r1.reason === "insufficient_funds", "no money → fail");

// Fund dave
econ.deposit("dave", "coin", 500);
const r2 = mkt.purchase("dave", "epic_mod", econ);
ok(r2.ok === true, "paid purchase ok");
ok(r2.price === 100, "paid 100");
ok(r2.fee === 20, "fee = 20% of 100 = 20");
ok(r2.sellerPayout === 80, "seller gets 80");
ok(econ.balance("dave", "coin") === 400, "dave's balance dropped to 400");

ok(mkt.owns("dave", "epic_mod"), "dave owns epic_mod");
ok(mkt.get("epic_mod").downloads === 1, "epic downloads = 1");

// 5. Self-purchase rejected
const self = mkt.purchase("alice", "epic_mod", econ);
ok(self.ok === false && self.reason === "self_purchase", "seller can't buy own mod");

// Already-owned
const dup = mkt.purchase("dave", "epic_mod", econ);
ok(dup.ok === false && dup.reason === "already_owned", "duplicate purchase rejected");

// 6. Pending payouts
const pq = mkt.pendingPayouts();
ok(pq.length === 1, "1 pending payout");
ok(pq[0].sellerId === "alice", "alice gets paid");
ok(pq[0].amount === 80, "amount = 80");
ok(pq[0].ccy === "coin", "ccy = coin");

// 7. settlePayouts
const settled = mkt.settlePayouts(econ);
ok(settled.length === 1, "1 settlement");
ok(settled[0].sellerId === "alice", "settled to alice");
ok(settled[0].totalPaid === 80, "alice paid 80");
ok(econ.balance("alice", "coin") === 80, "alice's economy balance = 80");
ok(mkt.pendingPayouts().length === 0, "queue empty after settlement");

// Multiple buyers → batched payout
econ.deposit("eve", "coin", 500);
econ.deposit("frank", "coin", 500);
mkt.purchase("eve", "epic_mod", econ);     // 100 → alice +80 → queue
mkt.purchase("frank", "epic_mod", econ);   // 100 → alice +80 → queue
mkt.purchase("eve", "dx_pack", econ);      // 250 → carol +200 → queue
ok(mkt.pendingPayouts().length === 3, "3 pending payouts");

const settled2 = mkt.settlePayouts(econ);
ok(settled2.length === 2, "2 sellers paid (alice + carol)");
const aliceSettlement = settled2.find(s => s.sellerId === "alice");
ok(aliceSettlement.totalPaid === 160, `alice batched: 80+80=160 (got ${aliceSettlement.totalPaid})`);
ok(aliceSettlement.count === 2, "2 purchases batched");
ok(econ.balance("alice", "coin") === 240, "alice now has 80+160=240");
ok(econ.balance("carol", "coin") === 200, "carol has 200");

// Empty queue settle is safe
const empty = mkt.settlePayouts(econ);
ok(empty.length === 0, "empty queue → empty settlements");

// 8. Review (only by owners)
const rev0 = mkt.review("epic_mod", "ghost", 5, "great");
ok(rev0.ok === false && rev0.reason === "not_owner", "non-owner review rejected");

const rev1 = mkt.review("epic_mod", "dave", 5, "fantastic");
ok(rev1.ok === true, "owner review ok");
ok(mkt.get("epic_mod").rating === 5, "rating = 5");

const rev2 = mkt.review("epic_mod", "eve", 3, "ok");
ok(rev2.ok === true, "eve reviews");
ok(mkt.get("epic_mod").rating === 4, "avg = (5+3)/2 = 4");

ok(mkt.getReviews("epic_mod").length === 2, "2 reviews");

const revBad = mkt.review("epic_mod", "dave", 0, "");
ok(revBad.ok === false && revBad.reason === "bad_stars", "0 stars rejected");

const revGhost = mkt.review("ghost_mod", "dave", 5, "");
ok(revGhost.ok === false && revGhost.reason === "not_listed", "missing mod rejected");

// 9. unlist
ok(mkt.unlist("free_mod").ok === true, "unlist ok");
ok(mkt.get("free_mod") === null, "removed from listings");
ok(mkt.unlist("ghost").ok === false, "unlist missing → fail");

// Seller-only unlist
ok(mkt.unlist("epic_mod", "ghost").ok === false, "non-seller unlist rejected");
ok(mkt.unlist("epic_mod", "alice").ok === true, "seller unlist ok");

// 10. Search sort by downloads
mkt.list("popular", { sellerId: "x", price: 10, ccy: "coin" });
mkt.list("niche", { sellerId: "x", price: 10, ccy: "coin" });
econ.deposit("buy1", "coin", 100); econ.deposit("buy2", "coin", 100); econ.deposit("buy3", "coin", 100);
mkt.purchase("buy1", "popular", econ);
mkt.purchase("buy2", "popular", econ);
mkt.purchase("buy3", "popular", econ);
mkt.purchase("buy1", "niche", econ);
const sorted = mkt.search("");
ok(sorted[0].modId === "popular", "popular ranks first (3 downloads > 1)");

// 11. Custom platform fee
const mkt2 = MM.createMarketplace({ platformFee: 0.10 });
mkt2.list("x", { sellerId: "s", price: 100, ccy: "coin" });
const e2 = makeEcon();
e2.deposit("b", "coin", 200);
const r3 = mkt2.purchase("b", "x", e2);
ok(r3.fee === 10, "10% platform fee");
ok(r3.sellerPayout === 90, "seller gets 90");

// 12. Audit events
const ev = mkt.recentEvents();
ok(ev.length > 5, `events logged (${ev.length})`);
const kinds = new Set(ev.map(e => e.kind));
ok(kinds.has("list") && kinds.has("purchase") && kinds.has("settle"), "kinds present");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
