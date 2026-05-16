// test_iter_16.js — vehicle facet + parts.
const V = require("./vehicle.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

// 1. Parts registry
ok(V.getPart("part_engine_v6") !== null, "engine v6 registered");
ok(V.getPart("part_wheel_sport") !== null, "wheel sport registered");
ok(V.getPart("part_body_sedan") !== null, "body sedan registered");
ok(V.partNames().length >= 9, `>= 9 parts (${V.partNames().length})`);

// 2. Build a complete sedan: 1 body + 1 engine + 4 wheels
const sedan = V.buildVehicle([
  "part_body_sedan", "part_engine_v6",
  "part_wheel_stock", "part_wheel_stock", "part_wheel_stock", "part_wheel_stock",
]);
ok(sedan.kind === "car", "kind = car");
ok(sedan.complete === true, `sedan complete (got ${sedan.complete})`);
ok(sedan.compatible === true, "sedan parts compatible");
ok(sedan.stats.topSpeed === 22, `topSpeed = 22 (engine v6)`);
ok(sedan.stats.weight > 200, `weight includes parts (${sedan.stats.weight})`);
ok(sedan.stats.armor === 50, `armor = 50 (sedan body)`);
ok(sedan.stats.grip === 1.0, `grip avg = 1.0 (stock wheels)`);

// 3. Incomplete car: missing wheels
const skeleton = V.buildVehicle(["part_body_sedan", "part_engine_v6"]);
ok(skeleton.complete === false, "missing wheels → incomplete");

// 4. Missing engine
const noEngine = V.buildVehicle([
  "part_body_sedan",
  "part_wheel_stock", "part_wheel_stock", "part_wheel_stock", "part_wheel_stock",
]);
ok(noEngine.complete === false, "missing engine → incomplete");

// 5. Plane requires plane body
const planeMis = V.buildVehicle([
  "part_body_sedan", "part_engine_jet",
  "part_wheel_stock", "part_wheel_stock", "part_wheel_stock", "part_wheel_stock",
]);
ok(planeMis.compatible === false, "jet engine on sedan body → incompatible");

const plane = V.buildVehicle([
  "part_body_plane", "part_engine_jet",
  "part_wheel_stock", "part_wheel_stock", "part_wheel_stock",
]);
ok(plane.kind === "plane", `plane kind correct`);
ok(plane.complete === true, `plane complete (got ${plane.complete})`);
ok(plane.compatible === true, "plane jet engine compatible");
ok(plane.stats.topSpeed === 80, "plane topSpeed = 80");

// 6. Truck has 6 wheel slots
const truckOk = V.buildVehicle([
  "part_body_truck", "part_engine_v8",
  "part_wheel_offroad","part_wheel_offroad","part_wheel_offroad",
  "part_wheel_offroad","part_wheel_offroad","part_wheel_offroad",
]);
ok(truckOk.complete === true, "truck with 6 wheels complete");

const truckShort = V.buildVehicle([
  "part_body_truck", "part_engine_v8",
  "part_wheel_stock","part_wheel_stock","part_wheel_stock","part_wheel_stock",
]);
ok(truckShort.complete === false, "truck with only 4 wheels incomplete");

// 7. Heavier vehicle has lower accel
const sport = V.buildVehicle([
  "part_body_sport", "part_engine_v8",
  "part_wheel_sport","part_wheel_sport","part_wheel_sport","part_wheel_sport",
]);
const heavyTruck = V.buildVehicle([
  "part_body_truck", "part_engine_v8",
  "part_wheel_offroad","part_wheel_offroad","part_wheel_offroad",
  "part_wheel_offroad","part_wheel_offroad","part_wheel_offroad",
]);
ok(sport.stats.accel > heavyTruck.stats.accel,
   `sport accel > truck (sport=${sport.stats.accel}, truck=${heavyTruck.stats.accel})`);

// 8. totalCost
const cost = V.totalCost([
  "part_body_sport", "part_engine_v8",
  "part_wheel_sport","part_wheel_sport","part_wheel_sport","part_wheel_sport",
]);
ok(cost === 1200 + 1500 + 250*4, `cost = ${cost} (1200+1500+1000)`);

// 9. Custom part registration
V.registerPart("part_engine_electric", { kind: "engine", topSpeed: 25, accel: 30, weight: 60, cost: 3500 });
const ev = V.buildVehicle([
  "part_body_sport", "part_engine_electric",
  "part_wheel_sport","part_wheel_sport","part_wheel_sport","part_wheel_sport",
]);
ok(ev.complete === true, "EV with new engine compatible");
ok(ev.stats.topSpeed === 25, "EV topSpeed from new engine");

let threw = false;
try { V.registerPart("part_engine_v6", {}); } catch (e) { threw = true; }
ok(threw, "duplicate part registration throws");

// 10. Empty install → kind null, complete false
const empty = V.buildVehicle([]);
ok(empty.kind === null && empty.complete === false, "empty parts list → not a vehicle");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
