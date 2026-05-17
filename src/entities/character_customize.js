// character_customize.js — character look spec: face/hair/body presets,
// clothing slots, color tints. Pure data — renderer reads the final
// CharSpec to drive its model swap.
//
// Slots:
//   head: helmet/hat
//   face: glasses/mask
//   torso: shirt/jacket
//   legs:  pants/skirt
//   feet:  shoes/boots
//   hands: gloves
//   back:  backpack/cape
//   misc:  accessory
//
// Presets are registered catalogs (faces, hairs, bodies). Tints apply
// per-slot (RGB hex string).
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTACharacterCustomize = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const SLOTS = ["head", "face", "torso", "legs", "feet", "hands", "back", "misc"];

  const DEFAULT_FACES = ["face_a", "face_b", "face_c", "face_d"];
  const DEFAULT_HAIRS = ["short", "long", "buzz", "bald", "ponytail"];
  const DEFAULT_BODIES = ["slim", "average", "athletic", "heavy"];

  function _validHex(s) {
    return typeof s === "string" && /^#[0-9a-fA-F]{6}$/.test(s);
  }

  function createSystem(opts) {
    opts = opts || {};
    const faces = new Set(DEFAULT_FACES);
    const hairs = new Set(DEFAULT_HAIRS);
    const bodies = new Set(DEFAULT_BODIES);
    const garments = new Map();   // garmentId → {slot, name, allowedTints?}
    const looks = new Map();      // playerId → spec
    const events = [];

    function _log(kind, detail) {
      events.push({ kind, detail, ts: Date.now() });
      if (events.length > 500) events.shift();
    }

    function registerFace(id) {
      if (typeof id !== "string" || !id) return { ok: false };
      faces.add(id); return { ok: true };
    }
    function registerHair(id) {
      if (typeof id !== "string" || !id) return { ok: false };
      hairs.add(id); return { ok: true };
    }
    function registerBody(id) {
      if (typeof id !== "string" || !id) return { ok: false };
      bodies.add(id); return { ok: true };
    }

    function registerGarment(g) {
      if (!g || !g.id) return { ok: false, reason: "missing_id" };
      if (!SLOTS.includes(g.slot)) return { ok: false, reason: "bad_slot" };
      if (garments.has(g.id)) return { ok: false, reason: "duplicate" };
      garments.set(g.id, {
        id: g.id, slot: g.slot, name: g.name || g.id,
        allowedTints: g.allowedTints || null,
      });
      _log("register_garment", { id: g.id, slot: g.slot });
      return { ok: true };
    }

    function listGarments(slot) {
      const out = [];
      for (const g of garments.values()) {
        if (!slot || g.slot === slot) out.push(g);
      }
      return out;
    }

    function listFaces() { return Array.from(faces); }
    function listHairs() { return Array.from(hairs); }
    function listBodies() { return Array.from(bodies); }

    function _ensureSpec(playerId) {
      if (!looks.has(playerId)) {
        looks.set(playerId, {
          playerId,
          face: "face_a",
          hair: "short",
          body: "average",
          skinTint: "#d9b08c",
          hairTint: "#3a2d20",
          eyeTint: "#3a78c2",
          garments: {},      // slot → {garmentId, tint}
        });
      }
      return looks.get(playerId);
    }

    function getLook(playerId) {
      return _ensureSpec(playerId);
    }

    function setFace(playerId, faceId) {
      if (!faces.has(faceId)) return { ok: false, reason: "no_face" };
      const s = _ensureSpec(playerId);
      s.face = faceId;
      _log("face", { playerId, faceId });
      return { ok: true };
    }
    function setHair(playerId, hairId) {
      if (!hairs.has(hairId)) return { ok: false, reason: "no_hair" };
      _ensureSpec(playerId).hair = hairId;
      _log("hair", { playerId, hairId });
      return { ok: true };
    }
    function setBody(playerId, bodyId) {
      if (!bodies.has(bodyId)) return { ok: false, reason: "no_body" };
      _ensureSpec(playerId).body = bodyId;
      _log("body", { playerId, bodyId });
      return { ok: true };
    }

    function setSkinTint(playerId, hex) {
      if (!_validHex(hex)) return { ok: false, reason: "bad_hex" };
      _ensureSpec(playerId).skinTint = hex;
      return { ok: true };
    }
    function setHairTint(playerId, hex) {
      if (!_validHex(hex)) return { ok: false, reason: "bad_hex" };
      _ensureSpec(playerId).hairTint = hex;
      return { ok: true };
    }
    function setEyeTint(playerId, hex) {
      if (!_validHex(hex)) return { ok: false, reason: "bad_hex" };
      _ensureSpec(playerId).eyeTint = hex;
      return { ok: true };
    }

    function equipGarment(playerId, garmentId, opts2) {
      opts2 = opts2 || {};
      const g = garments.get(garmentId);
      if (!g) return { ok: false, reason: "no_garment" };
      if (opts2.tint && !_validHex(opts2.tint)) return { ok: false, reason: "bad_tint" };
      if (opts2.tint && g.allowedTints && !g.allowedTints.includes(opts2.tint)) {
        return { ok: false, reason: "tint_not_allowed" };
      }
      const s = _ensureSpec(playerId);
      s.garments[g.slot] = { garmentId, tint: opts2.tint || null };
      _log("equip", { playerId, garmentId, slot: g.slot });
      return { ok: true, slot: g.slot };
    }

    function unequipSlot(playerId, slot) {
      const s = _ensureSpec(playerId);
      if (!s.garments[slot]) return { ok: false, reason: "empty_slot" };
      delete s.garments[slot];
      _log("unequip", { playerId, slot });
      return { ok: true };
    }

    function setTint(playerId, slot, hex) {
      if (!_validHex(hex)) return { ok: false, reason: "bad_hex" };
      const s = _ensureSpec(playerId);
      if (!s.garments[slot]) return { ok: false, reason: "empty_slot" };
      s.garments[slot].tint = hex;
      _log("tint", { playerId, slot, hex });
      return { ok: true };
    }

    function randomLook(playerId, rng) {
      rng = rng || Math.random;
      const s = _ensureSpec(playerId);
      const arr = Array.from;
      const facesArr = arr(faces), hairsArr = arr(hairs), bodiesArr = arr(bodies);
      s.face = facesArr[Math.floor(rng() * facesArr.length)];
      s.hair = hairsArr[Math.floor(rng() * hairsArr.length)];
      s.body = bodiesArr[Math.floor(rng() * bodiesArr.length)];
      _log("random", { playerId });
      return { ok: true, spec: s };
    }

    function resetLook(playerId) {
      looks.delete(playerId);
      _log("reset", { playerId });
      return { ok: true };
    }

    function toJSON(playerId) {
      const s = looks.get(playerId);
      if (!s) return null;
      return JSON.parse(JSON.stringify(s));
    }

    function fromJSON(playerId, spec) {
      if (!spec || typeof spec !== "object") return { ok: false };
      looks.set(playerId, Object.assign({}, spec, { playerId }));
      return { ok: true };
    }

    function listPlayers() { return Array.from(looks.keys()); }
    function recentEvents(n) { return events.slice(-(n || 50)); }

    return {
      SLOTS,
      registerFace, registerHair, registerBody, registerGarment,
      listFaces, listHairs, listBodies, listGarments,
      getLook, setFace, setHair, setBody,
      setSkinTint, setHairTint, setEyeTint,
      equipGarment, unequipSlot, setTint,
      randomLook, resetLook,
      toJSON, fromJSON,
      listPlayers, recentEvents,
    };
  }

  return { SLOTS, DEFAULT_FACES, DEFAULT_HAIRS, DEFAULT_BODIES, createSystem };
});
