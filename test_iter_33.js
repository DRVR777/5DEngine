// test_iter_33.js — sector grid + HINT/PREPARE/COMMIT handoff.
const Dom = require("./domain.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

// 1. Sector grid math
const g = Dom.createSectorGrid(200);
ok(g.cellSize === 200, "cellSize stored");
ok(g.sectorOfPos({ u: 50,  v: 50  }).sx === 0, "(50,50) → sector (0,0)");
ok(g.sectorOfPos({ u: 250, v: 50  }).sx === 1, "(250,50) → sector (1,0)");
ok(g.sectorOfPos({ u: -50, v: -50 }).sx === -1, "(-50,-50) → sector (-1,-1)");

// 2. Claim + getOwner
g.claimSector(0, 0, "node_A");
ok(g.getOwner({ u: 50, v: 50 }) === "node_A", "owner of sector 0,0 = A");
ok(g.getOwner({ u: 999, v: 999 }) === null, "unclaimed → null");

const cl2 = g.claimSector(0, 0, "node_B");
ok(cl2.ok === false && cl2.reason === "owned_by_other", "double-claim rejected");

// Same node re-claiming is fine
const cl3 = g.claimSector(0, 0, "node_A");
ok(cl3.ok === true, "same-node re-claim ok");

// 3. addReplica
g.addReplica(0, 0, "node_C");
const s00 = g.ensureSector(0, 0);
ok(s00.replicas.has("node_C"), "node_C is replica of 0,0");
// Owner is not replica
ok(!s00.replicas.has("node_A"), "owner is not in replicas set");

// 4. Handoff: HINT when player approaches sector edge
g.claimSector(1, 0, "node_B");  // neighbor sector
const h = Dom.createHandoff(g);

// Player at (190, 50): inside sector 0,0 but within 10 of right edge (margin=40)
const hints = h.hint("alice", { u: 190, v: 50 }, "node_B");
ok(hints.length === 1, `1 hint produced (got ${hints.length})`);
ok(hints[0].targetSx === 1 && hints[0].targetSy === 0, "hint targets (1,0)");
ok(hints[0].state === "HINT", "state = HINT");
ok(h.status("alice", 1, 0) === "HINT", "status reflects HINT");

// 5. PREPARE
const p = h.prepare("alice", 1, 0, /*tick*/ 100);
ok(p.ok === true, "prepare ok");
ok(p.transfer.state === "PREPARE", "state advanced to PREPARE");

// Can't prepare again
const p2 = h.prepare("alice", 1, 0, 101);
ok(p2.ok === false, "re-prepare rejected");

// 6. COMMIT — node_B takes auth, node_A becomes replica
const c = h.commit("alice", 1, 0, "node_B");
ok(c.ok === true, "commit ok");
ok(c.transfer.state === "COMMIT", "state advanced to COMMIT");
ok(g.getOwner({ u: 250, v: 50 }) === "node_B", "owner of (1,0) is now node_B");

// 7. Mid-cell positions don't trigger hints
const noHint = h.hint("bob", { u: 100, v: 100 }, "node_B");
ok(noHint.length === 0, "mid-cell → no hint");

// 8. Diagonal corner produces multiple hints
const corner = h.hint("carol", { u: 195, v: 195 }, "node_B");
ok(corner.length === 2, `corner produces 2 hints (got ${corner.length})`);

// 9. Cannot commit without prepare
const noPrep = h.commit("dave", 5, 5, "node_X");
ok(noPrep.ok === false && noPrep.reason === "not_prepared",
   "commit without prepare rejected");

// 10. Clear transfer state
h.clear("alice", 1, 0);
ok(h.status("alice", 1, 0) === null, "transfer cleared");

// 11. Negative coords work too
const negG = Dom.createSectorGrid(100);
ok(negG.sectorOfPos({ u: -1, v: -1 }).sx === -1, "negative pos → -1 sector");
ok(negG.sectorOfPos({ u: -100, v: 0 }).sx === -1, "exactly -100 → still -1 (floor)");
ok(negG.sectorOfPos({ u: -101, v: 0 }).sx === -2, "-101 → -2 sector");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
