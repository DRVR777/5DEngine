// test_iter_100.js — MEGA-REGRESSION milestone.
// Wires 12 systems together in a single end-to-end story:
//
//   Two players form a clan + become friends → run a coop mission
//   together → mission complete triggers stats + notifications +
//   leaderboard submission + daily-challenge grant + economy deposit
//   → one player lists item on trading post → other player buys via
//   currency exchange → weather forecast queried for next-hour window.
//
// If this test stays green, the integration surface between the
// last ~25 iters remains stable.

const Notifications = require("./notifications.js");
const Stats          = require("./stats.js");
const Leaderboards   = require("./leaderboards.js");
const DailyChallenges = require("./daily_challenges.js");
const Mission        = require("./mission_dsl.js");
const CoopMissions   = require("./coop_missions.js");
const Minigame       = require("./minigame.js");
const Clans          = require("./clans.js");
const Friends        = require("./friends.js");
const TradingPost    = require("./trading_post.js");
const Exchange       = require("./currency_exchange.js");
const Weather        = require("./weather_forecast.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

// ────────── Test-time mocks for economy + inventory ──────────
function mkEconomy() {
  const bal = new Map();
  const k = (p, c) => p + "::" + c;
  return {
    set: (p, c, a) => bal.set(k(p,c), a),
    balance: (p, c) => bal.get(k(p,c)) || 0,
    deposit: (p, c, a) => { bal.set(k(p,c), (bal.get(k(p,c)) || 0) + a); return { ok: true }; },
    withdraw: (p, c, a) => {
      const cur = bal.get(k(p,c)) || 0;
      if (cur < a) return { ok: false };
      bal.set(k(p,c), cur - a);
      return { ok: true };
    },
  };
}

function mkInventory() {
  const owned = new Map();
  const held = new Map();
  const k = (p, i) => p + "::" + i;
  return {
    give: (p, i, q) => owned.set(k(p,i), (owned.get(k(p,i)) || 0) + q),
    own: (p, i) => owned.get(k(p,i)) || 0,
    holdItem: (p, i, q) => {
      const cur = owned.get(k(p,i)) || 0;
      if (cur < q) return { ok: false };
      owned.set(k(p,i), cur - q);
      held.set(k(p,i), (held.get(k(p,i)) || 0) + q);
      return { ok: true };
    },
    transferHeld: (from, to, i, q) => {
      held.set(k(from,i), Math.max(0, (held.get(k(from,i)) || 0) - q));
      owned.set(k(to,i), (owned.get(k(to,i)) || 0) + q);
    },
    releaseHeld: (p, i, q) => {
      held.set(k(p,i), Math.max(0, (held.get(k(p,i)) || 0) - q));
      owned.set(k(p,i), (owned.get(k(p,i)) || 0) + q);
    },
  };
}

// ────────── Wire all the systems ──────────
const notif    = Notifications.createSystem();
const stats    = Stats.createSystem();
const lb       = Leaderboards.createSystem();
const dc       = DailyChallenges.createSystem({ config: { challengesPerDay: 5 } });
const runner   = Mission.createRunner();
const coopSess = (mission) => CoopMissions.createSession({ missionId: mission.id, mission });
const mg       = Minigame.createHarness();
const clans    = Clans.createSystem();
const friends  = Friends.createSystem();
const trade    = TradingPost.createSystem();
const market   = Exchange.createExchange();
const economy  = mkEconomy();
const inv      = mkInventory();

// Boards
ok(lb.createBoard("coop_hits", { sort: "high" }).ok, "leaderboard ready");

// Daily challenges in pool
dc.registerChallenge({ id: "kill_30", kind: "kill_30_mock", rewardAmount: 100, rewardCcy: "coin" });
dc.registerChallenge({ id: "mission_intro", kind: "mission_run", missionId: "intro", rewardCcy: "coin", rewardAmount: 200 });
dc.registerChallenge({ id: "win_race",   kind: "win_minigame", minigameId: "race", rewardCcy: "coin", rewardAmount: 75 });

// Seed economy
economy.set("alice", "coin", 500);
economy.set("bob",   "coin", 500);
inv.give("alice", "loot_sword", 1);

// ────────── Story: Alice + Bob form a clan ──────────
const clan = clans.createClan("alice", { name: "Wolves" });
ok(clan.ok, "clan created");
ok(clans.invitePlayer(clan.id, "alice", "bob").ok, "alice invites bob");
ok(clans.acceptInvite(clan.id, "bob").ok, "bob joins clan");
ok(clans.memberRank(clan.id, "bob") === "member", "bob is member");

// ────────── Become friends ──────────
ok(friends.sendRequest("alice", "bob").ok, "friend request");
ok(friends.acceptRequest("bob", "alice").ok, "friend accept");
ok(friends.isFriends("alice", "bob"), "are friends");
friends.setStatus("alice", "online");
friends.setStatus("bob", "online");
ok(friends.onlineFriends("alice").includes("bob"), "alice sees bob online");

// ────────── Run a coop mission ──────────
const missionSpec = Mission.parseMission({
  id: "intro",
  name: "Wolves' First Run",
  objectives: [
    { id: "kills", kind: "kill", count: 5, matchTag: "rival" },
    { id: "reach_base", kind: "reach", target: { u: 100, v: 100 }, radius: 5 },
  ],
});
const coopMission = coopSess(missionSpec);
ok(coopMission.joinPlayer("alice").ok, "alice joins coop");
ok(coopMission.joinPlayer("bob").ok, "bob joins coop");

// Alice kills 2, bob kills 3 → sum = 5 (combined kill objective complete)
coopMission.applyUpdate({ playerId: "alice", patches: [{ idx: 0, progress: 2 }] });
stats.record("alice", "kill", { delta: 2 });
coopMission.applyUpdate({ playerId: "bob",   patches: [{ idx: 0, progress: 3 }] });
stats.record("bob", "kill", { delta: 3 });
ok(coopMission.getMerged()[0].progress === 5, "combined kills = 5");
ok(coopMission.getMerged()[0].completed, "kill objective merged complete");

// Bob reaches base
coopMission.applyUpdate({ playerId: "bob", patches: [{ idx: 1, completed: true }] });
ok(coopMission.getMerged()[1].completed, "reach objective complete via bob");
ok(coopMission.getStatus() === "completed", "mission completed");

// ────────── Submit mission rewards to all relevant systems ──────────
const completionTs = Date.UTC(2026, 4, 16, 12, 0, 0);
stats.record("alice", "mission_complete", null, { ts: completionTs });
stats.record("bob",   "mission_complete", null, { ts: completionTs });
ok(stats.lifetime("alice", "mission_complete") === 1, "alice mission count");
ok(stats.lifetime("alice", "kill") === 2, "alice kill stat = 2");
ok(stats.lifetime("bob", "kill") === 3, "bob kill stat = 3");

economy.deposit("alice", "coin", 100);
economy.deposit("bob",   "coin", 100);

lb.submit({ boardId: "coop_hits", playerId: "alice", score: 1500, ts: completionTs });
lb.submit({ boardId: "coop_hits", playerId: "bob",   score: 1200, ts: completionTs });
const top = lb.top("coop_hits", { now: completionTs + 1000 });
ok(top[0].playerId === "alice" && top[0].score === 1500, "alice tops leaderboard");

// Daily challenge: mission_intro should match
const dcResult = dc.submitCompletion(
  { playerId: "alice", challengeId: "mission_intro", proof: { missionId: "intro", completed: true }, ts: completionTs },
  { economy }
);
ok(dcResult.ok, `daily challenge granted (${dcResult.reason || "ok"})`);
ok(economy.balance("alice", "coin") === 800,
   `alice = 800 coin (500 start + 100 mission + 200 daily) (got ${economy.balance("alice", "coin")})`);

// Notify both players
const n1 = notif.push({ category: "quest", priority: "high", title: "Mission Complete!", message: "Wolves' First Run finished" });
ok(n1.ok, "quest notification");

// ────────── Run a minigame, link to leaderboard + dailyChallenges ──────────
lb.createBoard("race", { sort: "high" });
const mgSession = mg.start({ playerId: "alice", gameId: "race", mode: "single" });
ok(mgSession.ok, "minigame started");
mg.addScore(mgSession.id, 9999);
const mgWin = mg.win(mgSession.id, { leaderboard: lb, dailyChallenges: dc });
ok(mgWin.status === "won", "minigame won");

const raceTop = lb.top("race");
ok(raceTop[0] && raceTop[0].score === 9999, "race score on board");
ok(dc.ledgerOf("alice").find(g => g.challengeId === "win_race"),
   "win_race daily granted via minigame");

// ────────── Alice lists item on trading post; bob buys ──────────
const offer = trade.createOffer("alice", { itemId: "loot_sword", qty: 1, askingCcy: "coin", askingAmount: 150 });
ok(offer.ok, "offer created");
const accepted = trade.acceptOffer(offer.id, "bob", { economy, inventory: inv });
ok(accepted.ok, `bob accepted offer (${accepted.reason || ""})`);
trade.confirmTrade(offer.id, "alice", { economy, inventory: inv });
const finalConfirm = trade.confirmTrade(offer.id, "bob", { economy, inventory: inv });
ok(finalConfirm.state === "finished", "trade finished");
ok(inv.own("bob", "loot_sword") === 1, "bob has the sword");
// alice paid in: started 500 + 100 mission + 200 daily = 800; sold for 150 → 950
ok(economy.balance("alice", "coin") === 950, `alice ended at 950 coin (got ${economy.balance("alice", "coin")})`);

// ────────── Currency exchange: alice trades coins for gems ──────────
market.limitOrder({
  playerId: "vendor", side: "sell",
  sellCcy: "coin", buyCcy: "gem",
  quantity: 100, price: 2,
});
const econ2 = mkEconomy();
econ2.set("alice", "coin", 1000);
const buy = market.limitOrder({
  playerId: "alice", side: "buy",
  sellCcy: "coin", buyCcy: "gem",
  quantity: 50, price: 2,
  economy: econ2,
});
ok(buy.trades.length === 1, "exchange trade executed");
ok(econ2.balance("alice", "gem") === 50, `alice got 50 gem (got ${econ2.balance("alice", "gem")})`);

// ────────── Weather forecast for next hour ──────────
const fc = Weather.forecast({
  startTs: completionTs, durationMs: 60 * 60 * 1000,
  seed: 42, climate: "temperate",
});
ok(fc.slots.length >= 12, `60-min forecast has ${fc.slots.length} slots`);
ok(fc.slots.every(s => Weather.KINDS.includes(s.kind)), "all kinds valid");

// ────────── Cross-system smoke ──────────
ok(notif.activeToasts().length >= 1, "notifications still active");
ok(stats.lifetime("alice", "kill") >= 2, "stats still tracking alice");
ok(friends.isFriends("alice", "bob"), "friendship still intact");
ok(clans.memberRank(clan.id, "alice") === "leader", "alice still clan leader");
ok(clans.memberRank(clan.id, "bob") === "member", "bob still in clan");

// Treasury deposit + withdraw via clan
ok(clans.deposit(clan.id, "alice", "coin", 100, { economy }).ok, "alice deposits to clan");
ok(clans.treasury(clan.id).coin === 100, "treasury = 100");

// Final assertions: total tests > integration count
console.log(`\n${pass} passed, ${fail} failed`);
console.log("===== MEGA-REGRESSION: 12 SYSTEMS WIRED + SMOKE GREEN =====");
process.exit(fail === 0 ? 0 : 1);
