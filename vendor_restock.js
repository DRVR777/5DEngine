// vendor_restock.js — shop inventory replenishment + dynamic pricing.
// Each vendor stocks items at baseStock with a basePrice. Buyers
// reduce stock; restock cycle (tick) refills toward baseStock at
// restockRate per second. Prices flex with supply: low stock raises
// price (scarcity premium); overstocked drops price (clearance).
//
// Dynamic price = basePrice × (1 + sensitivity × (1 - stock/baseStock))
// Clamped to [minPriceFactor, maxPriceFactor] × basePrice.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTAVendorRestock = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function _clamp(x, lo, hi) { return x < lo ? lo : x > hi ? hi : x; }

  function createSystem(opts) {
    opts = opts || {};
    const config = Object.assign({
      restockRatePerSec: 0.05,       // items/sec toward baseStock
      sensitivity: 1.0,              // price-vs-supply elasticity
      minPriceFactor: 0.5,
      maxPriceFactor: 3.0,
      restockMode: "linear",         // "linear" | "exponential"
    }, opts.config || {});

    const vendors = new Map();       // vendorId → {id, items:Map<itemId, slot>}
    const events = [];

    function _log(kind, detail) {
      events.push({ kind, detail, ts: Date.now() });
      if (events.length > 500) events.shift();
    }

    function registerVendor(opts2) {
      opts2 = opts2 || {};
      if (!opts2.id) return { ok: false, reason: "missing_id" };
      if (vendors.has(opts2.id)) return { ok: false, reason: "duplicate" };
      vendors.set(opts2.id, {
        id: opts2.id,
        name: opts2.name || opts2.id,
        items: new Map(),
        meta: opts2.meta || {},
      });
      _log("register_vendor", { id: opts2.id });
      return { ok: true };
    }

    function unregisterVendor(id) { return vendors.delete(id); }

    // Add or update an item slot on a vendor
    function setItem(vendorId, opts2) {
      opts2 = opts2 || {};
      const v = vendors.get(vendorId);
      if (!v) return { ok: false, reason: "no_vendor" };
      if (!opts2.itemId) return { ok: false, reason: "missing_item" };
      if (typeof opts2.basePrice !== "number" || opts2.basePrice < 0) {
        return { ok: false, reason: "bad_price" };
      }
      const baseStock = typeof opts2.baseStock === "number" ? opts2.baseStock : 10;
      v.items.set(opts2.itemId, {
        itemId: opts2.itemId,
        basePrice: opts2.basePrice,
        baseStock,
        currentStock: opts2.currentStock != null ? opts2.currentStock : baseStock,
        ccy: opts2.ccy || "coin",
        lastRestockTs: 0,
        soldTotal: 0,
        meta: opts2.meta || {},
      });
      _log("set_item", { vendorId, itemId: opts2.itemId, basePrice: opts2.basePrice });
      return { ok: true };
    }

    function removeItem(vendorId, itemId) {
      const v = vendors.get(vendorId);
      if (!v) return false;
      return v.items.delete(itemId);
    }

    // Current price: dynamic by stock ratio
    function priceOf(vendorId, itemId) {
      const v = vendors.get(vendorId);
      if (!v) return null;
      const slot = v.items.get(itemId);
      if (!slot) return null;
      const ratio = slot.baseStock > 0 ? slot.currentStock / slot.baseStock : 1;
      const mul = 1 + config.sensitivity * (1 - ratio);
      const factor = _clamp(mul, config.minPriceFactor, config.maxPriceFactor);
      return Math.round(slot.basePrice * factor * 100) / 100;
    }

    function stockOf(vendorId, itemId) {
      const v = vendors.get(vendorId);
      if (!v) return 0;
      const slot = v.items.get(itemId);
      return slot ? slot.currentStock : 0;
    }

    // Buy from vendor — reduces stock, returns cost
    function buy(vendorId, itemId, quantity, opts2) {
      opts2 = opts2 || {};
      const v = vendors.get(vendorId);
      if (!v) return { ok: false, reason: "no_vendor" };
      const slot = v.items.get(itemId);
      if (!slot) return { ok: false, reason: "no_item" };
      if (typeof quantity !== "number" || quantity <= 0) {
        return { ok: false, reason: "bad_quantity" };
      }
      if (slot.currentStock < quantity) return { ok: false, reason: "insufficient_stock" };
      const unitPrice = priceOf(vendorId, itemId);
      const cost = unitPrice * quantity;
      if (opts2.economy && opts2.economy.withdraw && opts2.buyerId) {
        const w = opts2.economy.withdraw(opts2.buyerId, slot.ccy, cost);
        if (!w.ok) return { ok: false, reason: "insufficient_funds" };
      }
      slot.currentStock -= quantity;
      slot.soldTotal += quantity;
      _log("sale", { vendorId, itemId, quantity, unitPrice, cost });
      return {
        ok: true,
        quantity, unitPrice, totalCost: cost,
        remainingStock: slot.currentStock,
      };
    }

    // Sell back to vendor (caller-driven)
    function sellBack(vendorId, itemId, quantity, opts2) {
      opts2 = opts2 || {};
      const v = vendors.get(vendorId);
      if (!v) return { ok: false, reason: "no_vendor" };
      const slot = v.items.get(itemId);
      if (!slot) return { ok: false, reason: "no_item" };
      if (typeof quantity !== "number" || quantity <= 0) {
        return { ok: false, reason: "bad_quantity" };
      }
      const sellbackRate = opts2.rate != null ? opts2.rate : 0.5;
      const unitPrice = priceOf(vendorId, itemId) * sellbackRate;
      const paid = unitPrice * quantity;
      if (opts2.economy && opts2.economy.deposit && opts2.sellerId) {
        opts2.economy.deposit(opts2.sellerId, slot.ccy, paid);
      }
      slot.currentStock += quantity;
      _log("sellback", { vendorId, itemId, quantity, unitPrice, paid });
      return {
        ok: true, quantity, unitPrice, totalPaid: paid,
        newStock: slot.currentStock,
      };
    }

    // Restock tick — moves currentStock toward baseStock
    function tick(dt, opts2) {
      opts2 = opts2 || {};
      const now = opts2.now != null ? opts2.now : Date.now();
      let restocked = 0;
      for (const v of vendors.values()) {
        for (const slot of v.items.values()) {
          if (slot.currentStock >= slot.baseStock) continue;
          let inc;
          if (config.restockMode === "exponential") {
            inc = (slot.baseStock - slot.currentStock) * config.restockRatePerSec * dt;
          } else {
            inc = config.restockRatePerSec * dt * slot.baseStock;
          }
          const before = slot.currentStock;
          slot.currentStock = Math.min(slot.baseStock, slot.currentStock + inc);
          slot.lastRestockTs = now;
          if (slot.currentStock > before) restocked++;
        }
      }
      return { restocked };
    }

    function vendorInventory(vendorId) {
      const v = vendors.get(vendorId);
      if (!v) return null;
      const items = [];
      for (const slot of v.items.values()) {
        items.push({
          itemId: slot.itemId,
          basePrice: slot.basePrice,
          currentPrice: priceOf(vendorId, slot.itemId),
          stock: slot.currentStock,
          baseStock: slot.baseStock,
          ccy: slot.ccy,
          soldTotal: slot.soldTotal,
        });
      }
      return items;
    }

    function listVendors() { return Array.from(vendors.values()); }
    function recentEvents(n) { return events.slice(-(n || 50)); }
    function getConfig() { return Object.assign({}, config); }

    return {
      registerVendor, unregisterVendor, setItem, removeItem,
      priceOf, stockOf,
      buy, sellBack, tick,
      vendorInventory, listVendors,
      recentEvents, getConfig,
    };
  }

  return { createSystem };
});
