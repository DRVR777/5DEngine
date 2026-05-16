// test_iter_106.js — achievements: unlock, chains, rarity, claim, progress.
const A = require("./achievements.js");
const Stats = require("./stats.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

// 1. createSystem + RARITY
const sys = A.createSystem();
ok(A.RARITY.includes("legendary"), "legendary tier");
ok(A.RARITY.length === 5, "5 rarity tiers");

// 2. register
ok(sys.register({ id: "first_kill", kind: "stat_threshold", params: { statKind: "kill", threshold: 1 }, name: "First Blood" }).ok,
   "register first_kill");
ok(sys.register({}).ok === false, "missing id");
ok(sys.register({ id: "x" }).ok === false, "missing kind");
ok(sys.register({ id: "x2", kind: "weird" }).ok === false, "unknown kind");
ok(sys.register({ id: "first_kill", kind: "stat_threshold" }).ok === false, "duplicate");
ok(sys.register({ id: "x3", kind: "stat_threshold", rarity: "weird" }).ok === false, "bad rarity");

sys.register({ id: "ten_kills", kind: "stat_threshold", params: { statKind: "kill", threshold: 10 },
               rarity: "rare", requires: ["first_kill"] });
sys.register({ id: "hundred_kills", kind: "stat_threshold", params: { statKind: "kill", threshold: 100 },
               rarity: "epic", requires: ["ten_kills"] });

// 3. evaluate (no stats yet → none unlock)
const stats = Stats.createSystem();
let newly = sys.evaluate("alice", { stats });
ok(newly.length === 0, "no stats → no unlocks");

// 4. Record a kill, evaluate → first_kill unlocks
stats.record("alice", "kill", null);
newly = sys.evaluate("alice", { stats });
ok(newly.length === 1, "1 unlocked");
ok(newly[0].id === "first_kill", "first_kill unlocked");
ok(sys.isUnlocked("alice", "first_kill"), "isUnlocked");

// 5. Chain dep: ten_kills not yet
ok(!sys.isUnlocked("alice", "ten_kills"), "ten_kills locked");

// Reach 10
for (let i = 1; i < 10; i++) stats.record("alice", "kill", null);
newly = sys.evaluate("alice", { stats });
ok(newly.length === 1 && newly[0].id === "ten_kills", "ten_kills unlocks");

// Reach 100 (chain through ten_kills)
for (let i = 0; i < 90; i++) stats.record("alice", "kill", null);
newly = sys.evaluate("alice", { stats });
ok(newly.length === 1 && newly[0].id === "hundred_kills", "hundred_kills unlocks");

// 6. Already-unlocked don't re-fire
newly = sys.evaluate("alice", { stats });
ok(newly.length === 0, "no re-fire");

// 7. Other player not affected
ok(!sys.isUnlocked("bob", "first_kill"), "bob not affected");

// 8. mission_done kind
sys.register({ id: "intro_done", kind: "mission_done", params: { missionId: "intro" } });
newly = sys.evaluate("bob", { completedMissions: new Set(["intro"]) });
ok(newly.find(d => d.id === "intro_done"), "intro_done unlocks for bob");

// Without ctx
newly = sys.evaluate("carol", {});
ok(!newly.find(d => d.id === "intro_done"), "no mission ctx → no unlock");

// 9. event_count via recordEvent
sys.register({ id: "ten_dodges", kind: "event_count", params: { eventKind: "dodge", count: 10 } });
for (let i = 0; i < 9; i++) sys.recordEvent("alice", "dodge", { stats });
ok(!sys.isUnlocked("alice", "ten_dodges"), "9 dodges = locked");
sys.recordEvent("alice", "dodge", { stats });
ok(sys.isUnlocked("alice", "ten_dodges"), "10 dodges = unlocked");

// 10. custom kind
let predCalled = false;
sys.register({
  id: "custom_one",
  kind: "custom",
  params: { predicate: () => { predCalled = true; return true; } },
});
sys.evaluate("dave", {});
ok(predCalled, "custom predicate called");
ok(sys.isUnlocked("dave", "custom_one"), "custom unlocked");

// custom that throws
sys.register({
  id: "custom_throw",
  kind: "custom",
  params: { predicate: () => { throw new Error("boom"); } },
});
const newAlice = sys.evaluate("eve", {});
ok(!newAlice.find(d => d.id === "custom_throw"), "throwing predicate doesn't unlock");

// 11. claimReward
sys.register({
  id: "with_reward",
  kind: "stat_threshold",
  params: { statKind: "kill", threshold: 1 },
  reward: { ccy: "coin", amount: 100 },
});
sys.evaluate("alice", { stats });

let granted = [];
const grant = (p, r) => granted.push({ p, r });
const claim1 = sys.claimReward("alice", "with_reward", grant);
ok(claim1.ok === true, "claim ok");
ok(granted.length === 1 && granted[0].r.amount === 100, "grant fn called");

const claim2 = sys.claimReward("alice", "with_reward", grant);
ok(claim2.ok === false && claim2.reason === "already_claimed", "double claim rejected");

const claim3 = sys.claimReward("alice", "ghost", grant);
ok(claim3.ok === false && claim3.reason === "not_unlocked", "ghost claim");

// No-reward ach
sys.register({ id: "no_reward", kind: "custom", params: { predicate: () => true } });
sys.evaluate("alice", {});
const claim4 = sys.claimReward("alice", "no_reward", grant);
ok(claim4.ok === true && claim4.reward === null, "no-reward claim returns null");

// grantFn throws
sys.register({ id: "throw_reward", kind: "custom", params: { predicate: () => true },
               reward: { ccy: "coin", amount: 50 } });
sys.evaluate("alice", {});
const claim5 = sys.claimReward("alice", "throw_reward", () => { throw new Error("nope"); });
ok(claim5.ok === false && claim5.reason === "grant_threw", "grant threw caught");

// 12. Hidden + visible
sys.register({ id: "secret", kind: "custom", params: { predicate: () => false },
               hidden: true, name: "Secret" });
const vis = sys.visibleFor("alice");
ok(!vis.find(v => v.id === "secret"), "hidden not shown when locked");

// Unlock the secret → now visible
sys.register({ id: "secret2", kind: "custom", params: { predicate: () => true }, hidden: true });
sys.evaluate("alice", {});
const vis2 = sys.visibleFor("alice");
ok(vis2.find(v => v.id === "secret2" && v.unlocked), "unlocked secret visible");

// 13. progressOf
sys.register({ id: "kill_50", kind: "stat_threshold", params: { statKind: "kill", threshold: 50 } });
// bob has 0 kills
const prog = sys.progressOf("bob", "kill_50", { stats });
ok(prog.target === 50 && prog.current === 0 && prog.pct === 0, "progress 0/50");

// Unlocked → met
const progDone = sys.progressOf("alice", "first_kill", { stats });
ok(progDone.met === true && progDone.pct === 1, "unlocked = 100% met");

ok(sys.progressOf("alice", "ghost") === null, "ghost ach → null");

// event_count progress
const dodgeProg = sys.progressOf("bob", "ten_dodges");
ok(dodgeProg.target === 10 && dodgeProg.current === 0, "0/10 dodges");

// 14. totalRarityScore
const score = sys.totalRarityScore("alice");
ok(score > 0, `alice score > 0 (got ${score})`);
ok(sys.totalRarityScore("ghost") === 0, "ghost score 0");

// 15. unregister
ok(sys.unregister("kill_50") === true, "unreg");
ok(sys.getDef("kill_50") === null, "removed");

// 16. listDefs
ok(sys.listDefs().length > 0, "defs listed");

// 17. registerKind custom
sys.registerKind("always_true", () => true);
sys.register({ id: "always_unlock", kind: "always_true" });
sys.evaluate("frank", {});
ok(sys.isUnlocked("frank", "always_unlock"), "custom kind works");

// 18. recentEvents
ok(sys.recentEvents().length > 0, "events logged");
ok(sys.recentEvents().some(e => e.kind === "unlock"), "unlock events");

// 19. autoEvaluateOnEvent: false → recordEvent doesn't auto-unlock
const sys2 = A.createSystem({ config: { autoEvaluateOnEvent: false } });
sys2.register({ id: "ten_evt", kind: "event_count", params: { eventKind: "x", count: 1 } });
sys2.recordEvent("a", "x");
ok(!sys2.isUnlocked("a", "ten_evt"), "no auto-eval = not unlocked");
sys2.evaluate("a");
ok(sys2.isUnlocked("a", "ten_evt"), "manual eval = unlocked");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
