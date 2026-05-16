// test_iter_63.js — peer-to-peer trade with escrow.
const T = require("./trade.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

// Mock inventory + balance ops
function makeOps() {
  const inv = new Map();        // playerId → Map<type, qty>
  const bal = new Map();        // playerId → Map<ccy, amount>
  const _w  = (m, p) => { if (!m.has(p)) m.set(p, new Map()); return m.get(p); };
  return {
    inv, bal,
    countItem: (p, t) => _w(inv, p).get(t) || 0,
    removeItem: (p, t, q) => {
      const w = _w(inv, p);
      const cur = w.get(t) || 0;
      if (cur < q) throw new Error("insufficient");
      w.set(t, cur - q);
      return q;
    },
    addItem: (p, t, q) => {
      const w = _w(inv, p);
      w.set(t, (w.get(t) || 0) + q);
      return 0;
    },
    balance: (p, c) => _w(bal, p).get(c) || 0,
    withdraw: (p, c, a) => {
      const w = _w(bal, p);
      const cur = w.get(c) || 0;
      if (cur < a) throw new Error("insufficient_currency");
      w.set(c, cur - a);
      return { ok: true };
    },
    deposit: (p, c, a) => {
      const w = _w(bal, p);
      w.set(c, (w.get(c) || 0) + a);
      return { ok: true };
    },
  };
}

const sys = T.createTradeSystem();

// 1. open
const t1 = sys.open("alice", "bob", { items: [{ type: "sword", qty: 1 }], currency: [] });
ok(t1.ok === true, "open trade ok");
ok(typeof t1.tradeId === "string", "tradeId returned");
ok(sys.get(t1.tradeId).state === "open", "state = open");

// Empty offer rejected
ok(sys.open("a", "b", {}).ok === false, "empty offer rejected");
ok(sys.open("a", "b", { items: [], currency: [] }).ok === false, "all-empty rejected");

// 2. counter from B
const c1 = sys.counter(t1.tradeId, "bob", { items: [], currency: [{ ccy: "coin", amount: 50 }] });
ok(c1.ok === true, "bob counters");
ok(sys.get(t1.tradeId).state === "counter", "state advanced to counter");

// Non-party can't counter
ok(sys.counter(t1.tradeId, "carol", {}).ok === false, "non-party rejected");

// Counter resets locks (we'll test once we lock)

// 3. lock
const l1 = sys.lock(t1.tradeId, "alice");
ok(l1.ok === true, "alice locks");
ok(l1.fromLocked === true, "fromLocked");
ok(l1.toLocked === false, "toLocked still false");
ok(sys.get(t1.tradeId).state === "counter", "state stays counter (only one locked)");

const l2 = sys.lock(t1.tradeId, "bob");
ok(l2.ok === true, "bob locks");
ok(sys.get(t1.tradeId).state === "both_locked", "both locked → state both_locked");

// Counter resets both locks
sys.counter(t1.tradeId, "alice", { items: [{ type: "shield", qty: 1 }], currency: [] });
ok(sys.get(t1.tradeId).fromLocked === false && sys.get(t1.tradeId).toLocked === false,
   "counter resets locks");
ok(sys.get(t1.tradeId).state === "counter", "state back to counter");

// 4. commit fails when not both_locked
const ops = makeOps();
const failCommit = sys.commit(t1.tradeId, ops);
ok(failCommit.ok === false, "commit before both_locked rejected");

// 5. Full flow: alice offers sword (she has 1), bob offers 50 coin (he has 100)
const ops2 = makeOps();
ops2.addItem("alice", "sword", 1);
ops2.deposit("bob", "coin", 100);

const t2 = sys.open("alice", "bob", { items: [{ type: "sword", qty: 1 }], currency: [] });
sys.counter(t2.tradeId, "bob", { items: [], currency: [{ ccy: "coin", amount: 50 }] });
sys.lock(t2.tradeId, "alice");
sys.lock(t2.tradeId, "bob");
const com = sys.commit(t2.tradeId, ops2);
ok(com.ok === true, `commit ok (got ${com.reason || "ok"})`);
ok(ops2.countItem("alice", "sword") === 0, "alice no longer has sword");
ok(ops2.countItem("bob", "sword") === 1, "bob has sword");
ok(ops2.balance("alice", "coin") === 50, "alice has 50 coin");
ok(ops2.balance("bob", "coin") === 50, "bob has 50 coin");
ok(sys.get(t2.tradeId).state === "committed", "state = committed");

// Can't double-commit
const com2 = sys.commit(t2.tradeId, ops2);
ok(com2.ok === false && com2.reason === "state_committed", "double-commit rejected");

// 6. Insufficient inventory at commit time
const t3 = sys.open("a", "b", { items: [{ type: "ghost_item", qty: 5 }], currency: [] });
sys.counter(t3.tradeId, "b", { items: [], currency: [{ ccy: "coin", amount: 1 }] });
sys.lock(t3.tradeId, "a"); sys.lock(t3.tradeId, "b");
const opsEmpty = makeOps();
opsEmpty.deposit("b", "coin", 10);
const com3 = sys.commit(t3.tradeId, opsEmpty);
ok(com3.ok === false, "commit fails when from-side missing items");
ok(com3.reason.startsWith("from_missing"), `reason = from_missing:* (got ${com3.reason})`);

// 7. Cancel
const t4 = sys.open("a", "b", { items: [{ type: "x", qty: 1 }], currency: [] });
const cn = sys.cancel(t4.tradeId, "b", "no thanks");
ok(cn.ok === true, "cancel ok");
ok(sys.get(t4.tradeId).state === "canceled", "state canceled");
ok(sys.get(t4.tradeId).canceledReason === "no thanks", "reason recorded");

// Cancel committed → fail
const cn2 = sys.cancel(t2.tradeId, "alice");
ok(cn2.ok === false, "cancel committed rejected");

// Non-party cancel
const t5 = sys.open("a", "b", { items: [{ type: "x", qty: 1 }], currency: [] });
ok(sys.cancel(t5.tradeId, "carol").ok === false, "non-party cancel rejected");

// 8. unlock reverts both_locked → counter
const t6 = sys.open("a", "b", { items: [{ type: "x", qty: 1 }], currency: [] });
sys.counter(t6.tradeId, "b", { items: [], currency: [{ ccy: "c", amount: 1 }] });
sys.lock(t6.tradeId, "a"); sys.lock(t6.tradeId, "b");
ok(sys.get(t6.tradeId).state === "both_locked", "both_locked");
sys.unlock(t6.tradeId, "a");
ok(sys.get(t6.tradeId).state === "counter", "unlock returns to counter");
ok(sys.get(t6.tradeId).fromLocked === false, "fromLocked cleared");

// 9. reapTimeouts
const sys2 = T.createTradeSystem({ timeoutMs: 1000 });
const t7 = sys2.open("a", "b", { items: [{ type: "x", qty: 1 }], currency: [] });
const reaped0 = sys2.reapTimeouts(Date.now());
ok(reaped0.length === 0, "fresh trade not reaped");

const future = Date.now() + 2000;
const reaped1 = sys2.reapTimeouts(future);
ok(reaped1.includes(t7.tradeId), "old trade reaped");
ok(sys2.get(t7.tradeId).state === "canceled", "reaped → canceled");
ok(sys2.get(t7.tradeId).canceledReason === "timeout", "reason = timeout");

// 10. listActive excludes committed/canceled
const sys3 = T.createTradeSystem();
const ta = sys3.open("a", "b", { items: [{ type: "x", qty: 1 }], currency: [] });
const tb = sys3.open("c", "d", { items: [{ type: "y", qty: 1 }], currency: [] });
const tc = sys3.open("e", "f", { items: [{ type: "z", qty: 1 }], currency: [] });
sys3.cancel(ta.tradeId, "a");
ok(sys3.listActive().length === 2, "listActive excludes canceled");

// 11. counter from "from" side too
const t8 = sys.open("a", "b", { items: [{ type: "x", qty: 1 }], currency: [] });
const cFromA = sys.counter(t8.tradeId, "a", { items: [{ type: "y", qty: 1 }], currency: [] });
ok(cFromA.ok === true, "from-side can also re-offer");

// 12. lock/unlock/cancel for missing trade
ok(sys.lock("ghost", "a").ok === false, "lock on ghost rejected");
ok(sys.unlock("ghost", "a").ok === false, "unlock on ghost rejected");
ok(sys.cancel("ghost", "a").ok === false, "cancel on ghost rejected");
ok(sys.commit("ghost", ops2).ok === false, "commit on ghost rejected");
ok(sys.get("ghost") === null, "get ghost → null");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
