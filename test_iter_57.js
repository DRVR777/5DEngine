// test_iter_57.js — fog-of-war + waypoint system.
const FW = require("./fog_of_war.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

// 1. Fog grid creation + bounds
const fog = FW.createFog(40, 40, 4);
ok(fog.width === 40, "width");
ok(fog.cellSize === 4, "cell size");
ok(fog.exploredFraction() === 0, "all hidden initially");

// 2. worldToCell / cellToWorld
const wc = fog.worldToCell(0, 0);
ok(wc.x === 20 && wc.y === 20, `(0,0) → cell (20,20) for 40x40 grid (got ${wc.x},${wc.y})`);
const inv = fog.cellToWorld(20, 20);
ok(inv.u === 2 && inv.v === 2, "cellToWorld inverse-ish (cell+0.5 * size)");

// 3. reveal
fog.reveal({ u: 0, v: 0 }, 8);
ok(fog.isVisible(0, 0), "origin visible after reveal");
ok(fog.isVisible(4, 0), "+4 cell visible (within 8 sight)");
ok(!fog.isVisible(50, 50), "far cell not visible");
const exploredAfter1 = fog.exploredFraction();
ok(exploredAfter1 > 0, `something explored (${(exploredAfter1*100).toFixed(1)}%)`);

// 4. Move + reveal — old cells become EXPLORED (not VISIBLE) but stay seen
fog.reveal({ u: 50, v: 50 }, 8);
ok(!fog.isVisible(0, 0), "origin no longer visible (out of sight)");
ok(fog.isExplored(0, 0), "origin still explored (remembered)");
ok(fog.isVisible(50, 50), "new position visible");

const exploredAfter2 = fog.exploredFraction();
ok(exploredAfter2 > exploredAfter1, "more explored after moving");

// 5. revealAll + reset
fog.revealAll();
ok(fog.exploredFraction() === 1.0, "revealAll → 100%");
fog.reset();
ok(fog.exploredFraction() === 0, "reset → 0%");

// 6. Out-of-bounds queries return hidden
ok(fog.get(-5, -5) === FW.FOG_HIDDEN, "OOB → hidden");
ok(fog.get(999, 999) === FW.FOG_HIDDEN, "OOB high → hidden");
ok(fog.isVisible(99999, 99999) === false, "far world coord not visible");

// 7. Manual set/get
fog.set(10, 10, FW.FOG_VISIBLE);
ok(fog.get(10, 10) === FW.FOG_VISIBLE, "manual set/get");

// 8. Waypoint system
const wp = FW.createWaypointSystem();
ok(wp.add("obj1", { kind: "objective", u: 10, v: 10, label: "Go here" }), "add objective");
ok(wp.add("friend_alice", { kind: "friend", u: 5, v: 5, color: 0x00ff00 }), "add friend");
ok(!wp.add("obj1", {}), "duplicate id rejected");

ok(wp.listAll().length === 2, "2 waypoints");
ok(wp.listByKind("objective").length === 1, "1 objective");
ok(wp.listByKind("friend").length === 1, "1 friend");
ok(wp.listByKind("ghost").length === 0, "0 ghost");

const w1 = wp.get("obj1");
ok(w1.label === "Go here", "label preserved");
ok(w1.color === 0xffffff, "default color = white");

// 9. update
wp.update("friend_alice", { u: 10, v: 10, label: "Alice (moved)" });
const fa = wp.get("friend_alice");
ok(fa.u === 10 && fa.label === "Alice (moved)", "update modifies fields");
ok(wp.update("ghost", {}) === false, "update missing → false");

// 10. remove
ok(wp.remove("obj1") === true, "remove ok");
ok(wp.get("obj1") === null, "removed");
ok(wp.listAll().length === 1, "1 left");
ok(wp.remove("ghost") === false, "remove missing → false");

// 11. TTL countdown
wp.add("temp", { kind: "custom", u: 0, v: 0, ttl: 5 });
const r1 = wp.tick(2);
ok(r1.expired.length === 0, "not expired yet");
ok(wp.get("temp").ttl === 3, "ttl decremented to 3");

const r2 = wp.tick(4);
ok(r2.expired.includes("temp"), "expired after ttl runs out");
ok(wp.get("temp") === null, "removed from map");

// 12. Persistent waypoints (ttl=-1) ignore tick
wp.add("forever", { kind: "custom", u: 0, v: 0, ttl: -1 });
wp.tick(9999);
ok(wp.get("forever") !== null, "persistent waypoint survives tick");
ok(wp.get("forever").ttl === -1, "ttl unchanged");

// 13. Friend waypoint follows live position via update
wp.add("bob", { kind: "friend", u: 0, v: 0 });
for (let i = 0; i < 10; i++) {
  wp.update("bob", { u: i, v: i * 2 });
}
ok(wp.get("bob").u === 9 && wp.get("bob").v === 18, "friend position updates");

// 14. End-to-end: reveal as agent moves; waypoints become visible
const fog2 = FW.createFog(40, 40, 4);
const wp2 = FW.createWaypointSystem();
wp2.add("treasure", { kind: "objective", u: 30, v: 30 });

fog2.reveal({ u: 0, v: 0 }, 10);
ok(!fog2.isVisible(30, 30), "treasure not visible from origin");
ok(!fog2.isExplored(30, 30), "treasure not explored");

// Move closer
fog2.reveal({ u: 25, v: 25 }, 10);
ok(fog2.isVisible(30, 30), "treasure visible after moving close");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
