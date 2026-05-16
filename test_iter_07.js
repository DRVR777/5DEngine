// test_iter_07.js — ECS-lite envelope + registry.
// The whole point: adding a new entity type is registry-only. Core code
// (this test) never needs to know about specific types.
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const Entity   = require("./entity.js");
const Registry = require("./registry.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

// Load the browser engine in a sandbox so we can use WorldState
const code = fs.readFileSync(path.join(__dirname, "engine_browser.js"), "utf8");
const sandbox = { self: {} };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const { WorldState } = sandbox.self.GTAEngine;

// 1. createEntity makes envelope shape
const coin = Entity.createEntity("pickup", {
  position: { u: 5, v: 7, y: 1 },
  pickup:   { kind: "coin", value: 1 },
});
ok(coin.$header.$type === "pickup", "createEntity: $type set");
ok(coin.$header.$facets.includes("position"), "createEntity: position facet listed");
ok(coin.$header.$facets.includes("pickup"),   "createEntity: pickup facet listed");
ok(coin.position.u === 5 && coin.pickup.kind === "coin", "createEntity: facet data preserved");

// 2. addFacet appends and bumps version
const v0 = coin.$header.$version;
Entity.addFacet(coin, "hitbox", { kind: "aabb", w: 0.6, h: 0.6, d: 0.6 });
ok(coin.$header.$facets.includes("hitbox"), "addFacet: facet listed");
ok(coin.hitbox.kind === "aabb", "addFacet: data attached");
ok(coin.$header.$version === v0 + 1, "addFacet: version bumped");

// 3. hasFacet / getFacet
ok(Entity.hasFacet(coin, "hitbox") === true,  "hasFacet: present → true");
ok(Entity.hasFacet(coin, "ghost")  === false, "hasFacet: missing → false");
ok(Entity.getFacet(coin, "position").u === 5, "getFacet returns the data");

// 4. removeFacet drops + bumps version
Entity.removeFacet(coin, "hitbox");
ok(!Entity.hasFacet(coin, "hitbox"), "removeFacet: facet gone");
ok(coin.$header.$version === v0 + 2, "removeFacet: version bumped");

// 5. Registry: register a fake facet with a tick fn, verify it runs over entities
const reg = Registry.createRegistry();
let tickCount = 0;
reg.registerFacet("position", { tick: (e, dt) => { e.position.u += dt; tickCount++; } });
reg.registerFacet("pickup",   { tick: () => {} });
ok(reg.hasFacet("position"), "registry: facet registered");
ok(reg.facetNames().length === 2, "registry: facetNames lists both");

const world = new WorldState(1);
world.addEntity("coin1", coin);
world.addEntity("coin2", Entity.createEntity("pickup", {
  position: { u: 0, v: 0, y: 1 }, pickup: { kind: "coin", value: 1 },
}));
reg.tick(world, 0.1);
ok(tickCount === 2, `registry.tick ran position tick on both entities (${tickCount}/2)`);
ok(Math.abs(coin.position.u - 5.1) < 1e-9, "tick: position.u mutated by tick fn");

// 6. Adding a new type via registry alone — no core edit
reg.registerType("plane", {
  build: (facets) => Entity.createEntity("plane", facets),
});
const plane = reg.getType("plane").build({
  position: { u: 0, v: 0, y: 50 },
  vehicle:  { kind: "plane", maxSpeed: 80 },
});
ok(plane.$header.$type === "plane", "type registry: built new type without core edit");

// 7. Duplicate facet registration throws
let threw = false;
try { reg.registerFacet("position", { tick: () => {} }); } catch (e) { threw = true; }
ok(threw, "registry: duplicate facet registration throws");

// 8. App registry (for in-game computer)
reg.registerApp("hello", { init: () => ({ msg: "hi" }), render: (state) => state.msg });
ok(reg.appNames().includes("hello"), "app registry: app registered");
const app = reg.getApp("hello");
ok(app.render(app.init()) === "hi", "app registry: app init+render works");

// 9. WorldState envelope storage works
ok(world.entities.size === 2, "WorldState.entities holds 2 entities");
ok(world.getEntity("coin1") === coin, "WorldState.getEntity returns the entity");
world.removeEntity("coin2");
ok(world.entities.size === 1, "WorldState.removeEntity drops it");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
