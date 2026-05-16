// housing.js — player-buyable real estate + rent + storage + decor.
// Properties are pre-listed: {id, price, rentPerDay, capacity, location}.
// Players buy (one-time cost) or rent (recurring). Each property has
// a storage container (item bag) and decoration slots (purely cosmetic
// catalog of placed decor items).
//
// Rent collection: caller ticks per-day; tenants are auto-billed.
// Missed payments accrue; after N misses, eviction.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTAHousing = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const STATES = ["listed", "owned", "rented", "vacant"];

  function createSystem(opts) {
    opts = opts || {};
    const config = Object.assign({
      defaultStorageCapacity: 100,
      decorationSlots: 20,
      rentGraceDays: 2,
      evictAfterMissedN: 3,
    }, opts.config || {});

    const properties = new Map();
    const events = [];

    function _log(kind, detail) {
      events.push({ kind, detail, ts: Date.now() });
      if (events.length > 500) events.shift();
    }

    function listProperty(opts2) {
      opts2 = opts2 || {};
      if (!opts2.id) return { ok: false, reason: "missing_id" };
      if (properties.has(opts2.id)) return { ok: false, reason: "duplicate" };
      if (typeof opts2.price !== "number" || opts2.price <= 0) {
        return { ok: false, reason: "bad_price" };
      }
      const p = {
        id: opts2.id,
        name: opts2.name || opts2.id,
        location: opts2.location || null,
        price: opts2.price,
        rentPerDay: opts2.rentPerDay || Math.round(opts2.price * 0.0005),
        ccy: opts2.ccy || "coin",
        capacity: opts2.capacity || config.defaultStorageCapacity,
        decorationSlots: opts2.decorationSlots || config.decorationSlots,
        owner: null,
        tenant: null,
        storage: new Map(),         // itemId → qty
        decorations: [],            // [{id, name, slot}]
        state: "listed",
        rentMissed: 0,
        lastRentDay: 0,
        listedAt: Date.now(),
      };
      properties.set(opts2.id, p);
      _log("list", { id: opts2.id, price: p.price });
      return { ok: true };
    }

    function unlist(id) { return properties.delete(id); }

    function getProperty(id) { return properties.get(id) || null; }
    function listProperties(filter) {
      const out = [];
      for (const p of properties.values()) {
        if (filter && p.state !== filter) continue;
        out.push(p);
      }
      return out;
    }

    function buy(propertyId, playerId, opts2) {
      opts2 = opts2 || {};
      const p = properties.get(propertyId);
      if (!p) return { ok: false, reason: "no_property" };
      if (p.state === "owned") return { ok: false, reason: "already_owned" };
      if (p.tenant) return { ok: false, reason: "tenant_present" };
      if (opts2.economy && opts2.economy.withdraw) {
        const w = opts2.economy.withdraw(playerId, p.ccy, p.price);
        if (!w.ok) return { ok: false, reason: "insufficient_funds" };
      }
      p.owner = playerId;
      p.state = "owned";
      _log("bought", { propertyId, playerId, price: p.price });
      return { ok: true, propertyId, paid: p.price };
    }

    function sell(propertyId, ownerId, opts2) {
      opts2 = opts2 || {};
      const p = properties.get(propertyId);
      if (!p) return { ok: false, reason: "no_property" };
      if (p.owner !== ownerId) return { ok: false, reason: "not_owner" };
      const refundRate = opts2.refundRate != null ? opts2.refundRate : 0.7;
      const refund = p.price * refundRate;
      if (opts2.economy && opts2.economy.deposit) {
        opts2.economy.deposit(ownerId, p.ccy, refund);
      }
      p.owner = null;
      p.tenant = null;
      p.state = "listed";
      p.rentMissed = 0;
      _log("sold", { propertyId, ownerId, refund });
      return { ok: true, refund };
    }

    function rent(propertyId, playerId, opts2) {
      opts2 = opts2 || {};
      const p = properties.get(propertyId);
      if (!p) return { ok: false, reason: "no_property" };
      if (!p.owner) return { ok: false, reason: "no_owner" };
      if (p.tenant) return { ok: false, reason: "already_rented" };
      if (p.tenant === playerId) return { ok: false, reason: "self_rent" };
      // Pay first month
      const firstRent = p.rentPerDay * 30;
      if (opts2.economy && opts2.economy.withdraw) {
        const w = opts2.economy.withdraw(playerId, p.ccy, firstRent);
        if (!w.ok) return { ok: false, reason: "insufficient_funds" };
        if (opts2.economy.deposit) opts2.economy.deposit(p.owner, p.ccy, firstRent);
      }
      p.tenant = playerId;
      p.state = "rented";
      p.lastRentDay = opts2.day != null ? opts2.day : 0;
      p.rentMissed = 0;
      _log("rented", { propertyId, tenant: playerId, ownerId: p.owner });
      return { ok: true, firstPayment: firstRent };
    }

    function moveOut(propertyId, playerId) {
      const p = properties.get(propertyId);
      if (!p) return { ok: false, reason: "no_property" };
      if (p.tenant !== playerId) return { ok: false, reason: "not_tenant" };
      p.tenant = null;
      p.state = "owned";
      p.rentMissed = 0;
      _log("moved_out", { propertyId, tenant: playerId });
      return { ok: true };
    }

    // Tick rent collection — each property's tenant gets billed if a day has passed
    function tickRent(currentDay, opts2) {
      opts2 = opts2 || {};
      const events_ = [];
      for (const p of properties.values()) {
        if (p.state !== "rented" || !p.tenant) continue;
        const daysSince = currentDay - p.lastRentDay;
        if (daysSince <= 0) continue;
        const rentDue = p.rentPerDay * daysSince;
        if (opts2.economy && opts2.economy.withdraw) {
          const w = opts2.economy.withdraw(p.tenant, p.ccy, rentDue);
          if (w.ok) {
            if (opts2.economy.deposit) opts2.economy.deposit(p.owner, p.ccy, rentDue);
            p.lastRentDay = currentDay;
            p.rentMissed = 0;
            events_.push({ kind: "paid", propertyId: p.id, amount: rentDue });
          } else {
            p.rentMissed++;
            events_.push({ kind: "missed", propertyId: p.id, missed: p.rentMissed });
            if (p.rentMissed >= config.evictAfterMissedN) {
              const evicted = p.tenant;
              p.tenant = null;
              p.state = "owned";
              p.rentMissed = 0;
              events_.push({ kind: "evicted", propertyId: p.id, tenant: evicted });
            }
          }
        }
      }
      _log("tick_rent", { day: currentDay, events: events_.length });
      return events_;
    }

    // Storage operations (only by owner/tenant)
    function storeItem(propertyId, playerId, itemId, qty) {
      const p = properties.get(propertyId);
      if (!p) return { ok: false, reason: "no_property" };
      if (p.owner !== playerId && p.tenant !== playerId) {
        return { ok: false, reason: "no_access" };
      }
      const cur = p.storage.get(itemId) || 0;
      const usedTotal = Array.from(p.storage.values()).reduce((s, n) => s + n, 0);
      if (usedTotal + qty > p.capacity) return { ok: false, reason: "no_capacity" };
      p.storage.set(itemId, cur + qty);
      _log("store", { propertyId, itemId, qty });
      return { ok: true, newQty: cur + qty };
    }

    function takeItem(propertyId, playerId, itemId, qty) {
      const p = properties.get(propertyId);
      if (!p) return { ok: false, reason: "no_property" };
      if (p.owner !== playerId && p.tenant !== playerId) {
        return { ok: false, reason: "no_access" };
      }
      const cur = p.storage.get(itemId) || 0;
      if (cur < qty) return { ok: false, reason: "insufficient" };
      p.storage.set(itemId, cur - qty);
      if (cur - qty === 0) p.storage.delete(itemId);
      _log("take", { propertyId, itemId, qty });
      return { ok: true, remaining: cur - qty };
    }

    function storageContents(propertyId) {
      const p = properties.get(propertyId);
      if (!p) return null;
      return Object.fromEntries(p.storage);
    }

    // Decorations (cosmetic only)
    function placeDecoration(propertyId, playerId, decor) {
      const p = properties.get(propertyId);
      if (!p) return { ok: false, reason: "no_property" };
      if (p.owner !== playerId) return { ok: false, reason: "not_owner" };
      if (!decor || !decor.id) return { ok: false, reason: "bad_decor" };
      if (p.decorations.length >= p.decorationSlots) {
        return { ok: false, reason: "no_slots" };
      }
      p.decorations.push({ id: decor.id, name: decor.name || decor.id, slot: p.decorations.length });
      _log("decorated", { propertyId, decor: decor.id });
      return { ok: true };
    }

    function removeDecoration(propertyId, playerId, slot) {
      const p = properties.get(propertyId);
      if (!p) return { ok: false, reason: "no_property" };
      if (p.owner !== playerId) return { ok: false, reason: "not_owner" };
      if (slot < 0 || slot >= p.decorations.length) return { ok: false };
      p.decorations.splice(slot, 1);
      // Re-slot
      p.decorations.forEach((d, i) => { d.slot = i; });
      return { ok: true };
    }

    function decorationsOf(propertyId) {
      const p = properties.get(propertyId);
      return p ? p.decorations.slice() : null;
    }

    function recentEvents(n) { return events.slice(-(n || 50)); }

    return {
      STATES,
      listProperty, unlist, getProperty, listProperties,
      buy, sell, rent, moveOut, tickRent,
      storeItem, takeItem, storageContents,
      placeDecoration, removeDecoration, decorationsOf,
      recentEvents,
    };
  }

  return { STATES, createSystem };
});
