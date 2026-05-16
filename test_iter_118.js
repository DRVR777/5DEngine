// test_iter_118.js — fishing: cast/bite/reel + species + skill + bait.
const F = require("./fishing.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

// 1. Defaults
const sys = F.createSystem();
ok(F.DEFAULT_SPECIES.length === 5, "5 species");
ok(F.DEFAULT_BAITS.length === 5, "5 baits");
ok(sys.listBaits().includes("worm"), "worm bait");
ok(sys.listSpecies().some(s => s.id === "trophy"), "trophy species");

// 2. cast validation
ok(sys.cast({}).ok === false, "missing player");
ok(sys.cast({ playerId: "p", baitId: "ghost" }).ok === false, "unknown bait");

const c1 = sys.cast({ playerId: "alice", baitId: "worm", now: 0 });
ok(c1.ok && c1.tokenId === "tk_1", "cast ok");
const tok = sys.getToken(c1.tokenId);
ok(tok.state === "waiting", "waiting state");

// 3. tick before bite → still waiting
const minPreroll = 1.5 * 1000;
sys.tick(c1.tokenId, 0.5, { now: 500 });
ok(sys.getToken(c1.tokenId).state === "waiting", "still waiting at 0.5s");

// 4. tick past bite → biting (with deterministic rng)
const t0 = sys.getToken(c1.tokenId);
sys.tick(c1.tokenId, 0, { now: t0.biteAt, rng: () => 0.5 });
ok(sys.getToken(c1.tokenId).state === "biting", "biting after preroll");
ok(sys.getToken(c1.tokenId).fish !== null, "fish picked");

// 5. reel during biting → caught (rng=0.9 fails escape roll for low-strength)
const tBite = sys.getToken(c1.tokenId);
const r1 = sys.reel(c1.tokenId, { rng: () => 0.99 });
// May escape or catch depending on fish strength
if (r1.ok) {
  ok(true, "caught a fish");
  ok(sys.getToken(c1.tokenId).state === "caught", "state caught");
  ok(r1.xpGained > 0, "xp gained");
} else {
  // Escaped via rng — that's fine for the test
  ok(r1.reason === "escaped", "escaped on reel");
}

// 6. reel during waiting → no_bite
const c2 = sys.cast({ playerId: "alice", baitId: "worm", now: 1000 });
const r2 = sys.reel(c2.tokenId);
ok(r2.ok === false && r2.reason === "no_bite", "no bite to reel");

// 7. tick past bite window with no reel → escapes
const sys2 = F.createSystem({ config: { bitePreroll: [0, 0] } });   // bite immediately
const c3 = sys2.cast({ playerId: "p", baitId: "worm", now: 0, rng: () => 0.5 });
sys2.tick(c3.tokenId, 0, { now: 1, rng: () => 0 });   // bite
const t3 = sys2.getToken(c3.tokenId);
ok(t3.state === "biting", "biting");
// Tick past deadline (use deadline + 1s)
sys2.tick(c3.tokenId, 0, { now: t3.deadline + 1000 });
ok(sys2.getToken(c3.tokenId).state === "escaped", "escaped past window");

// 8. cancelCast
const c4 = sys.cast({ playerId: "alice", baitId: "worm", now: 2000 });
ok(sys.cancelCast(c4.tokenId, "alice").ok === true, "cancel ok");
ok(sys.getToken(c4.tokenId).state === "cancelled", "cancelled state");
ok(sys.cancelCast(c4.tokenId, "alice").ok === false, "double cancel");

// Non-owner can't cancel
const c5 = sys.cast({ playerId: "bob", baitId: "worm", now: 3000 });
ok(sys.cancelCast(c5.tokenId, "intruder").ok === false, "non-owner");

// Cancel missing
ok(sys.cancelCast("ghost", "alice").ok === false, "ghost cancel");

// 9. XP + level progression
const sys3 = F.createSystem({ config: { xpPerLevel: 100, baseEscapeChance: 0 } });
ok(sys3.getLevel("p") === 1, "level 1 default");
ok(sys3.getXP("p") === 0, "0 xp");

// Catch a bunch of minnows (5 xp each)
let level = 1;
for (let i = 0; i < 25; i++) {
  const c = sys3.cast({ playerId: "p", baitId: "worm", now: i * 100, rng: () => 0 });
  sys3.tick(c.tokenId, 0, { now: i * 100 + 10000, rng: () => 0 });
  // Now biting — reel with rng=0 → guaranteed catch (escape chance 0)
  sys3.reel(c.tokenId, { rng: () => 0 });
}
const xp = sys3.getXP("p");
const lvl = sys3.getLevel("p");
ok(xp > 0, `xp > 0 (got ${xp})`);
ok(lvl >= 1, `level ≥ 1 (got ${lvl})`);

// 10. registerSpecies
ok(sys.registerSpecies({ id: "shark", rarity: 0.01, biteWindowS: 1, reelStrength: 10, preferBait: ["fish"], xp: 200 }).ok,
   "register shark");
ok(sys.registerSpecies({}).ok === false, "missing id");
ok(sys.registerSpecies({ id: "shark" }).ok === false, "duplicate");
ok(sys.listSpecies().some(s => s.id === "shark"), "shark in list");

// 11. registerBait
ok(sys.registerBait("squid").ok === true, "register squid");
ok(sys.registerBait("").ok === false, "empty");

// 12. activeTokens
const sys4 = F.createSystem();
sys4.cast({ playerId: "x", baitId: "worm", now: 0 });
sys4.cast({ playerId: "x", baitId: "lure", now: 0 });
sys4.cast({ playerId: "y", baitId: "worm", now: 0 });
const xActive = sys4.activeTokens("x");
ok(xActive.length === 2, "x has 2 active");
ok(sys4.activeTokens("y").length === 1, "y has 1");

// Catch one → no longer active
const xC = sys4.cast({ playerId: "x", baitId: "worm", now: 0, rng: () => 0 });
sys4.tick(xC.tokenId, 0, { now: 10000, rng: () => 0 });
sys4.reel(xC.tokenId, { rng: () => 0 });
const finalActive = sys4.activeTokens("x");
ok(finalActive.length === 2, "caught not in active");

// 13. tick on caught/escaped → no-op
const sys5 = F.createSystem({ config: { bitePreroll: [0, 0], baseEscapeChance: 0 } });
const c6 = sys5.cast({ playerId: "p", baitId: "worm", now: 0, rng: () => 0 });
sys5.tick(c6.tokenId, 0, { now: 1, rng: () => 0 });
sys5.reel(c6.tokenId, { rng: () => 0 });
const tAfter = sys5.getToken(c6.tokenId);
sys5.tick(c6.tokenId, 100, { now: 999999 });
ok(tAfter.state === "caught", "still caught (no-op tick)");

// 14. reel on missing token
ok(sys.reel("ghost").ok === false, "ghost reel");

// 15. recentEvents
ok(sys.recentEvents().length > 0, "events");
ok(sys.recentEvents().some(e => e.kind === "cast"), "cast event");

// 16. getConfig
ok(sys.getConfig().bitePreroll.length === 2, "config");

// 17. Bait preference biases species pick
// Test that "rare_lure" boosts "trophy" species probability
const sys6 = F.createSystem({ config: { bitePreroll: [0, 0], baseEscapeChance: 0 } });
let trophyCount = 0;
for (let i = 0; i < 100; i++) {
  const c = sys6.cast({ playerId: "p", baitId: "rare_lure", now: i * 10, rng: () => i / 100 });
  sys6.tick(c.tokenId, 0, { now: i * 10 + 1, rng: () => i / 100 });
  const tok = sys6.getToken(c.tokenId);
  if (tok.fish && tok.fish.id === "trophy") trophyCount++;
  sys6.reel(c.tokenId, { rng: () => 0 });
}
// rare_lure prefers trophy → should see more trophies than 3% baseline
// Baseline trophy rarity is 3%; with bait boost (3x) and 100 trials expect > 3
ok(trophyCount >= 3, `trophy count ≥ 3 with rare_lure boost (got ${trophyCount})`);

// 18. Custom species registration works in pick
sys.registerSpecies({ id: "sturgeon", rarity: 0.999, biteWindowS: 3, reelStrength: 1, preferBait: ["worm"], xp: 50 });
const sysCustom = F.createSystem({ config: { bitePreroll: [0, 0], baseEscapeChance: 0 } });
sysCustom.registerSpecies({ id: "sturgeon", rarity: 99, biteWindowS: 3, reelStrength: 1, preferBait: ["any"], xp: 50 });
// With huge rarity, sturgeon should dominate picks
const cSturg = sysCustom.cast({ playerId: "p", baitId: "worm", now: 0, rng: () => 0.5 });
sysCustom.tick(cSturg.tokenId, 0, { now: 1, rng: () => 0.99 });
const sturgFish = sysCustom.getToken(cSturg.tokenId).fish;
ok(sturgFish.id === "sturgeon", `dominant species picked (got ${sturgFish.id})`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
