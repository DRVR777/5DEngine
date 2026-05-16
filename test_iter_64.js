// test_iter_64.js — factions: rep, tiers, cross-faction cascades.
const F = require("./factions.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

// 1. Tier math
ok(F.tierOf(0) === "neutral", "0 = neutral");
ok(F.tierOf(99) === "neutral", "99 = neutral");
ok(F.tierOf(100) === "friendly", "100 = friendly");
ok(F.tierOf(499) === "friendly", "499 = friendly");
ok(F.tierOf(500) === "honored", "500 = honored");
ok(F.tierOf(1500) === "exalted", "1500 = exalted");
ok(F.tierOf(-100) === "hostile", "-100 = hostile");
ok(F.tierOf(-500) === "hated", "-500 = hated");
ok(F.tierOf(99999) === "exalted", "huge = exalted");

ok(F.TIERS.length === 6, "6 tiers");

// 2. Faction definition
const sys = F.createFactionSystem();
sys.defineFaction("guild", { name: "Adventurers Guild", kind: "good" });
sys.defineFaction("bandits", { name: "Bandits", kind: "evil" });
sys.defineFaction("merchants", { name: "Merchants", kind: "neutral" });

ok(sys.listFactions().length === 3, "3 factions");
ok(sys.getFaction("guild").name === "Adventurers Guild", "name preserved");
ok(sys.getFaction("ghost") === null, "missing faction → null");

let threw = false;
try { sys.defineFaction("guild", {}); } catch (e) { threw = true; }
ok(threw, "duplicate faction throws");

// 3. Initial rep is 0 / neutral
ok(sys.getRep("alice", "guild") === 0, "alice starts at 0 with guild");
ok(sys.getTier("alice", "guild") === "neutral", "alice neutral");

// 4. adjustRep no cascade if no relations set
const c1 = sys.adjustRep("alice", "guild", 150);
ok(c1.length === 1, "1 change (no cascade with no relations)");
ok(c1[0].newRep === 150, "rep = 150");
ok(c1[0].newTier === "friendly", "tier flipped to friendly");
ok(c1[0].prevTier === "neutral", "prevTier neutral");

// 5. Relations + cascade
sys.setRelation("guild", "bandits", "rival");
sys.setRelation("guild", "merchants", "ally");
ok(sys.getRelation("guild", "bandits") === "rival", "guild rivals bandits");
ok(sys.getRelation("guild", "merchants") === "ally", "guild allies merchants");
ok(sys.getRelation("bandits", "merchants") === "neutral", "bandits-merchants neutral");

// Self / missing faction
ok(sys.setRelation("guild", "guild", "ally").ok === false, "self relation rejected");
ok(sys.setRelation("guild", "ghost", "ally").ok === false, "missing faction rejected");
ok(sys.setRelation("guild", "bandits", "vibe").ok === false, "bad rel rejected");

// Bob: +200 with guild → ally (merchants) +100, rival (bandits) -100
const c2 = sys.adjustRep("bob", "guild", 200);
ok(c2.length === 3, `3 changes (guild + 2 cascades) (got ${c2.length})`);
ok(c2[0].factionId === "guild" && c2[0].newRep === 200, "guild = 200");

const merchantChange = c2.find(c => c.factionId === "merchants");
ok(merchantChange && merchantChange.delta === 100, `merchants +100 (cascade) (got ${merchantChange && merchantChange.delta})`);
const banditChange = c2.find(c => c.factionId === "bandits");
ok(banditChange && banditChange.delta === -100, `bandits -100 (cascade) (got ${banditChange && banditChange.delta})`);

ok(sys.getRep("bob", "guild") === 200, "guild rep");
ok(sys.getRep("bob", "merchants") === 100, "merchants cascade");
ok(sys.getRep("bob", "bandits") === -100, "bandits cascade");
ok(sys.getTier("bob", "merchants") === "friendly", "merchants tier friendly");
ok(sys.getTier("bob", "bandits") === "hostile", "bandits tier hostile");

// 6. skipCascade
const c3 = sys.adjustRep("bob", "guild", 100, { skipCascade: true });
ok(c3.length === 1, "skipCascade → 1 change");
ok(sys.getRep("bob", "merchants") === 100, "merchants unchanged");

// 7. Custom cascade fractions
const sys2 = F.createFactionSystem({ allianceCascade: 1.0, rivalryCascade: -1.0 });
sys2.defineFaction("light", {}); sys2.defineFaction("dark", {});
sys2.setRelation("light", "dark", "rival");
const c4 = sys2.adjustRep("c", "light", 100);
const darkCh = c4.find(c => c.factionId === "dark");
ok(darkCh.delta === -100, "1.0 rivalry cascade: -100 fully mirrored");

// 8. hasAccess
sys.defineFaction("citadel", {});
sys.adjustRep("alice", "citadel", 600);  // honored
ok(sys.hasAccess("alice", "citadel", "neutral") === true, "honored ≥ neutral");
ok(sys.hasAccess("alice", "citadel", "friendly") === true, "honored ≥ friendly");
ok(sys.hasAccess("alice", "citadel", "honored") === true, "honored ≥ honored");
ok(sys.hasAccess("alice", "citadel", "exalted") === false, "honored < exalted");
ok(sys.hasAccess("alice", "citadel", "hated") === true, "honored ≥ hated (anything above)");

ok(sys.hasAccess("alice", "citadel", "ghost_tier") === false, "unknown tier → false");
ok(sys.hasAccess("alice", "missing_faction", "neutral") === true,
   "missing faction defaults to neutral, which is ≥ neutral");
// (Edge case — default rep 0 = neutral, hasAccess uses getTier which falls
// back to 'neutral' for missing rep)

// 9. Negative rep + double-drop
sys.adjustRep("dave", "bandits", -600);  // hated
ok(sys.getTier("dave", "bandits") === "hated", "dave hated by bandits");

// 10. Multiple players independent
sys.adjustRep("eve", "guild", 50);
ok(sys.getRep("eve", "guild") === 50, "eve has 50");
ok(sys.getRep("bob", "guild") === 300, "bob unchanged by eve's adjust");

// 11. Events log
const events = sys.recentEvents();
ok(events.length > 5, `events logged (${events.length})`);
ok(events.every(e => e.kind === "rep_adjust"), "all events are rep_adjust");
ok(events[0].detail.playerId !== undefined, "detail has playerId");

// 12. Tier-cross detection in changes
const c5 = sys.adjustRep("alice", "citadel", 1000);  // 600 + 1000 = 1600 → exalted
const guildChange = c5.find(c => c.factionId === "citadel");
ok(guildChange.prevTier === "honored" && guildChange.newTier === "exalted",
   "tier transition recorded (honored → exalted)");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
