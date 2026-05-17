// trade.js — peer-to-peer trade with escrow.
// Lifecycle:
//   open → counter → both_locked → committed (atomic swap)
//                   ↘ canceled (timeout/abort)
// Inventory + balance ops are dependency-injected so trade.js stays free
// of inventory/economy specifics.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTATrade = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const STATES = ["open", "counter", "both_locked", "committed", "canceled"];

  function createTradeSystem(opts) {
    opts = opts || {};
    const trades = new Map();
    let nextId = 1;
    const timeoutMs = opts.timeoutMs || 60000;

    function _id() { return `trade_${nextId++}`; }

    // Start an offer: A offers items to B.
    // offer = { items:[{type, qty}], currency:[{ccy, amount}] }
    function open(fromId, toId, offer) {
      if (!offer || (!offer.items?.length && !offer.currency?.length)) {
        return { ok: false, reason: "empty_offer" };
      }
      const id = _id();
      trades.set(id, {
        id,
        from: fromId,
        to: toId,
        fromOffer: offer,
        toOffer: null,
        state: "open",
        fromLocked: false,
        toLocked: false,
        createdAt: Date.now(),
        canceledReason: null,
      });
      return { ok: true, tradeId: id };
    }

    // Counter: B (or A) proposes their side.
    function counter(tradeId, byPlayer, offer) {
      const t = trades.get(tradeId);
      if (!t) return { ok: false, reason: "no_trade" };
      if (t.state === "committed" || t.state === "canceled") {
        return { ok: false, reason: `state_${t.state}` };
      }
      if (byPlayer !== t.to && byPlayer !== t.from) {
        return { ok: false, reason: "not_party" };
      }
      // Counter from "to" (most common) or counter-counter from "from"
      if (byPlayer === t.to) {
        t.toOffer = offer;
        t.state = "counter";
      } else {
        // From-side modifying their own offer
        t.fromOffer = offer;
        t.state = "counter";
      }
      // Any change resets locks (forces re-confirmation)
      t.fromLocked = false;
      t.toLocked = false;
      return { ok: true };
    }

    // Lock: a player signals they accept the current offer pair.
    function lock(tradeId, byPlayer) {
      const t = trades.get(tradeId);
      if (!t) return { ok: false, reason: "no_trade" };
      if (t.state === "committed" || t.state === "canceled") {
        return { ok: false, reason: `state_${t.state}` };
      }
      if (byPlayer === t.from) t.fromLocked = true;
      else if (byPlayer === t.to) t.toLocked = true;
      else return { ok: false, reason: "not_party" };
      if (t.fromLocked && t.toLocked) t.state = "both_locked";
      return { ok: true, fromLocked: t.fromLocked, toLocked: t.toLocked };
    }

    function unlock(tradeId, byPlayer) {
      const t = trades.get(tradeId);
      if (!t) return { ok: false, reason: "no_trade" };
      if (byPlayer === t.from) t.fromLocked = false;
      else if (byPlayer === t.to) t.toLocked = false;
      else return { ok: false, reason: "not_party" };
      if (t.state === "both_locked") t.state = "counter";
      return { ok: true };
    }

    // Commit the swap.  ops must implement:
    //   countItem(playerId, type), removeItem(playerId, type, qty),
    //   addItem(playerId, type, qty),
    //   balance(playerId, ccy), withdraw(playerId, ccy, amount),
    //   deposit(playerId, ccy, amount)
    function commit(tradeId, ops) {
      const t = trades.get(tradeId);
      if (!t) return { ok: false, reason: "no_trade" };
      if (t.state !== "both_locked") return { ok: false, reason: `state_${t.state}` };

      const fromInv = t.fromOffer.items || [];
      const toInv = (t.toOffer && t.toOffer.items) || [];
      const fromCcy = t.fromOffer.currency || [];
      const toCcy = (t.toOffer && t.toOffer.currency) || [];

      // Pre-validate: both sides have everything they're offering.
      for (const it of fromInv) {
        if (ops.countItem(t.from, it.type) < it.qty) return { ok: false, reason: `from_missing:${it.type}` };
      }
      for (const it of toInv) {
        if (ops.countItem(t.to, it.type) < it.qty) return { ok: false, reason: `to_missing:${it.type}` };
      }
      for (const c of fromCcy) {
        if (ops.balance(t.from, c.ccy) < c.amount) return { ok: false, reason: `from_short:${c.ccy}` };
      }
      for (const c of toCcy) {
        if (ops.balance(t.to, c.ccy) < c.amount) return { ok: false, reason: `to_short:${c.ccy}` };
      }

      // Atomic-ish swap: remove all, then add. If anything throws mid-add,
      // we attempt rollback by re-depositing pre-removal amounts.
      const removed = [];
      try {
        for (const it of fromInv) { ops.removeItem(t.from, it.type, it.qty); removed.push({ side: "from_inv", it }); }
        for (const it of toInv)   { ops.removeItem(t.to, it.type, it.qty);   removed.push({ side: "to_inv", it }); }
        for (const c of fromCcy)  { ops.withdraw(t.from, c.ccy, c.amount);   removed.push({ side: "from_ccy", c }); }
        for (const c of toCcy)    { ops.withdraw(t.to, c.ccy, c.amount);     removed.push({ side: "to_ccy", c }); }

        // Add to opposite parties
        for (const it of fromInv) ops.addItem(t.to, it.type, it.qty);
        for (const it of toInv)   ops.addItem(t.from, it.type, it.qty);
        for (const c of fromCcy)  ops.deposit(t.to, c.ccy, c.amount);
        for (const c of toCcy)    ops.deposit(t.from, c.ccy, c.amount);
      } catch (e) {
        // Best-effort rollback
        for (const r of removed) {
          if (r.side === "from_inv") ops.addItem(t.from, r.it.type, r.it.qty);
          else if (r.side === "to_inv") ops.addItem(t.to, r.it.type, r.it.qty);
          else if (r.side === "from_ccy") ops.deposit(t.from, r.c.ccy, r.c.amount);
          else if (r.side === "to_ccy") ops.deposit(t.to, r.c.ccy, r.c.amount);
        }
        return { ok: false, reason: `swap_failed:${e.message}`, rolledBack: true };
      }

      t.state = "committed";
      t.committedAt = Date.now();
      return { ok: true };
    }

    function cancel(tradeId, byPlayer, reason) {
      const t = trades.get(tradeId);
      if (!t) return { ok: false, reason: "no_trade" };
      if (t.state === "committed") return { ok: false, reason: "already_committed" };
      if (byPlayer && byPlayer !== t.from && byPlayer !== t.to) {
        return { ok: false, reason: "not_party" };
      }
      t.state = "canceled";
      t.canceledReason = reason || (byPlayer ? `aborted_by_${byPlayer}` : "unspecified");
      return { ok: true };
    }

    // Auto-cancel trades older than timeoutMs that haven't committed.
    function reapTimeouts(nowMs) {
      const now = nowMs != null ? nowMs : Date.now();
      const reaped = [];
      for (const [id, t] of trades) {
        if (t.state === "committed" || t.state === "canceled") continue;
        if (now - t.createdAt >= timeoutMs) {
          t.state = "canceled";
          t.canceledReason = "timeout";
          reaped.push(id);
        }
      }
      return reaped;
    }

    function get(tradeId) { return trades.get(tradeId) || null; }
    function listActive() {
      return Array.from(trades.values())
        .filter(t => t.state !== "committed" && t.state !== "canceled");
    }

    return {
      STATES, trades, timeoutMs,
      open, counter, lock, unlock, commit, cancel, reapTimeouts, get, listActive,
    };
  }

  return { createTradeSystem, STATES };
});
