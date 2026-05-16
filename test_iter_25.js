// test_iter_25.js — custom world JSON manifest load + export round-trip.
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const Worlds = require("./custom_worlds.js");
const Entity = require("./entity.js");
const PP     = require("./physics_profile.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

const code = fs.readFileSync(path.join(__dirname, "engine_browser.js"), "utf8");
const sb = { self: {} }; vm.createContext(sb); vm.runInContext(code, sb);
const { WorldState } = sb.self.GTAEngine;

const deps = {
  WorldState,
  createEntity: Entity.createEntity,
  physicsProfileResolver: PP.get,
};

// 1. Validation
ok(Worlds.validate(null).ok === false, "null rejected");
ok(Worlds.validate({}).ok === false, "missing $schema rejected");
ok(Worlds.validate({ $schema: "wrong" }).ok === false, "wrong $schema rejected");
ok(Worlds.validate({ $schema: "5DEngine.world/1" }).ok === false, "missing worldId rejected");
ok(Worlds.validate({ $schema: "5DEngine.world/1", worldId: "x" }).ok === true, "minimal manifest ok");

// 2. Load minimal world
const min = Worlds.loadIntoNewWorld({
  $schema: "5DEngine.world/1",
  worldId: "minimal",
}, deps);
ok(min.ok === true, "minimal world loads");
ok(min.world.worldId === "minimal", "worldId preserved");
ok(min.entityCount === 0, "no entities yet");

// 3. Load with buildings + boundaries + entities
const manifest = {
  $schema: "5DEngine.world/1",
  worldId: "park",
  physicsProfile: "moon",
  spawn: { u: 0, v: 0, y: 0 },
  origin: { x: 0, y: 0, z: 0, u: 0, v: 0 },
  buildings: [
    { id: "shed",  rect: { u0: 5, v0: -2, u1: 9, v1: 2 }, height: 3, color: "#aabbcc" },
    { id: "tower", rect: { u0: -10, v0: 8, u1: -6, v1: 12 }, height: 12, color: "#445566" },
  ],
  boundaries: [
    { targetLayerId: 2, kind: "rect", params: { u0: 5, v0: -2, u1: 9, v1: 2 } },
    { targetLayerId: 3, kind: "circle", params: { cu: 0, cv: 0, r: 4 } },
  ],
  entities: [
    { id: "tree1", type: "prop", facets: { position: { u: -5, v: -5, y: 0 }, model: { kind: "tree" } } },
    { id: "npc1",  type: "npc",  facets: { position: { u: 3, v: 3, y: 0 }, ai: { state: "idle" } } },
  ],
};
const r = Worlds.loadIntoNewWorld(manifest, deps);
ok(r.ok === true, "park manifest loads");
ok(r.world.physicsProfile.name === "moon", "moon physics resolved by name");
ok(r.entityCount === 2, "2 entities loaded");
ok(r.boundaryCount === 2, "2 boundaries loaded");
ok(r.world._buildings.length === 2, "2 buildings preserved");
ok(r.world._spawn.u === 0, "spawn point preserved");

// 4. Boundary contains() works after load
const boundaries = r.world._boundaries;
ok(boundaries[0].contains(7, 0) === true, "rect boundary contains its center");
ok(boundaries[0].contains(0, 0) === false, "rect boundary excludes origin");
ok(boundaries[1].contains(0, 0) === true, "circle boundary at origin contains origin");
ok(boundaries[1].contains(10, 10) === false, "circle excludes far point");

// 5. Inline physics profile
const inlineProfile = Worlds.loadIntoNewWorld({
  $schema: "5DEngine.world/1",
  worldId: "custom_g",
  physicsProfile: { name: "low_g", gravity: -3, timeScale: 1, walkSpeed: 6, sprintSpeed: 11, jumpVelocity: 14 },
}, deps);
ok(inlineProfile.ok === true, "inline profile manifest loads");
ok(inlineProfile.world.physicsProfile.gravity === -3, "inline profile applied");

// 6. Export round-trip
const exported = Worlds.exportToManifest(r.world, { profileName: "moon" });
ok(exported.$schema === "5DEngine.world/1", "exported schema correct");
ok(exported.worldId === "park", "exported worldId");
ok(exported.physicsProfile === "moon", "exported profile name");
ok(exported.entities.length === 2, "exported 2 entities");
ok(exported.boundaries.length === 2, "exported 2 boundaries");

// Re-load the exported manifest
const reloaded = Worlds.loadIntoNewWorld(exported, deps);
ok(reloaded.ok === true, "exported manifest re-loads");
ok(reloaded.entityCount === 2, "re-load preserves entity count");
ok(reloaded.boundaryCount === 2, "re-load preserves boundary count");

// 7. Hot-reload: same manifest produces a fresh world
const fresh = Worlds.reload(manifest, deps);
ok(fresh.ok === true && fresh.world !== r.world, "reload returns a NEW world instance");
ok(fresh.entityCount === 2, "fresh has same entity count");

// 8. Missing deps rejected
const noDeps = Worlds.loadIntoNewWorld(manifest, null);
ok(noDeps.ok === false && noDeps.reason === "missing_deps", "missing deps rejected");

// 9. JSON serializability — round trip through JSON.stringify
const jsonStr = JSON.stringify(exported);
const parsed = JSON.parse(jsonStr);
const fromJson = Worlds.loadIntoNewWorld(parsed, deps);
ok(fromJson.ok === true, "JSON round-trip loads");
ok(fromJson.entityCount === 2, "JSON round-trip preserves entities");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
