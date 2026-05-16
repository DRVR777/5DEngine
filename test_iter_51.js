// test_iter_51.js — motorcycle, boat, helicopter as new vehicle types.
const V = require("./vehicle.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

// 1. New parts present
ok(V.getPart("part_body_motorcycle") !== null, "motorcycle body");
ok(V.getPart("part_body_boat") !== null, "boat body");
ok(V.getPart("part_body_helicopter") !== null, "helicopter body");
ok(V.getPart("part_engine_bike") !== null, "bike engine");
ok(V.getPart("part_engine_boat") !== null, "boat engine");
ok(V.getPart("part_engine_rotor") !== null, "rotor engine");
ok(V.getPart("part_wheel_bike") !== null, "bike wheel");
ok(V.getPart("part_hull_v") !== null, "v-hull");
ok(V.getPart("part_skid_helo") !== null, "helicopter skid");
ok(V.partNames().length >= 19, `>= 19 parts now (got ${V.partNames().length})`);

// 2. Motorcycle build: 1 body + 1 engine + 2 wheels
const moto = V.buildVehicle([
  "part_body_motorcycle", "part_engine_bike",
  "part_wheel_bike", "part_wheel_bike",
]);
ok(moto.kind === "motorcycle", `kind = motorcycle (got ${moto.kind})`);
ok(moto.complete === true, "motorcycle complete");
ok(moto.compatible === true, "motorcycle compatible");
ok(moto.stats.topSpeed === 35, "moto topSpeed = 35");

// Insufficient wheels
const motoBad = V.buildVehicle([
  "part_body_motorcycle", "part_engine_bike", "part_wheel_bike",
]);
ok(motoBad.complete === false, "motorcycle with 1 wheel incomplete");

// Wrong engine on motorcycle body
const motoMix = V.buildVehicle([
  "part_body_motorcycle", "part_engine_v8",
  "part_wheel_bike", "part_wheel_bike",
]);
// v8 has no vehicleKind specified so it should be admissible on any body
ok(motoMix.compatible === true, "engines without vehicleKind work on any body");

// Jet engine on motorcycle = incompatible (jet locked to plane)
const motoJet = V.buildVehicle([
  "part_body_motorcycle", "part_engine_jet",
  "part_wheel_bike", "part_wheel_bike",
]);
ok(motoJet.compatible === false, "jet engine on motorcycle → incompatible");

// 3. Boat build: 1 body + 1 engine + 1 hull
const boat = V.buildVehicle([
  "part_body_boat", "part_engine_boat", "part_hull_v",
]);
ok(boat.kind === "boat", "kind = boat");
ok(boat.complete === true, "boat complete with 1 hull as 'wheel'");
ok(boat.stats.topSpeed === 25, "boat topSpeed = 25");

// Boat engine on plane body
const boatPlane = V.buildVehicle([
  "part_body_plane", "part_engine_boat",
  "part_wheel_stock", "part_wheel_stock", "part_wheel_stock",
]);
ok(boatPlane.compatible === false, "boat engine on plane → incompatible");

// 4. Helicopter build: 1 body + 1 rotor + 2 skids
const helo = V.buildVehicle([
  "part_body_helicopter", "part_engine_rotor",
  "part_skid_helo", "part_skid_helo",
]);
ok(helo.kind === "helicopter", "kind = helicopter");
ok(helo.complete === true, "helicopter complete");
ok(helo.stats.topSpeed === 60, "helo topSpeed = 60");

// Rotor on car body → incompatible
const heloMix = V.buildVehicle([
  "part_body_sedan", "part_engine_rotor",
  "part_wheel_stock","part_wheel_stock","part_wheel_stock","part_wheel_stock",
]);
ok(heloMix.compatible === false, "rotor on sedan → incompatible");

// 5. Cost math sanity for new builds
const motoCost = V.totalCost([
  "part_body_motorcycle", "part_engine_bike", "part_wheel_bike", "part_wheel_bike",
]);
ok(motoCost === 500 + 400 + 80 + 80, `moto cost (got ${motoCost})`);

const heloCost = V.totalCost([
  "part_body_helicopter", "part_engine_rotor", "part_skid_helo", "part_skid_helo",
]);
ok(heloCost === 9000 + 12000 + 800 + 800, `helo cost (got ${heloCost})`);

// 6. Bike engine has high accel for its weight (light + punchy)
ok(moto.stats.accel > 15, `moto accel > 15 (got ${moto.stats.accel})`);

// 7. Helicopter is heavy — accel suffers
// (compare to motorcycle which should be lighter)
ok(helo.stats.weight > moto.stats.weight, "helicopter heavier than moto");

// 8. Empty build still kind=null
const empty = V.buildVehicle([]);
ok(empty.kind === null && empty.complete === false, "empty → no kind");

// 9. All 7 vehicle kinds reachable now (car, plane, motorcycle, boat, helicopter)
const kinds = new Set();
const recipes = [
  ["part_body_sedan", "part_engine_v6", "part_wheel_stock", "part_wheel_stock", "part_wheel_stock", "part_wheel_stock"],
  ["part_body_plane", "part_engine_jet", "part_wheel_stock", "part_wheel_stock", "part_wheel_stock"],
  ["part_body_motorcycle", "part_engine_bike", "part_wheel_bike", "part_wheel_bike"],
  ["part_body_boat", "part_engine_boat", "part_hull_v"],
  ["part_body_helicopter", "part_engine_rotor", "part_skid_helo", "part_skid_helo"],
];
for (const r of recipes) {
  const built = V.buildVehicle(r);
  if (built.complete) kinds.add(built.kind);
}
ok(kinds.size === 5, `5 distinct kinds buildable (got ${kinds.size}: ${[...kinds].join(",")})`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
