// test_iter_97.js — trading post: offer, bid, escrow, dispute, resolve.
const T = require("./trading_post.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

// Mock economy
function mkEcon() {
  const bal = new Map();
  const k = (p, c) => p + "::" + c;
  return {
    set: (p, c, a) => bal.set(k(p,c), a),
    balance: (p, c) => bal.get(k(p,c)) || 0,
    deposit: (p, c, a) => { bal.set(k(p,c), (bal.get(k(p,c)) || 0) + a); return { ok: true }; },
    withdraw: (p, c, a) => {
      const cur = bal.get(k(p,c)) || 0;
      if (cur < a) return { ok: false };
      bal.set(k(p,c), cur - a); return { ok: true };
    },
  };
}

// Mock inventory
function mkInv() {
  const owned = new Map();      // playerId+itemId → qty
  const held = new Map();
  const k = (p, i) => p + "::" + i;
  return {
    give: (p, i, q) => owned.set(k(p,i), (owned.get(k(p,i)) || 0) + q),
    own: (p, i) => owned.get(k(p,i)) || 0,
    holdItem: (p, i, q) => {
      const cur = owned.get(k(p,i)) || 0;
      if (cur < q) return { ok: false };
      owned.set(k(p,i), cur - q);
      held.set(k(p,i), (held.get(k(p,i)) || 0) + q);
      return { ok: true };
    },
    transferHeld: (from, to, i, q) => {
      held.set(k(from,i), Math.max(0, (held.get(k(from,i)) || 0) - q));
      owned.set(k(to,i), (owned.get(k(to,i)) || 0) + q);
    },
    releaseHeld: (p, i, q) => {
      held.set(k(p,i), Math.max(0, (held.get(k(p,i)) || 0) - q));
      owned.set(k(p,i), (owned.get(k(p,i)) || 0) + q);
    },
  };
}

// 1. createOffer
const sys = T.createSystem();
const o1 = sys.createOffer("alice", { itemId: "sword", qty: 1, askingCcy: "coin", askingAmount: 100 });
ok(o1.ok === true, "create offer ok");
ok(o1.offer.state === "open", "state open");

// Bad creates
ok(sys.createOffer("", {}).ok === false, "empty rejected");
ok(sys.createOffer("a", { itemId: "x", qty: 0, askingCcy: "c", askingAmount: 1 }).ok === false, "qty 0");
ok(sys.createOffer("a", { itemId: "x", qty: 1, askingCcy: "c", askingAmount: -5 }).ok === false, "negative amount");
ok(sys.createOffer("a", { itemId: "x", qty: 1, askingAmount: 10 }).ok === false, "missing ccy");

// 2. makeBid
const b1 = sys.makeBid(o1.id, "bob", { ccy: "coin", amount: 80 });
ok(b1.ok === true, "bid ok");
ok(sys.getOffer(o1.id).state === "bidding", "state bidding");

// Self-bid
ok(sys.makeBid(o1.id, "alice", { ccy: "coin", amount: 100 }).ok === false, "self bid rejected");
ok(sys.makeBid(o1.id, "bob", {}).ok === false, "empty bid");

// 3. acceptBid + escrow
const econ = mkEcon();
econ.set("bob", "coin", 200);
const inv = mkInv();
inv.give("alice", "sword", 1);

const ab = sys.acceptBid(o1.id, "alice", b1.bidId, { economy: econ, inventory: inv });
ok(ab.ok === true, "accept bid ok");
ok(sys.getOffer(o1.id).state === "escrowed", "state escrowed");
ok(econ.balance("bob", "coin") === 120, "bob withdrawn 80");
ok(inv.own("alice", "sword") === 0, "alice's sword held");

// 4. confirmTrade — both sides must confirm
const c1 = sys.confirmTrade(o1.id, "alice", { economy: econ, inventory: inv });
ok(c1.ok === true, "alice confirms");
ok(sys.getOffer(o1.id).state === "escrowed", "still escrowed, awaiting buyer");
ok(c1.awaiting === "buyer", "awaiting buyer");

const c2 = sys.confirmTrade(o1.id, "bob", { economy: econ, inventory: inv });
ok(c2.ok === true && c2.state === "finished", "bob confirms → finished");
ok(econ.balance("alice", "coin") === 80, "alice got 80");
ok(inv.own("bob", "sword") === 1, "bob got sword");

// Non-participant
ok(sys.confirmTrade(o1.id, "carol", { economy: econ }).ok === false, "non-participant rejected");

// 5. acceptOffer (buyer takes asking price)
const o2 = sys.createOffer("seller", { itemId: "shield", qty: 1, askingCcy: "coin", askingAmount: 50 });
econ.set("carol", "coin", 100);
inv.give("seller", "shield", 1);
const ao = sys.acceptOffer(o2.id, "carol", { economy: econ, inventory: inv });
ok(ao.ok === true, "accept asking price");
ok(sys.getOffer(o2.id).state === "escrowed", "escrowed");
ok(econ.balance("carol", "coin") === 50, "carol withdrawn 50");
sys.confirmTrade(o2.id, "seller", { economy: econ, inventory: inv });
sys.confirmTrade(o2.id, "carol", { economy: econ, inventory: inv });
ok(sys.getOffer(o2.id).state === "finished", "finished");
ok(inv.own("carol", "shield") === 1, "carol has shield");

// 6. Insufficient funds — escrow refused
const o3 = sys.createOffer("x", { itemId: "gem", qty: 1, askingCcy: "coin", askingAmount: 99999 });
inv.give("x", "gem", 1);
const ins = sys.acceptOffer(o3.id, "broke", { economy: econ, inventory: inv });
ok(ins.ok === false && ins.reason === "insufficient_funds", "broke buyer rejected");

// 7. Cancel offer
const o4 = sys.createOffer("seller2", { itemId: "x", qty: 1, askingCcy: "coin", askingAmount: 10 });
ok(sys.cancelOffer(o4.id, "seller2").ok === true, "cancel ok");
ok(sys.getOffer(o4.id).state === "cancelled", "cancelled");
ok(sys.cancelOffer(o4.id, "seller2").ok === false, "double cancel fails");

// Non-seller can't cancel
const o5 = sys.createOffer("seller3", { itemId: "x", qty: 1, askingCcy: "coin", askingAmount: 1 });
ok(sys.cancelOffer(o5.id, "intruder").ok === false, "non-seller can't cancel");

// 8. Dispute → resolve
const o6 = sys.createOffer("vendor", { itemId: "potion", qty: 5, askingCcy: "coin", askingAmount: 30 });
econ.set("client", "coin", 100);
inv.give("vendor", "potion", 5);
sys.acceptOffer(o6.id, "client", { economy: econ, inventory: inv });

const disp = sys.openDispute(o6.id, "client");
ok(disp.ok === true, "dispute open");
ok(sys.getOffer(o6.id).state === "disputed", "state disputed");

// Try to confirm while disputed
ok(sys.confirmTrade(o6.id, "vendor", { economy: econ, inventory: inv }).ok === false,
   "confirm during dispute rejected");

// Resolve in buyer's favor
const res = sys.resolveDispute(o6.id, "buyer", { economy: econ, inventory: inv });
ok(res.ok === true && res.choice === "buyer", "buyer wins");
ok(econ.balance("client", "coin") === 100, "client refunded (30 back from 70)");
ok(inv.own("client", "potion") === 5, "client got potion");

// 9. Resolve in seller's favor
const o7 = sys.createOffer("v2", { itemId: "scroll", qty: 1, askingCcy: "coin", askingAmount: 40 });
econ.set("c2", "coin", 100);
inv.give("v2", "scroll", 1);
sys.acceptOffer(o7.id, "c2", { economy: econ, inventory: inv });
sys.openDispute(o7.id, "v2");
const res2 = sys.resolveDispute(o7.id, "seller", { economy: econ, inventory: inv });
ok(res2.ok === true, "seller wins");
ok(econ.balance("v2", "coin") === 40, "vendor got 40");
ok(inv.own("v2", "scroll") === 1, "vendor got scroll back");

// 10. Split resolution
const o8 = sys.createOffer("v3", { itemId: "ring", qty: 1, askingCcy: "coin", askingAmount: 60 });
econ.set("c3", "coin", 100);
inv.give("v3", "ring", 1);
sys.acceptOffer(o8.id, "c3", { economy: econ, inventory: inv });
sys.openDispute(o8.id, "c3");
sys.resolveDispute(o8.id, "split", { economy: econ, inventory: inv });
ok(econ.balance("v3", "coin") === 30, "vendor got half (30)");
// c3 paid 60 and got back 30
ok(econ.balance("c3", "coin") === 70, `client got half back (got ${econ.balance("c3", "coin")})`);

// 11. Resolver function form
const o9 = sys.createOffer("v4", { itemId: "amulet", qty: 1, askingCcy: "coin", askingAmount: 20 });
econ.set("c4", "coin", 100);
inv.give("v4", "amulet", 1);
sys.acceptOffer(o9.id, "c4", { economy: econ, inventory: inv });
sys.openDispute(o9.id, "v4");
const resFn = sys.resolveDispute(o9.id, () => "buyer", { economy: econ, inventory: inv });
ok(resFn.ok === true && resFn.choice === "buyer", "resolver fn works");

// Bad resolver choice
const o10 = sys.createOffer("v5", { itemId: "bow", qty: 1, askingCcy: "coin", askingAmount: 10 });
econ.set("c5", "coin", 100); inv.give("v5", "bow", 1);
sys.acceptOffer(o10.id, "c5", { economy: econ, inventory: inv });
sys.openDispute(o10.id, "v5");
const badRes = sys.resolveDispute(o10.id, "weird", { economy: econ });
ok(badRes.ok === false, "bad choice rejected");

// 12. Self-buy via accept
const o11 = sys.createOffer("alice", { itemId: "boots", qty: 1, askingCcy: "coin", askingAmount: 5 });
ok(sys.acceptOffer(o11.id, "alice").ok === false, "self-buy rejected");

// 13. expireOldOffers
const sys2 = T.createSystem({ config: { offerTtlMs: 100 } });
sys2.createOffer("s", { itemId: "x", qty: 1, askingCcy: "coin", askingAmount: 1 });
const expired = sys2.expireOldOffers(Date.now() + 1000);
ok(expired === 1, "1 expired");

// 14. listOpen
const sys3 = T.createSystem();
for (let i = 0; i < 5; i++) {
  sys3.createOffer("s" + i, { itemId: "i", qty: 1, askingCcy: "coin", askingAmount: i + 1 });
}
ok(sys3.listOpen().length === 5, "5 open");
sys3.cancelOffer("offer_1", "s0");
ok(sys3.listOpen().length === 4, "4 open after cancel");

// 15. listBy filter
const filt = sys3.listBy(o => o.askingAmount >= 3);
ok(filt.length === 3, `filter ≥3 → 3 offers (got ${filt.length})`);

// 16. Events
const ev = sys.recentEvents();
ok(ev.length > 0, "events logged");
ok(ev.some(e => e.kind === "escrow"), "escrow event");
ok(ev.some(e => e.kind === "finish"), "finish event");
ok(ev.some(e => e.kind === "resolve"), "resolve event");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
