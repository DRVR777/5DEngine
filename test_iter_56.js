// test_iter_56.js — player profile + stats + achievements + persistence.
const PP = require("./player_profile.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

// 1. createProfile defaults
const p = PP.createProfile({ handle: "alice" });
ok(p.handle === "alice", "handle set");
ok(p.stats.kills === 0, "kills = 0");
ok(p.xp === 0, "xp = 0");
ok(p.achievementsUnlocked.size === 0, "no achievements yet");

// 2. Default stats schema is comprehensive
ok(typeof PP.DEFAULT_STATS.kills === "number", "kills in defaults");
ok(typeof PP.DEFAULT_STATS.timePlayedSec === "number", "timePlayedSec in defaults");
ok(typeof PP.DEFAULT_STATS.shotsFired === "number", "shotsFired in defaults");
ok(Object.keys(PP.DEFAULT_STATS).length >= 10, ">=10 default stats");

// 3. incStat
PP.incStat(p, "kills");
ok(p.stats.kills === 1, "incStat default +1");
PP.incStat(p, "kills", 5);
ok(p.stats.kills === 6, "incStat with delta");
PP.incStat(p, "newCustomStat", 3);
ok(p.stats.newCustomStat === 3, "incStat creates new stat");

// 4. setStat
PP.setStat(p, "kills", 100);
ok(p.stats.kills === 100, "setStat overwrites");

// 5. awardXP + level math
const lvl = PP.awardXP(p, 50);
ok(lvl.level === 1, "level 1 at 50xp (need 100 for L2)");
ok(lvl.xpForNext === 100, "xpForNext = 100 at L1");

PP.awardXP(p, 50);   // total 100 → exactly L2
const lvl2 = PP.getLevel(p);
ok(lvl2.level === 2, `level 2 at 100xp (got L${lvl2.level})`);
ok(lvl2.xpForNext === 150, "L2→L3 needs 150");

PP.awardXP(p, 200);  // total 300 → past L3 (need 100+150=250)
ok(PP.getLevel(p).level === 3, "level 3 at 300xp");

// awardXP can subtract (e.g. death penalty)
PP.awardXP(p, -50);
ok(p.xp === 250, "negative xp subtracts");
PP.awardXP(p, -1000);
ok(p.xp === 0, "xp clamped at 0");

// 6. checkCriterion
ok(PP.checkCriterion({ kills: 5 }, { stat: "kills", op: ">=", value: 5 }) === true, ">= satisfied");
ok(PP.checkCriterion({ kills: 4 }, { stat: "kills", op: ">=", value: 5 }) === false, ">= not satisfied");
ok(PP.checkCriterion({ kills: 5 }, { stat: "kills", op: "==", value: 5 }) === true, "== satisfied");
ok(PP.checkCriterion({ kills: 5 }, { stat: "kills", op: ">", value: 5 }) === false, "> strict");
ok(PP.checkCriterion({ kills: 5 }, { stat: "missing", op: ">=", value: 1 }) === false, "missing stat → false");

const fnCriterion = { fn: (s) => s.kills > 0 && s.deaths === 0 };
ok(PP.checkCriterion({ kills: 5, deaths: 0 }, fnCriterion) === true, "fn criterion satisfied");
ok(PP.checkCriterion({ kills: 5, deaths: 1 }, fnCriterion) === false, "fn criterion fails");

// 7. evaluateAchievements unlocks newly-met
const p2 = PP.createProfile({ handle: "bob" });
PP.setStat(p2, "kills", 1);
const newly1 = PP.evaluateAchievements(p2);
ok(newly1.includes("first_kill"), "first_kill unlocked at 1 kill");
ok(p2.achievementsUnlocked.has("first_kill"), "stored in set");

// Re-evaluate doesn't re-fire
const newly2 = PP.evaluateAchievements(p2);
ok(newly2.length === 0, "no new achievements on second eval");

// Hit centurion threshold
PP.setStat(p2, "kills", 100);
const newly3 = PP.evaluateAchievements(p2);
ok(newly3.includes("centurion"), "centurion unlocked at 100 kills");
ok(!newly3.includes("first_kill"), "first_kill not re-fired");

// 8. fn-based achievement (sharpshooter)
const p3 = PP.createProfile();
PP.setStat(p3, "shotsFired", 200);
PP.setStat(p3, "shotsLanded", 160);  // 80%
const sh = PP.evaluateAchievements(p3);
ok(sh.includes("sharpshooter"), "sharpshooter at 80% accuracy");

// 65% should NOT unlock sharpshooter
const p4 = PP.createProfile();
PP.setStat(p4, "shotsFired", 200);
PP.setStat(p4, "shotsLanded", 130);
const sh2 = PP.evaluateAchievements(p4);
ok(!sh2.includes("sharpshooter"), "65% accuracy → no sharpshooter");

// 9. Custom achievement
PP.registerAchievement("dragon_slayer", {
  name: "Dragon Slayer",
  desc: "Kill a dragon",
  criterion: { fn: (s) => (s.dragonsKilled || 0) >= 1 },
});
ok(PP.getAchievement("dragon_slayer") !== null, "custom achievement registered");
ok(PP.listAchievements().length >= 9, ">= 9 achievements (8 built-in + 1 custom)");

let threw = false;
try { PP.registerAchievement("first_kill", {}); } catch (e) { threw = true; }
ok(threw, "duplicate achievement throws");

// 10. JSON serialize/deserialize
const json = PP.toJSON(p2);
ok(json.$schema === "5DEngine.profile/1", "JSON schema");
ok(json.handle === "bob", "handle in JSON");
ok(Array.isArray(json.achievementsUnlocked), "achievementsUnlocked → array");

const back = PP.fromJSON(json);
ok(back.ok === true, "fromJSON ok");
ok(back.profile.handle === "bob", "handle restored");
ok(back.profile.achievementsUnlocked.has("centurion"), "achievement restored");
ok(back.profile.stats.kills === 100, "kills restored");

// Bad JSON
ok(PP.fromJSON({ $schema: "wrong" }).ok === false, "bad schema rejected");
ok(PP.fromJSON(null).ok === false, "null rejected");

// 11. Storage save/load round-trip
const store = (() => {
  const data = {};
  return { read: k => data[k] || null, write: (k, v) => { data[k] = v; } };
})();
const saved = PP.saveProfile(p2, store, "alice.json");
ok(saved.ok === true, "save ok");
const loaded = PP.loadProfile(store, "alice.json");
ok(loaded.ok === true, "load ok");
ok(loaded.profile.stats.kills === 100, "loaded stats match");
ok(loaded.profile.achievementsUnlocked.has("centurion"), "loaded achievements match");

// Missing file
const mf = PP.loadProfile(store, "nonexistent.json");
ok(mf.ok === false && mf.reason === "not_found", "missing file rejected");

// No storage
ok(PP.saveProfile(p2, null).ok === false, "no storage save rejected");
ok(PP.loadProfile(null).ok === false, "no storage load rejected");

// 12. levelFromXP table sanity
ok(PP.levelFromXP(0).level === 1, "0 xp = L1");
ok(PP.levelFromXP(99).level === 1, "99 xp = L1");
ok(PP.levelFromXP(100).level === 2, "100 xp = L2");
ok(PP.levelFromXP(250).level === 3, "250 xp = L3 (100+150)");
ok(PP.levelFromXP(450).level === 4, "450 xp = L4 (100+150+200)");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
