// pet_ai.js — companion pet AI: commands, bond, loyalty, mood.
// Each pet has owner, position, command (idle/follow/sit/fetch),
// bond (0..100), loyalty (0..100), hunger (0..100), mood. Bond grows
// from feeding + petting; loyalty grows from successful command
// execution + bond. Low loyalty pets ignore commands.
//
// Commands: idle / follow / sit / fetch / heel / attack / play
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTAPetAI = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const COMMANDS = ["idle", "follow", "sit", "fetch", "heel", "attack", "play"];
  const MOODS = ["sad", "neutral", "content", "happy", "ecstatic"];

  function _clamp(x, lo, hi) { return x < lo ? lo : x > hi ? hi : x; }
  function _dist(a, b) { return Math.hypot(a.u - b.u, a.v - b.v); }

  function createSystem(opts) {
    opts = opts || {};
    const config = Object.assign({
      followDistance: 3,
      bondPerFeed: 5,
      bondPerPet: 2,
      loyaltyOnSuccess: 1,
      loyaltyOnIgnore: -2,
      hungerPerSec: 0.05,
      minLoyaltyForObedience: 30,
      maxBond: 100,
      maxLoyalty: 100,
      maxHunger: 100,
    }, opts.config || {});

    const pets = new Map();
    let nextPetId = 1;
    const events = [];

    function _log(kind, detail) {
      events.push({ kind, detail, ts: Date.now() });
      if (events.length > 500) events.shift();
    }

    function _mood(pet) {
      const score = pet.bond * 0.4 + pet.loyalty * 0.3 + (100 - pet.hunger) * 0.3;
      if (score < 20) return "sad";
      if (score < 40) return "neutral";
      if (score < 60) return "content";
      if (score < 80) return "happy";
      return "ecstatic";
    }

    function spawnPet(opts2) {
      opts2 = opts2 || {};
      if (!opts2.ownerId) return { ok: false, reason: "missing_owner" };
      const id = opts2.id || ("pet_" + (nextPetId++));
      if (pets.has(id)) return { ok: false, reason: "duplicate" };
      const pet = {
        id, ownerId: opts2.ownerId,
        species: opts2.species || "dog",
        name: opts2.name || id,
        position: opts2.position || { u: 0, v: 0, y: 0 },
        command: "follow",
        bond: opts2.bond != null ? opts2.bond : 30,
        loyalty: opts2.loyalty != null ? opts2.loyalty : 50,
        hunger: opts2.hunger != null ? opts2.hunger : 30,
        targetPos: null,
        fetchedItem: null,
        lastCommandTs: Date.now(),
      };
      pets.set(id, pet);
      _log("spawn", { id, ownerId: opts2.ownerId });
      return { ok: true, id, pet };
    }

    function despawnPet(id) {
      if (!pets.has(id)) return { ok: false };
      pets.delete(id);
      return { ok: true };
    }

    function getPet(id) { return pets.get(id) || null; }
    function listPets(ownerId) {
      return Array.from(pets.values()).filter(p => !ownerId || p.ownerId === ownerId);
    }
    function mood(petId) {
      const p = pets.get(petId);
      return p ? _mood(p) : null;
    }

    function command(petId, ownerId, cmd, opts2) {
      opts2 = opts2 || {};
      const p = pets.get(petId);
      if (!p) return { ok: false, reason: "no_pet" };
      if (p.ownerId !== ownerId) return { ok: false, reason: "not_owner" };
      if (!COMMANDS.includes(cmd)) return { ok: false, reason: "bad_command" };
      // Loyalty check
      if (p.loyalty < config.minLoyaltyForObedience) {
        p.loyalty = _clamp(p.loyalty + config.loyaltyOnIgnore, 0, config.maxLoyalty);
        _log("ignored", { petId, cmd });
        return { ok: false, reason: "disobedient", loyalty: p.loyalty };
      }
      p.command = cmd;
      p.targetPos = opts2.targetPos || null;
      p.lastCommandTs = opts2.now != null ? opts2.now : Date.now();
      p.loyalty = _clamp(p.loyalty + config.loyaltyOnSuccess, 0, config.maxLoyalty);
      _log("command", { petId, cmd });
      return { ok: true, command: cmd, loyalty: p.loyalty };
    }

    function feed(petId, ownerId) {
      const p = pets.get(petId);
      if (!p) return { ok: false, reason: "no_pet" };
      if (p.ownerId !== ownerId) return { ok: false, reason: "not_owner" };
      p.hunger = _clamp(p.hunger - 40, 0, config.maxHunger);
      p.bond = _clamp(p.bond + config.bondPerFeed, 0, config.maxBond);
      _log("fed", { petId, bond: p.bond, hunger: p.hunger });
      return { ok: true, bond: p.bond, hunger: p.hunger };
    }

    function pet(petId, ownerId) {
      const p = pets.get(petId);
      if (!p) return { ok: false, reason: "no_pet" };
      if (p.ownerId !== ownerId) return { ok: false, reason: "not_owner" };
      p.bond = _clamp(p.bond + config.bondPerPet, 0, config.maxBond);
      _log("petted", { petId, bond: p.bond });
      return { ok: true, bond: p.bond };
    }

    // tick(dt, {playerPos, items}) advances pet movement + hunger
    function tick(dt, opts2) {
      opts2 = opts2 || {};
      const playerPositions = opts2.playerPositions || {};
      for (const p of pets.values()) {
        // Hunger
        p.hunger = _clamp(p.hunger + config.hungerPerSec * dt, 0, config.maxHunger);
        // Command behavior (kinematic, caller-supplied positions)
        const ownerPos = playerPositions[p.ownerId];
        if (p.command === "follow" && ownerPos) {
          const d = _dist(p.position, ownerPos);
          if (d > config.followDistance) {
            const step = 5 * dt;
            const du = (ownerPos.u - p.position.u) / d;
            const dv = (ownerPos.v - p.position.v) / d;
            p.position.u += du * step;
            p.position.v += dv * step;
          }
        } else if (p.command === "heel" && ownerPos) {
          // Heel: stay right next to owner
          p.position.u = ownerPos.u + 1;
          p.position.v = ownerPos.v;
        } else if (p.command === "fetch" && p.targetPos) {
          const d = _dist(p.position, p.targetPos);
          if (d < 1) {
            // Picked up; switch to return
            p.fetchedItem = p.targetPos.itemId || "fetched";
            p.targetPos = null;
            p.command = "follow";
            _log("fetched", { petId: p.id, item: p.fetchedItem });
          } else {
            const step = Math.min(6 * dt, d);   // don't overshoot
            const du = (p.targetPos.u - p.position.u) / d;
            const dv = (p.targetPos.v - p.position.v) / d;
            p.position.u += du * step;
            p.position.v += dv * step;
          }
        }
        // sit/idle/play/attack: no movement here (or up to caller)
      }
    }

    // Pet fetched item — owner takes it
    function takeFetched(petId, ownerId) {
      const p = pets.get(petId);
      if (!p) return { ok: false };
      if (p.ownerId !== ownerId) return { ok: false, reason: "not_owner" };
      if (!p.fetchedItem) return { ok: false, reason: "nothing_to_take" };
      const item = p.fetchedItem;
      p.fetchedItem = null;
      p.bond = _clamp(p.bond + config.bondPerPet, 0, config.maxBond);
      _log("took_fetched", { petId, item });
      return { ok: true, item, bond: p.bond };
    }

    function recentEvents(n) { return events.slice(-(n || 50)); }
    function getConfig() { return Object.assign({}, config); }

    return {
      COMMANDS, MOODS,
      spawnPet, despawnPet, getPet, listPets,
      command, feed, pet, takeFetched, tick,
      mood,
      recentEvents, getConfig,
    };
  }

  return { COMMANDS, MOODS, createSystem };
});
