// test_iter_123.js — garage: store + paint + tuning + parts + stats.
const G = require("./garage.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

function mkEcon() {
  const bal = new Map();
  const k = (p, c) => p + "::" + c;
  return {
    deposit: (p, c, a) => bal.set(k(p,c), (bal.get(k(p,c)) || 0) + a),
    withdraw: (p, c, a) => {
      const cur = bal.get(k(p,c)) || 0;
      if (cur < a) return { ok: false };
      bal.set(k(p,c), cur - a);
      return { ok: true };
    },
    balance: (p, c) => bal.get(k(p,c)) || 0,
  };
}

// 1. PART_SLOTS + tunings
ok(G.PART_SLOTS.length === 7, "7 slots");
ok(G.PART_SLOTS.includes("engine"), "engine");
ok(G.PART_SLOTS.includes("nitro"), "nitro");

// 2. storeVehicle
const sys = G.createSystem();
const v1 = sys.storeVehicle("alice", { model: "sports_car" });
ok(v1.ok && v1.vehicleId === "veh_1", "stored");
ok(v1.slot.tuning === "stock", "default stock tuning");
ok(v1.slot.paint.primary === "#ffffff", "default white");

// Duplicate id
ok(sys.storeVehicle("alice", { id: v1.vehicleId, model: "x" }).ok === false, "duplicate");

// 3. Max slots
const sys2 = G.createSystem({ config: { maxSlotsPerGarage: 2 } });
sys2.storeVehicle("p", {});
sys2.storeVehicle("p", {});
ok(sys2.storeVehicle("p", {}).ok === false, "full");

// 4. listVehicles
sys.storeVehicle("alice", { model: "truck" });
ok(sys.listVehicles("alice").length === 2, "2 alice vehicles");
ok(sys.listVehicles("bob").length === 0, "0 bob");

// 5. paint
const pa = sys.paint("alice", v1.vehicleId, { primary: "#ff0000", finish: "matte" });
ok(pa.ok === true, "paint ok");
ok(pa.paint.primary === "#ff0000", "red");
ok(pa.paint.finish === "matte", "matte");

ok(sys.paint("ghost", v1.vehicleId, {}).ok === false, "no vehicle");
ok(sys.paint("alice", "ghost", {}).ok === false, "no vehicle id");

// 6. setTuning
ok(sys.setTuning("alice", v1.vehicleId, "sport").ok === true, "tune sport");
ok(sys.getVehicle("alice", v1.vehicleId).tuning === "sport", "tuning set");
ok(sys.setTuning("alice", v1.vehicleId, "ghost_tune").ok === false, "no tuning");
ok(sys.setTuning("alice", "ghost", "sport").ok === false, "no vehicle");

// 7. registerPart
ok(sys.registerPart({ id: "v8", slot: "engine", stats: { accel: 30, topSpeed: 20 }, cost: 5000 }).ok,
   "register v8");
ok(sys.registerPart({ slot: "engine" }).ok === false, "missing id");
ok(sys.registerPart({ id: "x", slot: "alien" }).ok === false, "bad slot");
ok(sys.registerPart({ id: "v8", slot: "engine" }).ok === false, "duplicate");

sys.registerPart({ id: "racing_wheels", slot: "wheels", stats: { grip: 25 }, cost: 800 });
sys.registerPart({ id: "armor_plate", slot: "armor", stats: { armor: 50 }, cost: 2000 });

ok(sys.listParts().length === 3, "3 parts");
ok(sys.listParts("engine").length === 1, "1 engine part");
ok(sys.listParts("ghost").length === 0, "no ghost slot parts");

// 8. installPart
const econ = mkEcon();
econ.deposit("alice", "coin", 100000);
const inst1 = sys.installPart("alice", v1.vehicleId, "v8", { economy: econ });
ok(inst1.ok === true, "installed v8");
ok(sys.getVehicle("alice", v1.vehicleId).parts.engine === "v8", "v8 in engine slot");
ok(econ.balance("alice", "coin") === 95000, "paid 5000");

// Insufficient funds
const econPoor = mkEcon();
const inst2 = sys.installPart("alice", v1.vehicleId, "racing_wheels", { economy: econPoor });
ok(inst2.ok === false && inst2.reason === "insufficient_funds", "broke");

// No part
ok(sys.installPart("alice", v1.vehicleId, "ghost_part").ok === false, "no part");

// No vehicle
ok(sys.installPart("alice", "ghost", "v8").ok === false, "no vehicle");

// 9. Installing in same slot replaces
sys.registerPart({ id: "v6", slot: "engine", stats: { accel: 20 }, cost: 0 });
sys.installPart("alice", v1.vehicleId, "v6");
ok(sys.getVehicle("alice", v1.vehicleId).parts.engine === "v6", "v6 replaced v8");

// 10. uninstallPart
ok(sys.uninstallPart("alice", v1.vehicleId, "engine").ok === true, "uninstall");
ok(sys.getVehicle("alice", v1.vehicleId).parts.engine === undefined, "slot empty");
ok(sys.uninstallPart("alice", v1.vehicleId, "engine").ok === false, "no part installed");

// 11. getStats computes base + tuning + parts
sys.registerPart({ id: "turbo", slot: "engine", stats: { accel: 50, topSpeed: 30 }, cost: 0 });
sys.installPart("alice", v1.vehicleId, "turbo");
sys.setTuning("alice", v1.vehicleId, "drag");
const stats = sys.getStats("alice", v1.vehicleId);
// base: accel 50, topSpeed 100, grip 50, armor 100
// drag tuning: accel +25, topSpeed +15, grip -10
// turbo: accel +50, topSpeed +30
ok(stats.accel === 125, `accel = 50+25+50 = 125 (got ${stats.accel})`);
ok(stats.topSpeed === 145, `topSpeed = 100+15+30 = 145 (got ${stats.topSpeed})`);
ok(stats.grip === 40, `grip = 50-10 = 40 (got ${stats.grip})`);

// 12. Multiple parts stack across slots
sys.installPart("alice", v1.vehicleId, "racing_wheels");
const stats2 = sys.getStats("alice", v1.vehicleId);
ok(stats2.grip === 65, `grip = 40+25 = 65 (got ${stats2.grip})`);

// 13. Stats null for missing vehicle
ok(sys.getStats("ghost", "x") === null, "no vehicle null stats");

// 14. removeVehicle
const v2 = sys.storeVehicle("alice", { model: "tmp" });
ok(sys.removeVehicle("alice", v2.vehicleId).ok === true, "remove");
ok(sys.getVehicle("alice", v2.vehicleId) === null, "gone");
ok(sys.removeVehicle("alice", v2.vehicleId).ok === false, "double remove");
ok(sys.removeVehicle("ghost", "x").ok === false, "no garage");

// 15. registerTuning + listTunings
ok(sys.registerTuning({ id: "monster_truck", name: "Monster", accel: 5, grip: 50, topSpeed: -20 }).ok,
   "monster tune");
ok(sys.registerTuning({ id: "stock" }).ok === false, "duplicate tune");
ok(sys.registerTuning({}).ok === false, "missing id");
ok(sys.listTunings().length >= 6, `≥6 tunings (got ${sys.listTunings().length})`);

// 16. Custom tuning stats applied
sys.setTuning("alice", v1.vehicleId, "monster_truck");
const monStats = sys.getStats("alice", v1.vehicleId);
// base 50 + monster_truck.accel 5 + turbo 50 = 105
ok(monStats.accel === 105, `monster accel = 105 (got ${monStats.accel})`);

// 17. recentEvents
ok(sys.recentEvents().length > 0, "events");
ok(sys.recentEvents().some(e => e.kind === "store"), "store events");
ok(sys.recentEvents().some(e => e.kind === "install_part"), "install events");

// 18. getConfig
ok(sys.getConfig().maxSlotsPerGarage > 0, "config");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
