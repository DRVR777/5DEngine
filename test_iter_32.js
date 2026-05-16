// test_iter_32.js — three-tier interest management.
const Int = require("./interest.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

// 1. classify — boundaries match the doc
ok(Int.classify(0)   === "foreground", "0m → foreground");
ok(Int.classify(80)  === "foreground", "80m boundary → foreground");
ok(Int.classify(80.01) === "midground", ">80m → midground");
ok(Int.classify(300) === "midground", "300m boundary → midground");
ok(Int.classify(300.01) === "background", ">300m → background");
ok(Int.classify(99999) === "background", "huge distance → background");

// 2. tierOf
const t = Int.tierOf(50);
ok(t.name === "foreground" && t.hz === 60, "foreground = 60Hz");
ok(Int.tierOf(150).hz === 5,  "midground = 5Hz");
ok(Int.tierOf(500).hz === 1,  "background = 1Hz");

// 3. classifyPeers groups correctly
const observer = { u: 0, v: 0 };
const peers = [
  { id: "a", pos: { u: 10,   v: 0 } },     // 10m → foreground
  { id: "b", pos: { u: 50,   v: 60 } },    // ~78 → foreground
  { id: "c", pos: { u: 100,  v: 0 } },     // 100m → midground
  { id: "d", pos: { u: 250,  v: 0 } },     // 250m → midground
  { id: "e", pos: { u: 1000, v: 0 } },     // 1000m → background
];
const grouped = Int.classifyPeers(observer, peers);
ok(grouped.foreground.length === 2, `2 in foreground (got ${grouped.foreground.length})`);
ok(grouped.midground.length === 2,  `2 in midground (got ${grouped.midground.length})`);
ok(grouped.background.length === 1, `1 in background (got ${grouped.background.length})`);
ok(grouped.foreground[0].id === "a", "a is in foreground");
ok(grouped.background[0].id === "e", "e is in background");

// 4. shouldUpdate respects per-tier interval
// foreground 1/60 ≈ 0.0167s, midground 0.2s, background 1.0s
const fgPeer = { distance: 5, lastSentT: 0 };
ok(Int.shouldUpdate(fgPeer, 0.005).send === false, "fg too soon (5ms)");
ok(Int.shouldUpdate(fgPeer, 0.02).send  === true,  "fg ok at 20ms");

const mgPeer = { distance: 200, lastSentT: 0 };
ok(Int.shouldUpdate(mgPeer, 0.1).send === false, "mg too soon (100ms)");
ok(Int.shouldUpdate(mgPeer, 0.21).send === true, "mg ok at 210ms");

const bgPeer = { distance: 800, lastSentT: 0 };
ok(Int.shouldUpdate(bgPeer, 0.5).send  === false, "bg too soon (500ms)");
ok(Int.shouldUpdate(bgPeer, 1.05).send === true,  "bg ok at 1050ms");

// First-time peers always send
const fresh = { distance: 800, lastSentT: null };
ok(Int.shouldUpdate(fresh, 0).send === true, "first-time send");

// 5. pickUpdates filters per-tier-interval
const peersWithT = [
  { id: "a", pos: { u: 10,  v: 0 }, lastSentT: 0 },     // fg, 50ms ok
  { id: "c", pos: { u: 200, v: 0 }, lastSentT: 0 },     // mg, 50ms NOT ok
  { id: "e", pos: { u: 800, v: 0 }, lastSentT: 0 },     // bg, 50ms NOT ok
];
const send50 = Int.pickUpdates(observer, peersWithT, 0.05);
ok(send50.length === 1 && send50[0].id === "a",
   `at 50ms: only fg sends (got ${send50.length})`);

// At 1.5s, all should send
const send1500 = Int.pickUpdates(observer, peersWithT, 1.5);
ok(send1500.length === 3, `at 1500ms: all 3 send (got ${send1500.length})`);

// 6. rateBudget — sanity-check bandwidth math
const cl = { foreground: [{},{},{}], midground: [{},{},{},{},{}], background: [{},{},{},{},{},{},{},{},{},{}] };
const budget = Int.rateBudget(cl);
// 3*60 + 5*5 + 10*1 = 180 + 25 + 10 = 215
ok(budget === 215, `rateBudget = 215 msgs/sec (got ${budget})`);

// 7. setTier — let a custom topology widen the foreground
Int.setTier("foreground", { maxRange: 50 });
ok(Int.classify(60) === "midground", "after widening, 60m → midground (was foreground)");
// reset for sanity
Int.setTier("foreground", { maxRange: 80 });

// 8. Empty peer list edge case
ok(Int.classifyPeers(observer, []).foreground.length === 0, "empty peers → empty groups");
ok(Int.pickUpdates(observer, [], 1).length === 0, "empty peers → no sends");

// 9. dist sanity
ok(Int.dist({u:0,v:0}, {u:3,v:4}) === 5, "3-4-5 distance");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
