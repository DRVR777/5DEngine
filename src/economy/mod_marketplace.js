// mod_marketplace.js — paid mods + revenue split + payout queue.
// Sits on top of mod_loader + economy. Sellers list mods with prices,
// buyers purchase, marketplace takes a fee, sellers' payouts queue for
// settlement on a schedule.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTAModMarketplace = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function createMarketplace(opts) {
    opts = opts || {};
    const listings = new Map();      // modId → {modId, sellerId, price, ccy, manifestId, downloads, rating, listedAt}
    const purchases = new Map();     // buyerId → Set<modId>
    const payoutQueue = [];          // [{sellerId, amount, ccy, ts, source}]
    const reviews = new Map();       // modId → [{user, stars, comment, ts}]
    const platformFee = opts.platformFee != null ? opts.platformFee : 0.20;  // 20% default
    const events = [];               // last 200 audit

    function _log(kind, detail) {
      events.push({ kind, detail, ts: Date.now() });
      if (events.length > 200) events.shift();
    }

    function list(modId, def) {
      if (listings.has(modId)) return { ok: false, reason: "already_listed" };
      if (!def || !def.sellerId || typeof def.price !== "number" || def.price < 0) {
        return { ok: false, reason: "bad_listing" };
      }
      if (!def.ccy) return { ok: false, reason: "missing_currency" };
      listings.set(modId, {
        modId, sellerId: def.sellerId, price: def.price, ccy: def.ccy,
        manifestId: def.manifestId || null,
        name: def.name || modId,
        description: def.description || "",
        downloads: 0,
        rating: 0,
        listedAt: Date.now(),
      });
      _log("list", { modId, sellerId: def.sellerId, price: def.price });
      return { ok: true };
    }

    function unlist(modId, bySellerId) {
      const l = listings.get(modId);
      if (!l) return { ok: false, reason: "not_listed" };
      if (bySellerId && l.sellerId !== bySellerId) return { ok: false, reason: "not_seller" };
      listings.delete(modId);
      _log("unlist", { modId });
      return { ok: true };
    }

    function get(modId) { return listings.get(modId) || null; }
    function listAll() { return Array.from(listings.values()); }

    function search(query, opts2) {
      opts2 = opts2 || {};
      const q = (query || "").toLowerCase();
      let out = listAll();
      if (q) out = out.filter(l => (l.modId + " " + l.name + " " + l.description).toLowerCase().includes(q));
      if (opts2.maxPrice != null) out = out.filter(l => l.price <= opts2.maxPrice);
      if (opts2.ccy) out = out.filter(l => l.ccy === opts2.ccy);
      // Sort by downloads desc by default
      out.sort((a, b) => (b.downloads - a.downloads) || (b.rating - a.rating));
      return out;
    }

    // Purchase: charges the buyer, queues payout to seller minus fee.
    // economyOps: {balance(p, ccy), withdraw(p, ccy, amount), deposit(p, ccy, amount)}
    function purchase(buyerId, modId, economyOps) {
      const l = listings.get(modId);
      if (!l) return { ok: false, reason: "not_listed" };
      if (l.sellerId === buyerId) return { ok: false, reason: "self_purchase" };
      // Already owns?
      const owned = purchases.get(buyerId);
      if (owned && owned.has(modId)) return { ok: false, reason: "already_owned" };

      // Free mod → skip economy, instant ownership
      if (l.price === 0) {
        if (!purchases.has(buyerId)) purchases.set(buyerId, new Set());
        purchases.get(buyerId).add(modId);
        l.downloads++;
        _log("purchase_free", { modId, buyerId });
        return { ok: true, price: 0, fee: 0, sellerPayout: 0 };
      }

      // Paid mod
      if (!economyOps) return { ok: false, reason: "no_economy_ops" };
      if (economyOps.balance(buyerId, l.ccy) < l.price) {
        return { ok: false, reason: "insufficient_funds" };
      }

      const withdraw = economyOps.withdraw(buyerId, l.ccy, l.price);
      if (withdraw && withdraw.ok === false) {
        return { ok: false, reason: `withdraw_failed:${withdraw.reason}` };
      }
      const fee = Math.floor(l.price * platformFee * 100) / 100;
      const sellerNet = l.price - fee;
      payoutQueue.push({
        sellerId: l.sellerId,
        amount: sellerNet,
        ccy: l.ccy,
        ts: Date.now(),
        source: { modId, buyerId, gross: l.price, fee },
      });
      if (!purchases.has(buyerId)) purchases.set(buyerId, new Set());
      purchases.get(buyerId).add(modId);
      l.downloads++;
      _log("purchase", { modId, buyerId, price: l.price, fee, sellerNet });
      return { ok: true, price: l.price, fee, sellerPayout: sellerNet };
    }

    // Settle all pending payouts to sellers. Returns array of {sellerId,
    // ccy, totalPaid, count}.
    function settlePayouts(economyOps) {
      if (payoutQueue.length === 0) return [];
      const grouped = new Map();   // "seller::ccy" → {sellerId, ccy, total, count}
      for (const p of payoutQueue) {
        const k = `${p.sellerId}::${p.ccy}`;
        if (!grouped.has(k)) grouped.set(k, { sellerId: p.sellerId, ccy: p.ccy, total: 0, count: 0 });
        const g = grouped.get(k);
        g.total += p.amount;
        g.count++;
      }
      for (const g of grouped.values()) {
        if (g.total > 0 && economyOps) economyOps.deposit(g.sellerId, g.ccy, g.total);
      }
      payoutQueue.length = 0;
      _log("settle", { sellers: grouped.size });
      return Array.from(grouped.values()).map(g => ({
        sellerId: g.sellerId, ccy: g.ccy, totalPaid: g.total, count: g.count,
      }));
    }

    function ownedBy(buyerId) {
      const s = purchases.get(buyerId);
      return s ? Array.from(s) : [];
    }
    function owns(buyerId, modId) {
      const s = purchases.get(buyerId);
      return s ? s.has(modId) : false;
    }

    function review(modId, user, stars, comment) {
      const l = listings.get(modId);
      if (!l) return { ok: false, reason: "not_listed" };
      if (typeof stars !== "number" || stars < 1 || stars > 5) return { ok: false, reason: "bad_stars" };
      if (!purchases.get(user) || !purchases.get(user).has(modId)) {
        return { ok: false, reason: "not_owner" };
      }
      if (!reviews.has(modId)) reviews.set(modId, []);
      reviews.get(modId).push({ user, stars, comment, ts: Date.now() });
      const all = reviews.get(modId);
      l.rating = all.reduce((s, r) => s + r.stars, 0) / all.length;
      return { ok: true, newRating: l.rating };
    }

    function getReviews(modId) { return reviews.get(modId) || []; }
    function pendingPayouts() { return payoutQueue.slice(); }
    function recentEvents(n) { return events.slice(-(n || 50)); }

    return {
      listings, purchases, payoutQueue, reviews, platformFee, events,
      list, unlist, get, listAll, search,
      purchase, settlePayouts, ownedBy, owns,
      review, getReviews, pendingPayouts, recentEvents,
    };
  }

  return { createMarketplace };
});
