// test_iter_109.js — reputation: factions, cascades, decay, standings.
const R = require("./reputation.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

// 1. registerFaction + thresholds
const sys = R.createSystem();
ok(sys.registerFaction({ id: "merchants", name: "Merchants Guild" }).ok, "register");
ok(sys.registerFaction({}).ok === false, "missing id");
ok(sys.registerFaction({ id: "merchants" }).ok === false, "duplicate");

sys.registerFaction({ id: "thieves", name: "Thieves" });
sys.registerFaction({ id: "guards", name: "Guards" });
ok(sys.listFactions().length === 3, "3 factions");

// 2. score / standing defaults
const t0 = 1000;
ok(sys.score("alice", "merchants", { now: t0 }) === 0, "default 0");
ok(sys.standing("alice", "merchants", { now: t0 }) === "neutral", "neutral default");
ok(sys.score("alice", "ghost") === null, "missing faction");
ok(sys.standing("alice", "ghost") === null, "missing → null");

// 3. delta basic
const d1 = sys.delta("alice", "merchants", 200, { now: t0 });
ok(d1.ok === true, "delta ok");
ok(d1.primary.newScore === 200, "+200");
ok(d1.primary.newStanding === "friendly", "friendly");
ok(d1.primary.standingChanged === true, "standing changed");

// Bad delta
ok(sys.delta("alice", "ghost", 10).ok === false, "ghost faction");
ok(sys.delta("alice", "merchants", "text").ok === false, "non-number");

// 4. Crossing thresholds
sys.delta("alice", "merchants", 500, { now: t0 + 100 });   // 200+500=700 → honored
ok(sys.standing("alice", "merchants", { now: t0 + 200 }) === "honored", "honored at 700");

sys.delta("alice", "merchants", 200, { now: t0 + 300 });   // 700+200=900 → exalted? no, decay applied
// score after decay = 700 (mostly), then +200 = 900
const s900 = sys.score("alice", "merchants", { now: t0 + 400 });
ok(s900 > 800, `score > 800 (got ${s900})`);
ok(sys.standing("alice", "merchants", { now: t0 + 400 }) === "exalted", "exalted at 900");

// 5. Min/max clamps
const sys2 = R.createSystem();
sys2.registerFaction({ id: "f" });
sys2.delta("p", "f", 9999);
ok(sys2.score("p", "f") === 1000, "clamped to maxScore");

sys2.delta("p", "f", -99999);
ok(sys2.score("p", "f") === -1000, "clamped to minScore");

// 6. set
const sys3 = R.createSystem();
sys3.registerFaction({ id: "f" });
const setR = sys3.set("p", "f", 500);
ok(setR.ok && setR.newScore === 500, "set to 500");
ok(sys3.set("p", "ghost", 1).ok === false, "ghost set");

sys3.set("p", "f", 5000);   // gets clamped
ok(sys3.score("p", "f") === 1000, "set clamped");

// 7. Cascade: ally
sys.registerFaction({ id: "guild_a", allies: ["guild_b"], enemies: [] });
sys.registerFaction({ id: "guild_b", allies: [], enemies: [] });
const cas = sys.delta("alice", "guild_a", 100, { now: t0 });
ok(cas.cascades.length === 1, "1 cascade (ally)");
ok(cas.cascades[0].factionId === "guild_b", "to guild_b");
ok(cas.cascades[0].delta === 50, "ally weight 0.5 → +50");

// 8. Cascade: enemy (negative for me when enemy hurt)
sys.registerFaction({ id: "good_guys", allies: [], enemies: ["bad_guys"] });
sys.registerFaction({ id: "bad_guys", allies: [], enemies: [] });
const enem = sys.delta("alice", "good_guys", 100, { now: t0 });
const badC = enem.cascades.find(c => c.factionId === "bad_guys");
ok(badC, "bad_guys cascaded");
ok(badC.delta === -50, "helping good = -50 with bad");
ok(badC.kind === "enemy", "enemy kind");

// 9. skipCascade
const noCas = sys.delta("alice", "guild_a", 50, { now: t0 + 1, skipCascade: true });
ok(noCas.cascades.length === 0, "cascade skipped");

// 10. allOfPlayer
const all = sys.allOfPlayer("alice", { now: t0 + 1000 });
ok(typeof all === "object", "object");
ok(all.merchants && all.merchants.score > 0, "merchants in all");
ok(all.guild_a && typeof all.guild_a.standing === "string", "standing set");

// 11. meetsStanding
sys.set("p", "merchants", 500, { now: t0 + 5000 });
ok(sys.meetsStanding("p", "merchants", "friendly", { now: t0 + 5000 }) === true, "p meets friendly");
ok(sys.meetsStanding("p", "merchants", "exalted", { now: t0 + 5000 }) === false, "p doesn't meet exalted");
ok(sys.meetsStanding("p", "merchants", "neutral", { now: t0 + 5000 }) === true, "p meets neutral (higher)");
ok(sys.meetsStanding("p", "ghost", "friendly") === false, "missing → false");
ok(sys.meetsStanding("p", "merchants", "fake_standing") === false, "bad standing");

// 12. Decay over time
const sys4 = R.createSystem({ config: { decayPerHour: 10 } });
sys4.registerFaction({ id: "f" });
sys4.delta("p", "f", 100, { now: 0 });
ok(sys4.score("p", "f", { now: 3600000 }) === 90, "decay 10/hour");
ok(sys4.score("p", "f", { now: 36000000 }) === 0, "decay to 0 after 10h");

// Negative score decays toward 0
const sys5 = R.createSystem({ config: { decayPerHour: 20 } });
sys5.registerFaction({ id: "f" });
sys5.set("p", "f", -200, { now: 0 });
ok(sys5.score("p", "f", { now: 3600000 }) === -180, "negative decay +20");

// 13. unregisterFaction
ok(sys.unregisterFaction("guild_b") === true, "unreg ok");

// 14. Reset
sys.reset("alice", "merchants");
ok(sys.score("alice", "merchants", { now: t0 + 99999 }) === 0, "reset to 0");

// Reset all
sys.delta("bob", "merchants", 100);
sys.delta("bob", "thieves", -100);
sys.reset("bob");
ok(sys.score("bob", "merchants") === 0, "all reset merchants");
ok(sys.score("bob", "thieves") === 0, "all reset thieves");
ok(sys.reset("ghost").ok === false, "ghost reset");

// 15. listPlayers
ok(sys.listPlayers().length > 0, "players listed");

// 16. recentEvents
ok(sys.recentEvents().length > 0, "events");
ok(sys.recentEvents().some(e => e.kind === "delta"), "delta events");

// 17. Custom thresholds
const sys6 = R.createSystem({ config: { thresholds: [
  { name: "low", max: 100 },
  { name: "high", max: Infinity },
]}});
sys6.registerFaction({ id: "f" });
sys6.set("p", "f", 50);
ok(sys6.standing("p", "f") === "low", "custom low");
sys6.set("p", "f", 500);
ok(sys6.standing("p", "f") === "high", "custom high");

// 18. Cascade weights configurable
const sys7 = R.createSystem({ config: { allyWeight: 1.0, enemyWeight: 0.2 } });
sys7.registerFaction({ id: "a", allies: ["b"], enemies: ["c"] });
sys7.registerFaction({ id: "b" });
sys7.registerFaction({ id: "c" });
const c7 = sys7.delta("p", "a", 100);
const cB = c7.cascades.find(c => c.factionId === "b");
const cC = c7.cascades.find(c => c.factionId === "c");
ok(cB.delta === 100, "ally weight 1.0 → +100 (got " + cB.delta + ")");
ok(cC.delta === -20, "enemy weight 0.2 → -20");

// 19. Cascade to missing faction skipped
const sys8 = R.createSystem();
sys8.registerFaction({ id: "x", allies: ["nonexistent"], enemies: [] });
const cMissing = sys8.delta("p", "x", 50);
ok(cMissing.cascades.length === 0, "missing cascade skipped");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
