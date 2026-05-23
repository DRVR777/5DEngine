// shop.js — buy/sell terminal. A shop is an entity with a `shop` facet:
//   shop: { stock: [{type, qty, price}], buybackRate, name, kind }
// Players bring "coin" to buy; shop pays coin × buybackRate to take items back.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTAShop = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function makeShop(opts) {
    opts = opts || {};
    return {
      name: opts.name || "Shop",
      kind: opts.kind || "general",
      stock: (opts.stock || []).map(s => ({ type: s.type, qty: s.qty, price: s.price })),
      buybackRate: opts.buybackRate != null ? opts.buybackRate : 0.5,
      currency: opts.currency || "coin",
    };
  }

  // Try to buy `qty` of `type`. Returns { ok, reason?, paid?, received? }.
  // invOps = { countItem, removeItem, addItem }.
  function buy(shop, inv, type, qty, invOps) {
    const stockEntry = shop.stock.find(s => s.type === type);
    if (!stockEntry) return { ok: false, reason: "not_in_stock" };
    if (stockEntry.qty < qty) return { ok: false, reason: "insufficient_stock" };
    const totalCost = stockEntry.price * qty;
    if (invOps.countItem(inv, shop.currency) < totalCost) {
      return { ok: false, reason: "insufficient_currency", needed: totalCost };
    }
    invOps.removeItem(inv, shop.currency, totalCost);
    const leftover = invOps.addItem(inv, type, qty);
    if (leftover > 0) {
      // refund
      invOps.addItem(inv, shop.currency, totalCost);
      return { ok: false, reason: "inventory_full" };
    }
    stockEntry.qty -= qty;
    return { ok: true, paid: totalCost, received: qty };
  }

  // Sell `qty` of `type` to the shop. Player gets price × buybackRate per unit.
  function sell(shop, inv, type, qty, invOps) {
    if (invOps.countItem(inv, type) < qty) {
      return { ok: false, reason: "insufficient_qty_to_sell" };
    }
    // Use the shop's listed price if known, else a default value table
    let basePrice = 1;
    const stockEntry = shop.stock.find(s => s.type === type);
    if (stockEntry) basePrice = stockEntry.price;
    const payout = Math.floor(basePrice * shop.buybackRate * qty);
    invOps.removeItem(inv, type, qty);
    const leftover = invOps.addItem(inv, shop.currency, payout);
    if (leftover > 0) {
      invOps.addItem(inv, type, qty);
      return { ok: false, reason: "inventory_full_for_payout" };
    }
    if (stockEntry) stockEntry.qty += qty;
    else shop.stock.push({ type, qty, price: basePrice });
    return { ok: true, received: payout };
  }

  // Restock — set qty (used for periodic refresh)
  function restock(shop, type, qty) {
    const e = shop.stock.find(s => s.type === type);
    if (e) e.qty = qty;
  }

  return { makeShop, buy, sell, restock };
});
