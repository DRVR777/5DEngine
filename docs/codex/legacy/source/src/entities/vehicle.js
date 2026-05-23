// vehicle.js — vehicle facet + parts.
// Cars/planes/bikes are all `vehicle` entities with a `parts` facet listing
// what's installed. Adding a vehicle type is data, not code.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTAVehicle = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Part registry — each part declares stat contributions.
  const PARTS = {
    // engines
    part_engine_v4:    { kind: "engine",  topSpeed: 14, accel: 8,  weight: 80,  cost: 200 },
    part_engine_v6:    { kind: "engine",  topSpeed: 22, accel: 14, weight: 110, cost: 600 },
    part_engine_v8:    { kind: "engine",  topSpeed: 30, accel: 22, weight: 170, cost: 1500 },
    part_engine_jet:   { kind: "engine",  topSpeed: 80, accel: 35, weight: 240, cost: 8000, vehicleKind: "plane" },
    part_engine_bike:  { kind: "engine",  topSpeed: 35, accel: 28, weight: 50,  cost: 400, vehicleKind: "motorcycle" },
    part_engine_boat:  { kind: "engine",  topSpeed: 25, accel: 12, weight: 200, cost: 1200, vehicleKind: "boat" },
    part_engine_rotor: { kind: "engine",  topSpeed: 60, accel: 25, weight: 320, cost: 12000, vehicleKind: "helicopter" },
    // wheels
    part_wheel_stock:  { kind: "wheel",   grip: 1.0, weight: 12, cost: 40 },
    part_wheel_offroad:{ kind: "wheel",   grip: 0.85, weight: 16, cost: 120 },
    part_wheel_sport:  { kind: "wheel",   grip: 1.4, weight: 10, cost: 250 },
    part_wheel_bike:   { kind: "wheel",   grip: 1.2, weight: 6,  cost: 80 },
    // hulls/skids (act as "wheel" slot for boats/helicopters)
    part_hull_v:       { kind: "wheel",   grip: 0.6, weight: 60, cost: 600 },
    part_skid_helo:    { kind: "wheel",   grip: 0.0, weight: 25, cost: 800 },
    // bodies
    part_body_sedan:   { kind: "body",    armor: 50,  weight: 200, cost: 300, kind2: "car",        slots: { wheel: 4, engine: 1 } },
    part_body_truck:   { kind: "body",    armor: 100, weight: 400, cost: 700, kind2: "car",        slots: { wheel: 6, engine: 1 } },
    part_body_sport:   { kind: "body",    armor: 30,  weight: 150, cost: 1200, kind2: "car",       slots: { wheel: 4, engine: 1 } },
    part_body_plane:   { kind: "body",    armor: 40,  weight: 350, cost: 5000, kind2: "plane",     slots: { wheel: 3, engine: 1 } },
    part_body_motorcycle:{ kind: "body",  armor: 15,  weight: 80,  cost: 500,  kind2: "motorcycle", slots: { wheel: 2, engine: 1 } },
    part_body_boat:    { kind: "body",    armor: 60,  weight: 500, cost: 2500, kind2: "boat",       slots: { wheel: 1, engine: 1 } },
    part_body_helicopter:{ kind: "body",  armor: 35,  weight: 600, cost: 9000, kind2: "helicopter", slots: { wheel: 2, engine: 1 } },
  };

  function registerPart(name, def) {
    if (PARTS[name]) throw new Error(`part ${name} already registered`);
    PARTS[name] = def;
  }
  function getPart(name) { return PARTS[name] || null; }
  function partNames() { return Object.keys(PARTS); }

  // Build a vehicle facet from an installed parts array.
  // Returns { kind, parts, stats, complete }
  function buildVehicle(installedParts) {
    let body = null, engine = null;
    const wheels = [];
    const otherParts = [];
    for (const p of installedParts || []) {
      const def = PARTS[p];
      if (!def) continue;
      if (def.kind === "body")   body = { name: p, def };
      else if (def.kind === "engine") engine = { name: p, def };
      else if (def.kind === "wheel")  wheels.push({ name: p, def });
      else otherParts.push({ name: p, def });
    }

    const kind = body ? body.def.kind2 : null;
    const required = body ? (body.def.slots || {}) : {};
    const haveEngine = engine ? 1 : 0;
    const haveWheels = wheels.length;

    // Plane-only engine on car body? incompatible
    let compatible = true;
    if (engine && engine.def.vehicleKind && body && engine.def.vehicleKind !== body.def.kind2) {
      compatible = false;
    }

    const complete = !!body && haveEngine === (required.engine || 0)
      && haveWheels >= (required.wheel || 0) && compatible;

    // Compose stats
    let topSpeed = 0, accel = 0, weight = 0, armor = 0, grip = 0;
    if (body)   { weight += body.def.weight; armor += body.def.armor; }
    if (engine) { topSpeed += engine.def.topSpeed; accel += engine.def.accel; weight += engine.def.weight; }
    for (const w of wheels) { weight += w.def.weight; grip += w.def.grip; }
    if (wheels.length > 0) grip /= wheels.length;
    // Heavier vehicle = lower accel
    if (weight > 0) accel = accel * (200 / Math.max(200, weight));

    return {
      kind,
      parts: installedParts.slice(),
      complete,
      compatible,
      stats: {
        topSpeed: +topSpeed.toFixed(2),
        accel:    +accel.toFixed(2),
        weight:   +weight.toFixed(2),
        armor:    +armor.toFixed(2),
        grip:     +grip.toFixed(2),
      },
    };
  }

  // Cost = sum of part costs.
  function totalCost(installedParts) {
    let c = 0;
    for (const p of installedParts || []) {
      const def = PARTS[p];
      if (def && typeof def.cost === "number") c += def.cost;
    }
    return c;
  }

  return { PARTS, registerPart, getPart, partNames, buildVehicle, totalCost };
});
