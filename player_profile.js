// player_profile.js — persistent player state: stats, achievements, level.
// Mirrors a small KV-typed schema; persists through any storage adapter
// (sidecar, Manifest store, in-memory).
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTAPlayerProfile = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Default stat shape — extensible at runtime via registerStat.
  const DEFAULT_STATS = {
    kills: 0,
    deaths: 0,
    coinsEarned: 0,
    coinsSpent: 0,
    questsCompleted: 0,
    distanceTraveled: 0,        // engine units
    timePlayedSec: 0,
    vehiclesOwned: 0,
    bossesDefeated: 0,
    shotsFired: 0,
    shotsLanded: 0,
  };

  const ACHIEVEMENTS = {
    first_kill: {
      name: "Bloody Hands",
      desc: "Kill your first enemy",
      criterion: { stat: "kills", op: ">=", value: 1 },
    },
    centurion: {
      name: "Centurion",
      desc: "100 kills",
      criterion: { stat: "kills", op: ">=", value: 100 },
    },
    boss_slayer: {
      name: "Boss Slayer",
      desc: "Defeat 5 bosses",
      criterion: { stat: "bossesDefeated", op: ">=", value: 5 },
    },
    rich: {
      name: "Filthy Rich",
      desc: "Earn 10,000 coins total",
      criterion: { stat: "coinsEarned", op: ">=", value: 10000 },
    },
    questing: {
      name: "Adventurer",
      desc: "Complete 10 quests",
      criterion: { stat: "questsCompleted", op: ">=", value: 10 },
    },
    sharpshooter: {
      name: "Sharpshooter",
      desc: "75% accuracy with 100+ shots",
      criterion: { fn: (stats) => stats.shotsFired >= 100 && (stats.shotsLanded / stats.shotsFired) >= 0.75 },
    },
    explorer: {
      name: "Explorer",
      desc: "Travel 10,000 units",
      criterion: { stat: "distanceTraveled", op: ">=", value: 10000 },
    },
    veteran: {
      name: "Veteran",
      desc: "1 hour played",
      criterion: { stat: "timePlayedSec", op: ">=", value: 3600 },
    },
  };

  function checkCriterion(stats, criterion) {
    if (criterion.fn) return !!criterion.fn(stats);
    if (criterion.stat) {
      const v = stats[criterion.stat];
      if (v == null) return false;
      switch (criterion.op) {
        case ">=": return v >= criterion.value;
        case ">":  return v >  criterion.value;
        case "==": return v === criterion.value;
        case "<=": return v <= criterion.value;
        case "<":  return v <  criterion.value;
      }
    }
    return false;
  }

  function levelFromXP(xp) {
    // 100 → lvl 2, 250 → lvl 3, 450 → lvl 4 (sum: 100, 150, 200, 250 ...)
    let level = 1, need = 100, total = 0;
    while (xp >= total + need) { total += need; level++; need += 50; }
    return { level, xpInLevel: xp - total, xpForNext: need };
  }

  function createProfile(opts) {
    opts = opts || {};
    return {
      handle: opts.handle || "anon",
      avatar: opts.avatar || null,             // character.js facet
      stats: Object.assign({}, DEFAULT_STATS, opts.stats || {}),
      achievementsUnlocked: new Set(opts.achievementsUnlocked || []),
      xp: opts.xp || 0,
      createdAt: opts.createdAt || Date.now(),
      lastSeenAt: opts.lastSeenAt || Date.now(),
    };
  }

  function incStat(profile, statName, delta) {
    if (delta == null) delta = 1;
    if (!(statName in profile.stats)) profile.stats[statName] = 0;
    profile.stats[statName] += delta;
    return profile.stats[statName];
  }

  function setStat(profile, statName, value) {
    profile.stats[statName] = value;
  }

  function awardXP(profile, amount) {
    profile.xp = Math.max(0, profile.xp + amount);
    return levelFromXP(profile.xp);
  }

  function getLevel(profile) { return levelFromXP(profile.xp); }

  // Re-evaluate achievements; returns IDs newly unlocked.
  function evaluateAchievements(profile, registry) {
    registry = registry || ACHIEVEMENTS;
    const newly = [];
    for (const [id, def] of Object.entries(registry)) {
      if (profile.achievementsUnlocked.has(id)) continue;
      if (checkCriterion(profile.stats, def.criterion)) {
        profile.achievementsUnlocked.add(id);
        newly.push(id);
      }
    }
    return newly;
  }

  function registerAchievement(id, def) {
    if (ACHIEVEMENTS[id]) throw new Error(`achievement ${id} exists`);
    ACHIEVEMENTS[id] = def;
  }
  function getAchievement(id) { return ACHIEVEMENTS[id] || null; }
  function listAchievements() { return Object.keys(ACHIEVEMENTS); }

  // Serialize/deserialize for save_load
  function toJSON(profile) {
    return {
      $schema: "5DEngine.profile/1",
      handle: profile.handle,
      avatar: profile.avatar,
      stats: Object.assign({}, profile.stats),
      achievementsUnlocked: Array.from(profile.achievementsUnlocked),
      xp: profile.xp,
      createdAt: profile.createdAt,
      lastSeenAt: profile.lastSeenAt,
    };
  }

  function fromJSON(json) {
    if (!json || json.$schema !== "5DEngine.profile/1") {
      return { ok: false, reason: "bad_schema" };
    }
    return { ok: true, profile: createProfile(json) };
  }

  // Storage helpers — works with any {read, write} interface.
  function saveProfile(profile, storage, key) {
    if (!storage || !storage.write) return { ok: false, reason: "no_storage" };
    storage.write(key || "player_profile.json", JSON.stringify(toJSON(profile)));
    return { ok: true };
  }

  function loadProfile(storage, key) {
    if (!storage || !storage.read) return { ok: false, reason: "no_storage" };
    const raw = storage.read(key || "player_profile.json");
    if (!raw) return { ok: false, reason: "not_found" };
    try {
      const json = JSON.parse(raw);
      return fromJSON(json);
    } catch (e) {
      return { ok: false, reason: "bad_json" };
    }
  }

  return {
    DEFAULT_STATS, ACHIEVEMENTS,
    createProfile, incStat, setStat, awardXP, getLevel,
    evaluateAchievements, registerAchievement, getAchievement, listAchievements,
    levelFromXP, checkCriterion,
    toJSON, fromJSON, saveProfile, loadProfile,
  };
});
