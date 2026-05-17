// trading_post.js — p2p item trades with escrow + counter-offers + disputes.
// Flow:
//   1. seller.createOffer({itemId, qty, askingCcy, askingAmount}) → offerId
//   2. buyer.makeBid(offerId, {ccy, amount})  OR  buyer.accept(offerId)
//   3. seller can accept/counter/reject the bid
//   4. on accept: escrow both sides; finish() releases when both confirm
//   5. dispute opens window where caller-supplied resolver decides
//
// Items are opaque tokens — caller's inventory bridge handles ownership.
// Currency moves via opts.economy.{withdraw, deposit}.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTATradingPost = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const STATES = ["open", "bidding", "escrowed", "finished", "cancelled", "disputed"];

  function createSystem(opts) {
    opts = opts || {};
    const config = Object.assign({
      maxOpenOffers: 1000,
      offerTtlMs: 7 * 24 * 60 * 60 * 1000,    // 1 week
      disputeWindowMs: 24 * 60 * 60 * 1000,    // 1 day after escrow
    }, opts.config || {});

    const offers = new Map();
    let nextOfferId = 1;
    const events = [];

    function _log(kind, detail) {
      events.push({ kind, detail, ts: Date.now() });
      if (events.length > 500) events.shift();
    }

    function createOffer(sellerId, opts2) {
      opts2 = opts2 || {};
      if (!sellerId || !opts2.itemId) return { ok: false, reason: "missing_fields" };
      if (typeof opts2.qty !== "number" || opts2.qty <= 0) return { ok: false, reason: "bad_qty" };
      if (typeof opts2.askingAmount !== "number" || opts2.askingAmount < 0) {
        return { ok: false, reason: "bad_amount" };
      }
      if (!opts2.askingCcy) return { ok: false, reason: "missing_ccy" };
      if (offers.size >= config.maxOpenOffers) return { ok: false, reason: "system_full" };
      const id = "offer_" + (nextOfferId++);
      const offer = {
        id, sellerId,
        itemId: opts2.itemId, qty: opts2.qty,
        askingCcy: opts2.askingCcy,
        askingAmount: opts2.askingAmount,
        state: "open",
        bids: [],
        acceptedBid: null,
        escrow: null,           // { sellerConfirmed, buyerConfirmed, sellerId, buyerId, item, ccy, amount }
        createdAt: Date.now(),
        expiresAt: Date.now() + (opts2.ttlMs || config.offerTtlMs),
        meta: Object.assign({}, opts2.meta || {}),
      };
      offers.set(id, offer);
      _log("create_offer", { id, sellerId, itemId: opts2.itemId, qty: opts2.qty });
      return { ok: true, id, offer };
    }

    function cancelOffer(offerId, byPlayerId) {
      const o = offers.get(offerId);
      if (!o) return { ok: false, reason: "missing" };
      if (o.sellerId !== byPlayerId) return { ok: false, reason: "not_seller" };
      if (o.state !== "open" && o.state !== "bidding") return { ok: false, reason: "not_cancellable" };
      o.state = "cancelled";
      _log("cancel", { id: offerId });
      return { ok: true };
    }

    function makeBid(offerId, buyerId, bid) {
      const o = offers.get(offerId);
      if (!o) return { ok: false, reason: "missing" };
      if (o.state !== "open" && o.state !== "bidding") return { ok: false, reason: "not_open" };
      if (o.sellerId === buyerId) return { ok: false, reason: "self_bid" };
      if (Date.now() > o.expiresAt) { o.state = "cancelled"; return { ok: false, reason: "expired" }; }
      if (!bid || !bid.ccy || typeof bid.amount !== "number" || bid.amount <= 0) {
        return { ok: false, reason: "bad_bid" };
      }
      const entry = { id: "bid_" + (o.bids.length + 1), buyerId, ccy: bid.ccy, amount: bid.amount, ts: Date.now() };
      o.bids.push(entry);
      o.state = "bidding";
      _log("bid", { offerId, buyerId, amount: bid.amount });
      return { ok: true, bidId: entry.id };
    }

    // Buyer accepts the asking price directly
    function acceptOffer(offerId, buyerId, opts2) {
      opts2 = opts2 || {};
      const o = offers.get(offerId);
      if (!o) return { ok: false, reason: "missing" };
      if (o.sellerId === buyerId) return { ok: false, reason: "self_buy" };
      if (o.state !== "open" && o.state !== "bidding") return { ok: false, reason: "not_open" };
      if (Date.now() > o.expiresAt) { o.state = "cancelled"; return { ok: false, reason: "expired" }; }
      return _openEscrow(o, buyerId, o.askingCcy, o.askingAmount, opts2);
    }

    // Seller accepts a specific bid
    function acceptBid(offerId, sellerId, bidId, opts2) {
      opts2 = opts2 || {};
      const o = offers.get(offerId);
      if (!o) return { ok: false, reason: "missing" };
      if (o.sellerId !== sellerId) return { ok: false, reason: "not_seller" };
      const bid = o.bids.find(b => b.id === bidId);
      if (!bid) return { ok: false, reason: "no_bid" };
      o.acceptedBid = bid;
      return _openEscrow(o, bid.buyerId, bid.ccy, bid.amount, opts2);
    }

    function _openEscrow(offer, buyerId, ccy, amount, opts2) {
      const econ = opts2.economy;
      if (econ && econ.withdraw) {
        const w = econ.withdraw(buyerId, ccy, amount);
        if (!w.ok) return { ok: false, reason: "insufficient_funds" };
      }
      const inv = opts2.inventory;
      if (inv && inv.holdItem) {
        const h = inv.holdItem(offer.sellerId, offer.itemId, offer.qty);
        if (!h.ok) {
          if (econ && econ.deposit) econ.deposit(buyerId, ccy, amount);   // refund
          return { ok: false, reason: "no_item" };
        }
      }
      offer.escrow = {
        sellerId: offer.sellerId, buyerId,
        itemId: offer.itemId, qty: offer.qty,
        ccy, amount,
        sellerConfirmed: false, buyerConfirmed: false,
        openedAt: Date.now(),
        disputeUntil: Date.now() + config.disputeWindowMs,
      };
      offer.state = "escrowed";
      _log("escrow", { offerId: offer.id, buyerId, ccy, amount });
      return { ok: true, offer };
    }

    function confirmTrade(offerId, playerId, opts2) {
      opts2 = opts2 || {};
      const o = offers.get(offerId);
      if (!o || !o.escrow) return { ok: false, reason: "no_escrow" };
      if (o.state === "disputed") return { ok: false, reason: "disputed" };
      const e = o.escrow;
      if (playerId === e.sellerId) e.sellerConfirmed = true;
      else if (playerId === e.buyerId) e.buyerConfirmed = true;
      else return { ok: false, reason: "not_participant" };
      _log("confirm", { offerId, playerId });
      if (e.sellerConfirmed && e.buyerConfirmed) {
        return _finish(o, opts2);
      }
      return { ok: true, awaiting: e.sellerConfirmed ? "buyer" : "seller" };
    }

    function _finish(offer, opts2) {
      const e = offer.escrow;
      const econ = opts2.economy;
      const inv = opts2.inventory;
      if (econ && econ.deposit) econ.deposit(e.sellerId, e.ccy, e.amount);
      if (inv && inv.transferHeld) inv.transferHeld(e.sellerId, e.buyerId, e.itemId, e.qty);
      offer.state = "finished";
      _log("finish", { offerId: offer.id });
      return { ok: true, state: "finished" };
    }

    function openDispute(offerId, playerId) {
      const o = offers.get(offerId);
      if (!o || !o.escrow) return { ok: false, reason: "no_escrow" };
      if (o.state !== "escrowed") return { ok: false, reason: "not_escrowed" };
      const e = o.escrow;
      if (playerId !== e.sellerId && playerId !== e.buyerId) {
        return { ok: false, reason: "not_participant" };
      }
      if (Date.now() > e.disputeUntil) return { ok: false, reason: "window_closed" };
      o.state = "disputed";
      _log("dispute", { offerId, playerId });
      return { ok: true };
    }

    // resolver(offer) → "buyer" | "seller" | "split"
    function resolveDispute(offerId, resolverFnOrChoice, opts2) {
      opts2 = opts2 || {};
      const o = offers.get(offerId);
      if (!o || o.state !== "disputed") return { ok: false, reason: "not_disputed" };
      const e = o.escrow;
      const choice = typeof resolverFnOrChoice === "function"
        ? resolverFnOrChoice(o)
        : resolverFnOrChoice;
      const econ = opts2.economy;
      const inv = opts2.inventory;
      if (choice === "buyer") {
        // Buyer wins: refund money, give item to buyer
        if (econ && econ.deposit) econ.deposit(e.buyerId, e.ccy, e.amount);
        if (inv && inv.transferHeld) inv.transferHeld(e.sellerId, e.buyerId, e.itemId, e.qty);
      } else if (choice === "seller") {
        // Seller wins: keep money, release item back to seller
        if (econ && econ.deposit) econ.deposit(e.sellerId, e.ccy, e.amount);
        if (inv && inv.releaseHeld) inv.releaseHeld(e.sellerId, e.itemId, e.qty);
      } else if (choice === "split") {
        // 50/50 refund + item back to seller
        const half = e.amount / 2;
        if (econ && econ.deposit) {
          econ.deposit(e.sellerId, e.ccy, half);
          econ.deposit(e.buyerId, e.ccy, e.amount - half);
        }
        if (inv && inv.releaseHeld) inv.releaseHeld(e.sellerId, e.itemId, e.qty);
      } else {
        return { ok: false, reason: "bad_choice" };
      }
      o.state = "finished";
      _log("resolve", { offerId, choice });
      return { ok: true, choice };
    }

    function getOffer(id) { return offers.get(id) || null; }
    function listOpen() {
      return Array.from(offers.values())
        .filter(o => o.state === "open" || o.state === "bidding");
    }
    function listAll() { return Array.from(offers.values()); }

    function listBy(predicate) {
      return Array.from(offers.values()).filter(predicate);
    }

    function expireOldOffers(now) {
      now = now != null ? now : Date.now();
      let n = 0;
      for (const o of offers.values()) {
        if ((o.state === "open" || o.state === "bidding") && now > o.expiresAt) {
          o.state = "cancelled"; n++;
        }
      }
      return n;
    }

    function recentEvents(n) { return events.slice(-(n || 50)); }

    return {
      STATES,
      createOffer, cancelOffer,
      makeBid, acceptOffer, acceptBid,
      confirmTrade,
      openDispute, resolveDispute,
      getOffer, listOpen, listAll, listBy,
      expireOldOffers, recentEvents,
    };
  }

  return { STATES, createSystem };
});
