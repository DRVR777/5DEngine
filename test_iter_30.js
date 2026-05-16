// test_iter_30.js — ObjectStudio + FriendFinder apps + IPC.
const Apps = require("./app_framework.js");
const Comp = require("./computer.js");
const Reg  = require("./registry.js");
const Id   = require("./identity.js");
const ObjectStudio = require("./apps/object_studio.js");
const FriendFinder = require("./apps/friend_finder.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

Apps._clearAll();
Apps.registerApp(ObjectStudio.APP);
Apps.registerApp(FriendFinder.APP);

ok(Apps.getApp("object_studio") !== null, "ObjectStudio registered");
ok(Apps.getApp("friend_finder") !== null, "FriendFinder registered");

// 1. ObjectStudio: upload OBJ → register as entity type → instance has hitbox
const pc = Comp.makeComputer();
Comp.installApp(pc, "object_studio");
Comp.sit(pc, "alice");
const launched = Apps.launchOnComputer(pc, "object_studio", "alice");
ok(launched.ok === true, "object_studio launched");
const inst = launched.instance;
ok(Apps.render(inst) === "ObjectStudio — no uploads yet.", "initial render shows empty state");

const registry = Reg.createRegistry();
Apps.input(inst, {
  type: "upload",
  filename: "ufo.obj",
  content: "v -1 -1 -1\nv 1 1 1\nv 0 0 0\n",
  registry,
});
ok(inst.state.uploads.length === 1, "1 upload tracked");
ok(inst.state.uploads[0].format === "obj", "format = obj");
ok(inst.state.uploads[0].registeredAs === "ufo", "registered as 'ufo'");
ok(inst.state.lastError === null, "no error");
ok(registry.getType("ufo") !== null, "ufo type in registry");

// Spawn an instance — auto hitbox from the upload
const ufoEntity = registry.getType("ufo").build({ position: { u: 5, v: 5, y: 0 } });
ok(ufoEntity.hitbox.w === 2, `instance hitbox w from AABB (got ${ufoEntity.hitbox.w})`);

// 2. Name collision auto-renames
Apps.input(inst, {
  type: "upload",
  filename: "ufo.obj",
  content: "v 0 0 0\nv 5 5 5\n",
  registry,
});
ok(inst.state.uploads.length === 2, "2 uploads now");
ok(inst.state.uploads[1].registeredAs === "ufo_1", "second collision auto-renamed");
ok(registry.typeNames().includes("ufo_1"), "ufo_1 in registry");

// 3. Bad upload doesn't crash
Apps.input(inst, { type: "upload", filename: "bad.png" });
ok(inst.state.lastError === "unsupported_format", "lastError set on bad upload");

// 4. Computer file system carries the upload roster
const fsList = Comp.fsRead(pc, "object_studio.uploads");
ok(Array.isArray(fsList) && fsList.length >= 2, "fs has upload roster");

// 5. FriendFinder: instantiate with injected friends list
const fl = Id.createFriendsList();
fl.receiveRequest(Id.makeProfile("bob",   { worldId: "w_main" })); fl.acceptRequest("bob");
fl.receiveRequest(Id.makeProfile("carol", { worldId: "w_main" })); fl.acceptRequest("carol");
fl.receiveRequest(Id.makeProfile("dave",  { worldId: "w_other" })); fl.acceptRequest("dave");
fl.setStatus("bob",   "online", "w_main");
fl.setStatus("carol", "offline");
fl.setStatus("dave",  "online", "w_other");

Comp.installApp(pc, "friend_finder");
const ff = Apps.instantiate("friend_finder", pc, { friendsList: fl }).instance;
const r0 = Apps.render(ff);
ok(r0.includes("bob") && r0.includes("carol") && r0.includes("dave"),
   "all 3 friends rendered");

// 6. Filter to online only
Apps.input(ff, { type: "set_filter", value: "online" });
const r1 = Apps.render(ff);
ok(r1.includes("bob")  && r1.includes("dave"), "online filter shows bob + dave");
ok(!r1.includes("carol"), "online filter hides carol");

// 7. Filter to offline only
Apps.input(ff, { type: "set_filter", value: "offline" });
const r2 = Apps.render(ff);
ok(r2.includes("carol") && !r2.includes("bob"), "offline filter shows only carol");

// 8. Send + accept request
Apps.input(ff, { type: "set_filter", value: "all" });
Apps.input(ff, { type: "send_request", handle: "eve", profile: Id.makeProfile("eve") });
ok(fl._requestsMap.has("eve"), "send_request goes through");

// Receive a request from frank, accept via the app
fl.receiveRequest(Id.makeProfile("frank"));
Apps.input(ff, { type: "accept_request", handle: "frank" });
ok(fl.isFriend("frank"), "accept_request adds friend");

Apps.input(ff, { type: "remove_friend", handle: "frank" });
ok(!fl.isFriend("frank"), "remove_friend drops friend");

// Block via app
Apps.input(ff, { type: "block", handle: "dave" });
ok(!fl.isFriend("dave"), "block via app removes friend status");

// 9. IPC: ObjectStudio + FriendFinder coexist on the same computer
const ipcReply = Apps.ipc(inst, "friend_finder", { type: "online_count", friendsList: fl });
ok(ipcReply.ok === true, "IPC to friend_finder ok");
ok(typeof ipcReply.reply.count === "number", "IPC reply has count");

// 10. Empty friends list
const empty = Apps.instantiate("friend_finder", pc, { friendsList: Id.createFriendsList() }).instance;
ok(Apps.render(empty).includes("no friends"), "empty list renders message");

// 11. Unknown event ignored
const before = JSON.stringify(ff.state);
Apps.input(ff, { type: "fart" });
ok(JSON.stringify(ff.state) === before, "unknown event leaves state untouched");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
