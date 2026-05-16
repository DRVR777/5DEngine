// photo_mode.js — in-game photo mode: capture, filter, tag, gallery.
// Captures a frame (caller supplies the pixel grab), applies a named
// color-filter (or stacked filter chain), tags it with EXIF-style
// metadata (camera pos, look dir, world, time-of-day, fov), and stores
// it in a gallery indexed by id. Gallery supports search by tag,
// reverse-chrono listing, favorites, and export-spec for sharing.
//
// Filters are pure pixel transforms (RGBA Uint8Array). We ship 8
// defaults and let users register more.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTAPhotoMode = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function _clamp(x, lo, hi) { return x < lo ? lo : x > hi ? hi : x; }
  function _toGray(r, g, b) { return 0.2126 * r + 0.7152 * g + 0.0722 * b; }

  // All filters take (pixels: Uint8Array RGBA, w, h) and mutate in place.
  const FILTERS = {
    none: function (p) { /* identity */ },
    grayscale: function (p) {
      for (let i = 0; i < p.length; i += 4) {
        const g = _toGray(p[i], p[i+1], p[i+2]) | 0;
        p[i] = p[i+1] = p[i+2] = g;
      }
    },
    sepia: function (p) {
      for (let i = 0; i < p.length; i += 4) {
        const r = p[i], g = p[i+1], b = p[i+2];
        p[i]   = _clamp((r*0.393 + g*0.769 + b*0.189) | 0, 0, 255);
        p[i+1] = _clamp((r*0.349 + g*0.686 + b*0.168) | 0, 0, 255);
        p[i+2] = _clamp((r*0.272 + g*0.534 + b*0.131) | 0, 0, 255);
      }
    },
    invert: function (p) {
      for (let i = 0; i < p.length; i += 4) {
        p[i]   = 255 - p[i];
        p[i+1] = 255 - p[i+1];
        p[i+2] = 255 - p[i+2];
      }
    },
    high_contrast: function (p) {
      for (let i = 0; i < p.length; i += 4) {
        for (let k = 0; k < 3; k++) {
          const v = p[i+k];
          p[i+k] = _clamp(((v - 128) * 1.5 + 128) | 0, 0, 255);
        }
      }
    },
    warm: function (p) {
      for (let i = 0; i < p.length; i += 4) {
        p[i]   = _clamp(p[i] + 20, 0, 255);
        p[i+2] = _clamp(p[i+2] - 15, 0, 255);
      }
    },
    cool: function (p) {
      for (let i = 0; i < p.length; i += 4) {
        p[i]   = _clamp(p[i] - 15, 0, 255);
        p[i+2] = _clamp(p[i+2] + 20, 0, 255);
      }
    },
    noir: function (p) {
      for (let i = 0; i < p.length; i += 4) {
        const g = _toGray(p[i], p[i+1], p[i+2]);
        const v = _clamp(((g - 128) * 1.8 + 100) | 0, 0, 255);
        p[i] = p[i+1] = p[i+2] = v;
      }
    },
    vibrant: function (p) {
      for (let i = 0; i < p.length; i += 4) {
        const g = _toGray(p[i], p[i+1], p[i+2]);
        for (let k = 0; k < 3; k++) {
          const v = p[i+k];
          p[i+k] = _clamp((v + (v - g) * 0.4) | 0, 0, 255);
        }
      }
    },
  };

  // Apply one or more filters in order. Returns the same pixel buffer.
  function applyFilters(pixels, w, h, names, customFilters) {
    const lookup = customFilters
      ? Object.assign({}, FILTERS, customFilters)
      : FILTERS;
    for (const n of names) {
      const fn = lookup[n];
      if (!fn) throw new Error("unknown filter: " + n);
      fn(pixels, w, h);
    }
    return pixels;
  }

  // Gallery
  function createGallery() {
    const photos = new Map();   // id → {id, ts, pixels, w, h, filters[], meta, tags[], favorite}
    let nextSeq = 1;
    const events = [];

    function _log(kind, detail) {
      events.push({ kind, detail, ts: Date.now() });
      if (events.length > 200) events.shift();
    }

    // Capture a photo. pixels is a Uint8Array (RGBA). meta is freeform.
    function capture(opts) {
      opts = opts || {};
      if (!opts.pixels) throw new Error("pixels required");
      if (!opts.w || !opts.h) throw new Error("w/h required");
      const id = "photo_" + nextSeq++;
      const filterNames = opts.filters || [];
      // Copy so caller's buffer isn't mutated
      const pixels = new Uint8Array(opts.pixels);
      if (filterNames.length) applyFilters(pixels, opts.w, opts.h, filterNames, opts.customFilters);
      const photo = {
        id, ts: opts.ts || Date.now(),
        pixels, w: opts.w, h: opts.h,
        filters: filterNames.slice(),
        meta: Object.assign({}, opts.meta || {}),
        tags: (opts.tags || []).slice(),
        favorite: false,
      };
      photos.set(id, photo);
      _log("capture", { id, w: opts.w, h: opts.h, filters: filterNames });
      return { ok: true, id, photo };
    }

    function get(id) { return photos.get(id) || null; }
    function remove(id) {
      if (!photos.has(id)) return { ok: false, reason: "not_found" };
      photos.delete(id);
      _log("delete", { id });
      return { ok: true };
    }

    function favorite(id, val) {
      const p = photos.get(id);
      if (!p) return { ok: false };
      p.favorite = val !== false;
      _log("favorite", { id, favorite: p.favorite });
      return { ok: true, favorite: p.favorite };
    }

    function tag(id, tags) {
      const p = photos.get(id);
      if (!p) return { ok: false };
      for (const t of tags) if (!p.tags.includes(t)) p.tags.push(t);
      return { ok: true, tags: p.tags };
    }

    function untag(id, tagName) {
      const p = photos.get(id);
      if (!p) return { ok: false };
      p.tags = p.tags.filter(t => t !== tagName);
      return { ok: true };
    }

    // Search: filter by {tag, world, favorite, since, before}, sort by
    // ts desc by default.
    function search(query) {
      query = query || {};
      let out = Array.from(photos.values());
      if (query.tag)      out = out.filter(p => p.tags.includes(query.tag));
      if (query.world)    out = out.filter(p => p.meta.world === query.world);
      if (query.favorite) out = out.filter(p => p.favorite);
      if (query.since)    out = out.filter(p => p.ts >= query.since);
      if (query.before)   out = out.filter(p => p.ts < query.before);
      out.sort((a, b) => b.ts - a.ts);
      if (query.limit)    out = out.slice(0, query.limit);
      return out;
    }

    function count() { return photos.size; }

    function exportSpec(id, format) {
      const p = photos.get(id);
      if (!p) return { ok: false, reason: "not_found" };
      format = format || "png";
      // Caller does the actual encoding; we ship the recipe.
      return {
        ok: true,
        id, format, w: p.w, h: p.h,
        filters: p.filters,
        meta: p.meta, tags: p.tags,
        favorite: p.favorite,
        sizeBytes: p.pixels.length,
      };
    }

    function recentEvents(n) { return events.slice(-(n || 50)); }

    return {
      capture, get, remove, favorite, tag, untag,
      search, count, exportSpec, recentEvents,
    };
  }

  return {
    FILTERS,
    applyFilters,
    createGallery,
  };
});
