// character.js — character customization (slot-based).
// Slots: skinTone, hairStyle, hairColor, top, bottom, shoes, hat, accessory.
// Each slot has a registered set of options. Adding a new option is data.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTACharacter = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Built-in slots + their default options. Each option = {id, color?, mesh?, meta?}
  const SLOTS = {
    skinTone:   { default: "tan",    options: { pale: { color: 0xfbe7c6 }, tan: { color: 0xd4a373 }, brown: { color: 0x8b5a2b }, dark: { color: 0x3e2723 } } },
    hairStyle:  { default: "short",  options: { bald: {}, short: {}, long: {}, curly: {}, mohawk: {} } },
    hairColor:  { default: "black",  options: { black: { color: 0x111111 }, brown: { color: 0x4b2e1f }, blond: { color: 0xeec07b }, red: { color: 0x9b3a18 }, white: { color: 0xeeeeee }, blue: { color: 0x1e88e5 } } },
    top:        { default: "tshirt", options: { tshirt: { color: 0xff5533 }, hoodie: { color: 0x444444 }, suit: { color: 0x111133 }, tank: { color: 0xeeeeee }, leather: { color: 0x222222 } } },
    bottom:     { default: "jeans",  options: { jeans: { color: 0x223377 }, shorts: { color: 0x556677 }, sweats: { color: 0x444444 }, slacks: { color: 0x222222 }, skirt: { color: 0x884466 } } },
    shoes:      { default: "sneakers", options: { sneakers: { color: 0xeeeeee }, boots: { color: 0x222222 }, dress: { color: 0x111111 }, sandals: { color: 0x886633 } } },
    hat:        { default: "none",   options: { none: {}, cap: { color: 0xff0000 }, beanie: { color: 0x336699 }, fedora: { color: 0x111111 } } },
    accessory:  { default: "none",   options: { none: {}, glasses: {}, watch: { color: 0xffd700 }, necklace: { color: 0xffaa00 } } },
  };

  function slotNames() { return Object.keys(SLOTS); }
  function optionsFor(slot) {
    const s = SLOTS[slot];
    return s ? Object.keys(s.options) : [];
  }
  function defaultFor(slot) {
    const s = SLOTS[slot];
    return s ? s.default : null;
  }
  function getOption(slot, optionId) {
    const s = SLOTS[slot];
    if (!s) return null;
    return s.options[optionId] || null;
  }

  // Add a new option to an existing slot (e.g. user-uploaded hat mesh).
  function registerOption(slot, optionId, def) {
    const s = SLOTS[slot];
    if (!s) throw new Error(`unknown slot: ${slot}`);
    if (s.options[optionId]) throw new Error(`option ${slot}.${optionId} already exists`);
    s.options[optionId] = def || {};
  }

  // Add an entirely new slot (e.g. backpack).
  function registerSlot(slotName, def) {
    if (SLOTS[slotName]) throw new Error(`slot ${slotName} already exists`);
    SLOTS[slotName] = {
      default: def.default || null,
      options: def.options || {},
    };
  }

  // Build a character facet with all defaults (or supplied overrides).
  function makeCharacter(overrides) {
    overrides = overrides || {};
    const c = {};
    for (const slot of Object.keys(SLOTS)) {
      const choice = overrides[slot] !== undefined ? overrides[slot] : SLOTS[slot].default;
      // Validate
      if (!SLOTS[slot].options[choice]) {
        // Fall back to default if invalid
        c[slot] = SLOTS[slot].default;
      } else {
        c[slot] = choice;
      }
    }
    return c;
  }

  // Set a slot on an existing character. Returns {ok, reason?}
  function setSlot(character, slot, optionId) {
    if (!SLOTS[slot]) return { ok: false, reason: "unknown_slot" };
    if (!SLOTS[slot].options[optionId]) return { ok: false, reason: "unknown_option" };
    character[slot] = optionId;
    return { ok: true };
  }

  // Snapshot resolve: produce a full {slot → {id, ...optionDef}} render-ready map
  function resolve(character) {
    const out = {};
    for (const [slot, optionId] of Object.entries(character)) {
      const def = getOption(slot, optionId);
      out[slot] = Object.assign({ id: optionId }, def || {});
    }
    return out;
  }

  // Random preset for "randomize" button
  function randomize(rng) {
    rng = rng || Math.random;
    const c = {};
    for (const slot of Object.keys(SLOTS)) {
      const opts = Object.keys(SLOTS[slot].options);
      c[slot] = opts[Math.floor(rng() * opts.length)];
    }
    return c;
  }

  // Save / load preset by name (in-memory; storage adapter optional)
  function createPresetStore(opts) {
    opts = opts || {};
    const presets = new Map();
    const storage = opts.storage || null;
    if (storage) {
      const raw = storage.read("character_presets.json");
      if (raw) try { for (const [k, v] of Object.entries(JSON.parse(raw))) presets.set(k, v); } catch (e) {}
    }
    function save(name, character) {
      presets.set(name, character);
      if (storage) storage.write("character_presets.json", JSON.stringify(Object.fromEntries(presets)));
    }
    function load(name) { return presets.get(name) || null; }
    function list() { return Array.from(presets.keys()); }
    function remove(name) { presets.delete(name); if (storage) storage.write("character_presets.json", JSON.stringify(Object.fromEntries(presets))); }
    return { save, load, list, remove };
  }

  return {
    SLOTS, slotNames, optionsFor, defaultFor, getOption,
    registerOption, registerSlot,
    makeCharacter, setSlot, resolve, randomize, createPresetStore,
  };
});
