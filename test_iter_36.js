// test_iter_36.js — app store + 2 new apps (chat, world_browser).
const Store    = require("./app_store.js");
const Apps     = require("./app_framework.js");
const Comp     = require("./computer.js");
const Manifest = require("./manifest.js");
const Side     = require("./sidecar.js");
const Worlds   = require("./custom_worlds.js");
const Entity   = require("./entity.js");
const PP       = require("./physics_profile.js");
const Chat     = require("./apps/chat.js");
const WB       = require("./apps/world_browser.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

Apps._clearAll();

// 1. Publish two apps to the store
const store = Store.createStore();
const chatManifest = Manifest.makeManifest({
  kind: "app", content: { name: "chat", version: "1.0" },
  signer: { pubkey: "ed25519:dev" },
});
const wbManifest = Manifest.makeManifest({
  kind: "app", content: { name: "world_browser", version: "1.0" },
  signer: { pubkey: "ed25519:dev" },
});
ok(store.publish(chatManifest, Chat.APP).ok === true, "publish chat");
ok(store.publish(wbManifest,   WB.APP).ok === true,   "publish world_browser");
ok(store.listAll().length === 2, "store has 2 apps");

// 2. Wrong-kind manifest rejected
const badKind = Manifest.makeManifest({
  kind: "world", content: { x: 1 }, signer: { pubkey: "ed25519:dev" },
});
ok(store.publish(badKind, Chat.APP).ok === false, "non-app manifest rejected");

// 3. Missing definition rejected
ok(store.publish(chatManifest, null).ok === false, "missing definition rejected");

// 4. Search by name + category
ok(store.search("chat").length === 1, "search 'chat' finds 1");
ok(store.search("zzz").length === 0, "search miss → 0");
ok(store.search("", { category: "social" }).length === 1, "filter by social = 1");
ok(store.search("", { category: "explorer" }).length === 1, "filter by explorer = 1");
ok(store.categories().length === 2, "2 categories");

// 5. Install onto a computer (registers + adds to computer)
const pc = Comp.makeComputer();
const r1 = store.install("chat", pc, Apps);
ok(r1.ok === true, "install chat ok");
ok(pc.installedApps.includes("chat"), "computer has chat installed");
ok(Apps.getApp("chat") !== null, "framework has chat registered");
ok(store.get("chat").installCount === 1, "installCount incremented");

// Install twice — already_installed on the computer side
const r2 = store.install("chat", pc, Apps);
ok(r2.ok === false, "duplicate install on same computer fails");

// Install on a second computer increments count
const pc2 = Comp.makeComputer();
const r3 = store.install("chat", pc2, Apps);
ok(r3.ok === true, "install on pc2 ok");
ok(store.get("chat").installCount === 2, "installCount = 2");

// 6. Review system
ok(store.review("chat", "alice", 5, "great!").ok === true, "5-star review");
ok(store.review("chat", "bob", 3, "ok").ok === true, "3-star review");
ok(Math.abs(store.get("chat").rating - 4) < 1e-9, `avg rating = 4 (got ${store.get("chat").rating})`);
ok(store.getReviews("chat").length === 2, "2 reviews stored");

ok(store.review("chat", "x", 0, "").ok === false, "0 stars rejected");
ok(store.review("chat", "x", 6, "").ok === false, "6 stars rejected");
ok(store.review("missing_app", "x", 5, "").ok === false, "review missing app rejected");

// 7. Search results sort by installCount desc
const allHits = store.search("");
ok(allHits[0].appId === "chat", "chat ranks first (more installs)");

// 8. Chat app: send + receive via in-process sidecar
const sc = Side.createSidecar({ handle: "alice" });
const tokA = sc.grant(["pubsub:subscribe:chat/global", "pubsub:publish:chat/global"]);
const tokB = sc.grant(["pubsub:subscribe:chat/global", "pubsub:publish:chat/global"]);

Apps._clearAll();
Apps.registerApp(Chat.APP);
const chatA = Apps.instantiate("chat", pc, { handle: "alice", room: "global", sidecar: sc, sidecarToken: tokA }).instance;
const chatB = Apps.instantiate("chat", pc, { handle: "bob",   room: "global", sidecar: sc, sidecarToken: tokB }).instance;

Apps.input(chatB, { type: "subscribe" });   // bob listening
Apps.input(chatA, { type: "send", text: "hello bob" });
ok(chatA.state.messages.length === 1, "alice sent 1");
ok(chatB.state.messages.length === 1, "bob received via sidecar");
ok(chatB.state.messages[0].text === "hello bob", "bob got the right text");

// Chat empty render
const empty = Apps.instantiate("chat", pc, { handle: "x", room: "empty" }).instance;
ok(Apps.render(empty).includes("(no messages)"), "empty chat renders placeholder");

// Set room clears messages
Apps.input(chatA, { type: "set_room", room: "world1" });
ok(chatA.state.room === "world1" && chatA.state.messages.length === 0, "room change clears messages");

// 9. World browser: list, select, load
// Load WorldState from the browser-shim via vm sandbox
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const code = fs.readFileSync(path.join(__dirname, "engine_browser.js"), "utf8");
const sb = { self: {} }; vm.createContext(sb); vm.runInContext(code, sb);
const WorldStateCls = sb.self.GTAEngine.WorldState;

Apps.registerApp(WB.APP);
const m1 = { $schema: "5DEngine.world/1", worldId: "park", entities: [] };
const m2 = { $schema: "5DEngine.world/1", worldId: "city", entities: [] };
const wbInst = Apps.instantiate("world_browser", pc, {
  manifests: [{ name: "Park", manifest: m1 }, { name: "City", manifest: m2 }],
  worldsLoader: Worlds.loadIntoNewWorld,
  worldsDeps: { WorldState: WorldStateCls, createEntity: Entity.createEntity },
}).instance;

ok(Apps.render(wbInst).includes("Park") && Apps.render(wbInst).includes("City"),
   "world browser lists both manifests");

Apps.input(wbInst, { type: "select", index: 1 });
ok(wbInst.state.selected === 1, "select index 1");
ok(Apps.render(wbInst).includes("▶ City"), "render shows selection marker");

Apps.input(wbInst, { type: "load" });
ok(wbInst.state.lastResult.ok === true, `load city ok (${wbInst.state.lastResult.reason || "ok"})`);
ok(wbInst.state.lastResult.world.worldId === "city", "loaded world is city");

// Add manifest
Apps.input(wbInst, { type: "add", name: "Beach", manifest: { $schema: "5DEngine.world/1", worldId: "beach" } });
ok(wbInst.state.manifests.length === 3, "manifest added");

// Remove
Apps.input(wbInst, { type: "remove", index: 0 });
ok(wbInst.state.manifests.length === 2, "manifest removed");
ok(wbInst.state.manifests[0].name === "City", "Park gone, City first");

// Bad index
const before = wbInst.state.manifests.length;
Apps.input(wbInst, { type: "remove", index: 99 });
ok(wbInst.state.manifests.length === before, "bad index ignored");

// 10. Unpublish
ok(store.unpublish("chat") === true, "unpublish chat");
ok(store.get("chat") === null, "chat gone from store");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
