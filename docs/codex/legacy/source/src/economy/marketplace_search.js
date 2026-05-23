// marketplace_search.js — query/filter/sort across marketplace listings.
// A "marketplace" here is any catalog of items: trading_post offers,
// mod_marketplace listings, shop inventory, etc. This module provides
// the query DSL on top of a normalized listing shape:
//
//   listing = { id, name, tags[], category, price, ccy, sellerId,
//               rating, downloads, createdAt, meta }
//
// Adapters (the caller's job) bridge from each catalog's native shape
// to this normalized one.
//
// Query: {
//   text:     "fuzzy match on name + tags",
//   tags:     ["t1","t2"],      // must include ALL
//   anyTags:  ["t3","t4"],      // must include AT LEAST ONE
//   category: "weapon",
//   minPrice: 10, maxPrice: 1000,
//   ccy:      "coin",
//   sellerId: "alice",
//   minRating: 4,
//   facetsOf: ["category","ccy","tags"],   // returns per-field counts
// }
// Sort: { by: "price"|"rating"|"downloads"|"createdAt"|"name", dir: "asc"|"desc" }
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTAMarketplaceSearch = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function _normalizeListing(raw) {
    return {
      id: raw.id,
      name: raw.name || "",
      tags: Array.isArray(raw.tags) ? raw.tags.slice() : [],
      category: raw.category || null,
      price: raw.price != null ? raw.price : 0,
      ccy: raw.ccy || "coin",
      sellerId: raw.sellerId || null,
      rating: raw.rating != null ? raw.rating : 0,
      downloads: raw.downloads || 0,
      createdAt: raw.createdAt || 0,
      meta: raw.meta || {},
    };
  }

  function _textMatch(listing, text) {
    if (!text) return true;
    const lc = text.toLowerCase();
    if (listing.name.toLowerCase().includes(lc)) return true;
    for (const t of listing.tags) {
      if (t.toLowerCase().includes(lc)) return true;
    }
    return false;
  }

  function _matches(listing, query) {
    if (query.text != null && !_textMatch(listing, query.text)) return false;
    if (query.category && listing.category !== query.category) return false;
    if (query.minPrice != null && listing.price < query.minPrice) return false;
    if (query.maxPrice != null && listing.price > query.maxPrice) return false;
    if (query.ccy && listing.ccy !== query.ccy) return false;
    if (query.sellerId && listing.sellerId !== query.sellerId) return false;
    if (query.minRating != null && listing.rating < query.minRating) return false;
    if (Array.isArray(query.tags)) {
      for (const t of query.tags) {
        if (!listing.tags.includes(t)) return false;
      }
    }
    if (Array.isArray(query.anyTags) && query.anyTags.length > 0) {
      let ok = false;
      for (const t of query.anyTags) {
        if (listing.tags.includes(t)) { ok = true; break; }
      }
      if (!ok) return false;
    }
    return true;
  }

  function _cmp(a, b, dir) {
    if (a < b) return dir === "desc" ? 1 : -1;
    if (a > b) return dir === "desc" ? -1 : 1;
    return 0;
  }

  function _sort(results, sortSpec) {
    if (!sortSpec || !sortSpec.by) return results;
    const by = sortSpec.by;
    const dir = sortSpec.dir || "asc";
    return results.slice().sort((a, b) => _cmp(a[by], b[by], dir));
  }

  function _facets(results, fields) {
    const out = {};
    for (const f of fields) {
      out[f] = {};
      for (const r of results) {
        const v = r[f];
        if (Array.isArray(v)) {
          for (const x of v) out[f][x] = (out[f][x] || 0) + 1;
        } else if (v != null) {
          const key = String(v);
          out[f][key] = (out[f][key] || 0) + 1;
        }
      }
    }
    return out;
  }

  function createIndex(opts) {
    opts = opts || {};
    const listings = new Map();   // id → normalized

    function addListing(raw) {
      if (!raw || !raw.id) return { ok: false, reason: "missing_id" };
      const n = _normalizeListing(raw);
      listings.set(n.id, n);
      return { ok: true };
    }

    function addAll(rawList) {
      let n = 0;
      for (const r of (rawList || [])) {
        if (addListing(r).ok) n++;
      }
      return n;
    }

    function removeListing(id) {
      return listings.delete(id);
    }

    function clear() { listings.clear(); }

    function size() { return listings.size; }

    function search(query, sortSpec, opts2) {
      query = query || {};
      opts2 = opts2 || {};
      const limit = opts2.limit != null ? opts2.limit : 100;
      const offset = opts2.offset || 0;

      let results = [];
      for (const l of listings.values()) {
        if (_matches(l, query)) results.push(l);
      }
      results = _sort(results, sortSpec);
      const total = results.length;
      const page = results.slice(offset, offset + limit);

      const out = { total, page, offset, limit };
      if (Array.isArray(query.facetsOf) && query.facetsOf.length > 0) {
        out.facets = _facets(results, query.facetsOf);
      }
      return out;
    }

    function getListing(id) { return listings.get(id) || null; }
    function listAll() { return Array.from(listings.values()); }

    return {
      addListing, addAll, removeListing, clear, size,
      search, getListing, listAll,
    };
  }

  // Adapters
  function fromTradingPostOffer(offer) {
    return {
      id: offer.id,
      name: offer.itemId,
      tags: [offer.itemId, "trade"],
      category: "trade_offer",
      price: offer.askingAmount,
      ccy: offer.askingCcy,
      sellerId: offer.sellerId,
      rating: 0,
      downloads: 0,
      createdAt: offer.createdAt,
      meta: { qty: offer.qty, state: offer.state },
    };
  }

  function fromModListing(mod) {
    return {
      id: mod.id || mod.modId,
      name: mod.name || mod.id,
      tags: mod.tags || [],
      category: "mod",
      price: mod.price,
      ccy: mod.ccy,
      sellerId: mod.sellerId,
      rating: mod.rating || 0,
      downloads: mod.downloads || 0,
      createdAt: mod.createdAt || mod.listedAt || 0,
      meta: { reviews: mod.reviews || 0 },
    };
  }

  function fromShopItem(item) {
    return {
      id: item.id,
      name: item.name || item.id,
      tags: item.tags || [item.category],
      category: item.category || "shop",
      price: item.price,
      ccy: item.ccy || "coin",
      sellerId: "shop",
      rating: 0,
      downloads: 0,
      createdAt: item.addedAt || 0,
      meta: { stock: item.stock != null ? item.stock : 1 },
    };
  }

  return {
    createIndex,
    fromTradingPostOffer, fromModListing, fromShopItem,
  };
});
