// emote_wheel.js — 8-slot quick-select emote wheel with context palettes.
// Player holds a key → wheel opens → mouse direction selects 1 of 8 slots.
// Each slot binds an emote id (string). Contexts swap palettes (foot vs
// vehicle vs combat). Per-emote cooldown prevents spam.
//
// Distinct from emotes.js (iter 72) which is the registry/animation
// runner: this is the UI/selection layer that hands off to it.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTAEmoteWheel = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const SLOTS = 8;   // 8 cardinal slots
  // Slot indices, clockwise from N: 0=N, 1=NE, 2=E, 3=SE, 4=S, 5=SW, 6=W, 7=NW

  function _slotFromAngle(rad) {
    // 0=N (up = -π/2 in screen coords, but we'll use 0=up convention here)
    // Map [0, 2π) → 0..7
    const TWO_PI = Math.PI * 2;
    let a = rad % TWO_PI;
    if (a < 0) a += TWO_PI;
    const slotSize = TWO_PI / SLOTS;
    return Math.floor((a + slotSize / 2) / slotSize) % SLOTS;
  }

  function _slotFromVector(dx, dy) {
    if (dx === 0 && dy === 0) return null;
    // Standard math: angle from +X axis, CCW. Map so 0=N.
    // We want 0=N (up), so use atan2(dx, -dy)
    const angle = Math.atan2(dx, -dy);
    return _slotFromAngle(angle);
  }

  function createWheel(opts) {
    opts = opts || {};
    const config = Object.assign({
      defaultCooldownMs: 2000,
      slots: SLOTS,
    }, opts.config || {});

    const palettes = new Map();    // contextName → [emoteId, ...] (length 8)
    const cooldowns = new Map();   // playerId+emoteId → lastUsedTs
    const wheelStates = new Map(); // playerId → {open, context, openedAt}
    const events = [];

    function _log(kind, detail) {
      events.push({ kind, detail, ts: Date.now() });
      if (events.length > 500) events.shift();
    }

    function registerPalette(contextName, slots) {
      if (typeof contextName !== "string" || !contextName) return { ok: false };
      if (!Array.isArray(slots)) return { ok: false, reason: "bad_slots" };
      if (slots.length !== SLOTS) return { ok: false, reason: "must_be_8" };
      palettes.set(contextName, slots.slice());
      _log("palette", { contextName });
      return { ok: true };
    }

    function unregisterPalette(name) { return palettes.delete(name); }
    function getPalette(name) { return palettes.get(name) ? palettes.get(name).slice() : null; }
    function listPalettes() { return Array.from(palettes.keys()); }

    function openWheel(playerId, context, opts2) {
      opts2 = opts2 || {};
      if (!palettes.has(context)) return { ok: false, reason: "no_palette" };
      wheelStates.set(playerId, {
        open: true, context,
        openedAt: opts2.now != null ? opts2.now : Date.now(),
      });
      _log("open", { playerId, context });
      return { ok: true, palette: palettes.get(context).slice() };
    }

    function closeWheel(playerId) {
      const w = wheelStates.get(playerId);
      if (!w || !w.open) return { ok: false };
      w.open = false;
      _log("close", { playerId });
      return { ok: true };
    }

    function isOpen(playerId) {
      const w = wheelStates.get(playerId);
      return !!(w && w.open);
    }

    // selectByAngle(playerId, angle) — angle in radians, 0=N
    function selectByAngle(playerId, angle, opts2) {
      opts2 = opts2 || {};
      const w = wheelStates.get(playerId);
      if (!w || !w.open) return { ok: false, reason: "wheel_closed" };
      const slot = _slotFromAngle(angle);
      return _selectSlot(playerId, w.context, slot, opts2);
    }

    function selectByVector(playerId, dx, dy, opts2) {
      opts2 = opts2 || {};
      const slot = _slotFromVector(dx, dy);
      if (slot === null) return { ok: false, reason: "zero_vector" };
      const w = wheelStates.get(playerId);
      if (!w || !w.open) return { ok: false, reason: "wheel_closed" };
      return _selectSlot(playerId, w.context, slot, opts2);
    }

    function selectByIndex(playerId, idx, opts2) {
      opts2 = opts2 || {};
      if (idx < 0 || idx >= SLOTS) return { ok: false, reason: "bad_index" };
      const w = wheelStates.get(playerId);
      if (!w || !w.open) return { ok: false, reason: "wheel_closed" };
      return _selectSlot(playerId, w.context, idx, opts2);
    }

    function _selectSlot(playerId, context, slot, opts2) {
      const palette = palettes.get(context);
      const emoteId = palette[slot];
      if (!emoteId) return { ok: false, reason: "empty_slot" };
      const cdKey = playerId + "::" + emoteId;
      const now = opts2.now != null ? opts2.now : Date.now();
      const cdMs = opts2.cooldownMs != null ? opts2.cooldownMs : config.defaultCooldownMs;
      if (cooldowns.has(cdKey)) {
        const lastUsed = cooldowns.get(cdKey);
        if (now - lastUsed < cdMs) {
          return { ok: false, reason: "on_cooldown", remainingMs: cdMs - (now - lastUsed) };
        }
      }
      cooldowns.set(cdKey, now);
      // Close wheel after selection
      const w = wheelStates.get(playerId);
      if (w) w.open = false;
      _log("select", { playerId, emoteId, slot, context });
      return { ok: true, emoteId, slot, context };
    }

    function cooldownRemaining(playerId, emoteId, opts2) {
      opts2 = opts2 || {};
      const now = opts2.now != null ? opts2.now : Date.now();
      const lastUsed = cooldowns.get(playerId + "::" + emoteId) || 0;
      const cdMs = opts2.cooldownMs != null ? opts2.cooldownMs : config.defaultCooldownMs;
      return Math.max(0, cdMs - (now - lastUsed));
    }

    function recentEvents(n) { return events.slice(-(n || 50)); }
    function getConfig() { return Object.assign({}, config); }

    return {
      SLOTS,
      registerPalette, unregisterPalette, getPalette, listPalettes,
      openWheel, closeWheel, isOpen,
      selectByAngle, selectByVector, selectByIndex,
      cooldownRemaining,
      recentEvents, getConfig,
      _slotFromAngle, _slotFromVector,
    };
  }

  return { SLOTS, createWheel };
});
