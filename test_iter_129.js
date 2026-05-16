// test_iter_129.js — treasure maps: chains, dig, reveal, reward.
const T = require("./treasure_map.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

function mkInv() {
  const owned = new Map();
  const k = (p, i) => p + "::" + i;
  return {
    give: (p, i, q) => owned.set(k(p,i), (owned.get(k(p,i)) || 0) + q),
    own: (p, i) => owned.get(k(p,i)) || 0,
  };
}

// 1. registerChain
const sys = T.createSystem();
const r1 = sys.registerChain({
  id: "pirate_gold",
  name: "Pirate Gold",
  clues: [
    { location: { u: 10, v: 10 }, hint: "Under the old oak" },
    { location: { u: 50, v: 30 }, hint: "Where waves crash" },
    { location: { u: 100, v: 100 }, hint: "At the X" },
  ],
  reward: { itemId: "gold_chest", qty: 1 },
});
ok(r1.ok, "register chain");

// Bad chains
ok(sys.registerChain({}).ok === false, "no clues");
ok(sys.registerChain({ clues: [] }).ok === false, "empty");
ok(sys.registerChain({ clues: [{}] }).ok === false, "bad clue");
ok(sys.registerChain({ id: "pirate_gold", clues: [{ location: {u:0,v:0} }] }).ok === false, "duplicate");

// 2. startChain
const start1 = sys.startChain("alice", "pirate_gold");
ok(start1.ok, "start chain");
ok(start1.total === 3, "3 clues total");
ok(start1.clue.hint === "Under the old oak", "first clue hint");

ok(sys.startChain("alice", "ghost").ok === false, "no chain");

// 3. dig at wrong location → miss
const miss = sys.dig("alice", "pirate_gold", { u: 0, v: 0 });
ok(miss.ok === false && miss.reason === "miss", "miss");
ok(miss.distance > 0, "distance reported");

// 4. dig at correct location → reveal next clue
const hit1 = sys.dig("alice", "pirate_gold", { u: 11, v: 10 });   // within radius 3
ok(hit1.ok === true, "hit first");
ok(hit1.finalDig === false, "not final");
ok(hit1.nextClue.hint === "Where waves crash", "next clue revealed");
ok(hit1.progress.current === 2 && hit1.progress.total === 3, "2/3 progress");

// 5. Progress tracking
const prog = sys.getProgress("alice", "pirate_gold");
ok(prog.currentClueIdx === 1, "current idx 1");
ok(prog.digsSpent === 2, "2 digs (1 miss + 1 hit)");

// 6. getCurrentClue
const cur = sys.getCurrentClue("alice", "pirate_gold");
ok(cur.hint === "Where waves crash", "current matches");
ok(sys.getCurrentClue("alice", "ghost") === null, "ghost null");

// 7. Hit final → reward
sys.dig("alice", "pirate_gold", { u: 50, v: 30 });
const inv = mkInv();
const final = sys.dig("alice", "pirate_gold", { u: 100, v: 100 }, { inventory: inv });
ok(final.ok === true, "final hit");
ok(final.finalDig === true, "is final");
ok(final.reward.itemId === "gold_chest", "reward");
ok(inv.own("alice", "gold_chest") === 1, "in inventory");

// Re-dig completed chain
const reDig = sys.dig("alice", "pirate_gold", { u: 100, v: 100 });
ok(reDig.ok === false && reDig.reason === "already_completed", "already completed");

// Start completed
ok(sys.startChain("alice", "pirate_gold").ok === false, "can't restart completed");

// 8. Multiple players independent
const start2 = sys.startChain("bob", "pirate_gold");
ok(start2.ok && start2.total === 3, "bob fresh start");
ok(sys.getProgress("bob", "pirate_gold").currentClueIdx === 0, "bob at clue 0");
ok(sys.getProgress("alice", "pirate_gold").completed === true, "alice still completed");

// 9. Reward as array of items
sys.registerChain({
  id: "multi",
  clues: [{ location: { u: 0, v: 0 } }],
  reward: [
    { itemId: "gold", qty: 100 },
    { itemId: "gem", qty: 5 },
  ],
});
const inv2 = mkInv();
sys.startChain("carol", "multi");
const mFin = sys.dig("carol", "multi", { u: 1, v: 0 }, { inventory: inv2 });
ok(mFin.ok && Array.isArray(mFin.reward), "array reward");
ok(inv2.own("carol", "gold") === 100, "gold");
ok(inv2.own("carol", "gem") === 5, "gem");

// 10. No-reward chain works
sys.registerChain({ id: "noreward", clues: [{ location: { u: 0, v: 0 } }] });
sys.startChain("dave", "noreward");
const nr = sys.dig("dave", "noreward", { u: 0, v: 0 });
ok(nr.ok && nr.reward === null, "no reward gracefully");

// 11. abandonChain
sys.registerChain({ id: "abch", clues: [{ location: { u: 0, v: 0 } }] });
sys.startChain("eve", "abch");
ok(sys.abandonChain("eve", "abch").ok === true, "abandon");
ok(sys.getProgress("eve", "abch") === null, "progress wiped");
ok(sys.abandonChain("eve", "abch").ok === false, "no progress");

// Start fresh after abandon
ok(sys.startChain("eve", "abch").ok === true, "fresh start");

// 12. playerStats
const stats = sys.playerStats("alice");
ok(stats.completed === 1, "1 completed");
ok(stats.totalDigs > 0, "some digs");

const noStats = sys.playerStats("ghost");
ok(noStats.started === 0, "ghost no stats");

// 13. maxDigsPerSpot — abuse prevention
const sys2 = T.createSystem({ config: { digRadius: 1, maxDigsPerSpot: 2 } });
sys2.registerChain({ id: "ch", clues: [{ location: { u: 100, v: 100 } }] });
sys2.startChain("p", "ch");

// 2 clues × 2 maxDigsPerSpot = 4 max
let lastResult;
for (let i = 0; i < 6; i++) {
  lastResult = sys2.dig("p", "ch", { u: 0, v: 0 });
}
ok(lastResult.reason === "too_many_digs", `too_many_digs (got ${lastResult.reason})`);

// 14. unregisterChain
ok(sys.unregisterChain("multi") === true, "unreg");
ok(sys.getChain("multi") === null, "removed");

// 15. listChains
ok(sys.listChains().length >= 1, "chains listed");

// 16. recentEvents
ok(sys.recentEvents().length > 0, "events");
ok(sys.recentEvents().some(e => e.kind === "treasure_found"), "treasure_found event");

// 17. getConfig
ok(sys.getConfig().digRadius > 0, "config");

// 18. Terrain stored
sys.registerChain({
  id: "terrain_test",
  clues: [
    { location: { u: 0, v: 0 }, terrain: "sand" },
    { location: { u: 10, v: 10 }, terrain: "rock" },
  ],
});
const tt = sys.getChain("terrain_test");
ok(tt.clues[0].terrain === "sand", "terrain preserved");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
