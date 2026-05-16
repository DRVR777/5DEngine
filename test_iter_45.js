// test_iter_45.js — save/load game state via signed manifests.
const SL = require("./save_load.js");
const Manifest = require("./manifest.js");
const Entity = require("./entity.js");
const Health = require("./health.js");
const PP = require("./physics_profile.js");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

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

// 1. snapshot captures world + extras
const world = new WorldState(1, { worldId: "save_test", physicsProfile: PP.get("moon") });
world.addEntity("hero", Entity.createEntity("player", {
  position: { u: 5, v: 7, y: 0 },
  health: Health.makeHealth(100, { current: 75 }),
}));
world.addEntity("npc1", Entity.createEntity("npc", {
  position: { u: -3, v: 4, y: 0 },
  ai: { state: "idle" },
}));

const extras = { score: 42, inventory: ["coin", "coin", "coin"] };
const snap = SL.snapshot(world, extras);
ok(snap.$schema === "5DEngine.savegame/1", "schema set");
ok(snap.world.worldId === "save_test", "worldId captured");
ok(snap.world.physicsProfileName === "moon", "profile name captured");
ok(snap.world.entities.length === 2, "2 entities captured");
ok(snap.extras.score === 42, "extras preserved");

// 2. snapshot is JSON-serializable
const json = JSON.stringify(snap);
const parsed = JSON.parse(json);
ok(parsed.world.entities[0].facets.position.u === 5, "JSON round-trip preserves position");

// 3. restore rebuilds the world
const r = SL.restore(snap, deps);
ok(r.ok === true, "restore ok");
ok(r.world.worldId === "save_test", "worldId restored");
ok(r.world.physicsProfile.name === "moon", "profile restored by name");
ok(r.world.entities.size === 2, "2 entities restored");
const heroR = r.world.getEntity("hero");
ok(heroR.position.u === 5 && heroR.position.v === 7, "hero position restored");
ok(heroR.health.current === 75, "hero hp restored");
ok(r.extras.score === 42, "extras passed through");

// 4. Missing deps rejected
ok(SL.restore(snap, null).ok === false, "null deps rejected");
ok(SL.restore({ $schema: "wrong" }, deps).ok === false, "wrong schema rejected");

// 5. Save through a Manifest store
const store = Manifest.createStore();
const signer = { pubkey: "ed25519:player1" };

const saveR = SL.saveToStore(world, extras, { Manifest, store, signer });
ok(saveR.ok === true, "saveToStore ok");
ok(typeof saveR.manifestId === "string", "manifestId returned");
ok(store.has(saveR.manifestId), "manifest in store");

// 6. Load back
const loadR = SL.loadFromStore(saveR.manifestId, { Manifest, store, restoreDeps: deps });
ok(loadR.ok === true, "loadFromStore ok");
ok(loadR.world.entities.size === 2, "2 entities loaded");
ok(loadR.world.getEntity("hero").health.current === 75, "hero hp restored from store");

// Load missing → fail
const noSuch = SL.loadFromStore("blake3:ghost", { Manifest, store, restoreDeps: deps });
ok(noSuch.ok === false && noSuch.reason === "not_found", "missing manifest rejected");

// 7. Slot manager
const slots = SL.createSlotManager({ store, Manifest });
slots.save("slot1", world, { msg: "checkpoint 1" }, signer);
slots.save("slot2", world, { msg: "checkpoint 2" }, signer);
ok(slots.listSlots().length === 2, "2 slots saved");
ok(slots.listSlots().includes("slot1"), "slot1 listed");

const s1 = slots.load("slot1", deps);
ok(s1.ok === true, "slot1 loaded");
ok(s1.extras.msg === "checkpoint 1", "extras carry per-slot");

const sBad = slots.load("nonexistent", deps);
ok(sBad.ok === false, "nonexistent slot rejected");

slots.deleteSlot("slot1");
ok(!slots.listSlots().includes("slot1"), "slot1 deleted");

// 8. End-to-end: modify world, save, load fresh, verify isolation
const w2 = new WorldState(1, { worldId: "w2" });
w2.addEntity("e1", Entity.createEntity("foo", { position: { u: 10, v: 10 } }));
const saveBefore = SL.saveToStore(w2, {}, { Manifest, store, signer });

w2.getEntity("e1").position.u = 999;  // mutate after save
w2.addEntity("e2", Entity.createEntity("bar", { position: { u: 0, v: 0 } }));

const r2 = SL.loadFromStore(saveBefore.manifestId, { Manifest, store, restoreDeps: deps });
ok(r2.ok === true, `round-trip load ok (reason=${r2.reason || "ok"})`);
ok(r2.world.entities.size === 1, "saved world only has 1 entity");
ok(r2.world.getEntity("e1").position.u === 10, "saved entity at original pos (mutation isolated)");

// 9. Tampered savegame → rejected
const tamperedManifest = JSON.parse(JSON.stringify(store.get(saveBefore.manifestId)));
tamperedManifest.content.world.entities.push({ id: "injected", type: "evil", facets: {} });
// Put tampered manifest in store directly to bypass put-verification
store.list().forEach(id => {});
const fakeStore = { get: () => tamperedManifest, has: () => true, put: () => ({ ok: true }), list: () => [], size: () => 0 };
const tampered = SL.loadFromStore(tamperedManifest.id, { Manifest, store: fakeStore, restoreDeps: deps });
ok(tampered.ok === false, "tampered savegame rejected");
ok(tampered.reason.startsWith("verify_failed"), "verify failure surfaced");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
