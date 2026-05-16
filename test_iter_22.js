// test_iter_22.js — identity + friends list.
const Id = require("./identity.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

// 1. Profile
const me   = Id.makeProfile("alice", { displayName: "Alice", worldId: "w1" });
const them = Id.makeProfile("bob",   { displayName: "Bob",   worldId: "w2" });
ok(me.handle === "alice", "profile handle set");
ok(me.pubkey === "pub_alice", "default pubkey from handle");
ok(me.capabilities.includes("chat"), "default capability includes chat");

// 2. Empty friends list
const fl = Id.createFriendsList();
ok(fl.listFriends().length === 0, "empty friends list");
ok(fl.listRequests().length === 0, "no requests");
ok(fl.isFriend("anyone") === false, "isFriend false initially");

// 3. Send & receive requests
const r1 = fl.sendRequest("bob", them);
ok(r1.ok === true, "send request to bob");
ok(fl.listRequests("outgoing").length === 1, "outgoing request listed");
ok(fl.listRequests("incoming").length === 0, "no incoming");

const r2 = fl.sendRequest("bob", them);
ok(r2.ok === false && r2.reason === "request_exists", "duplicate request rejected");

const carol = Id.makeProfile("carol");
const r3 = fl.receiveRequest(carol);
ok(r3.ok === true, "receive request from carol");
ok(fl.listRequests("incoming").length === 1, "incoming request from carol");

// 4. Accept / decline
const a1 = fl.acceptRequest("carol");
ok(a1.ok === true, "accepted carol");
ok(fl.isFriend("carol") === true, "carol is now a friend");
ok(fl.listRequests().filter(r => r.handle === "carol").length === 0, "request cleared");

const d1 = fl.declineRequest("bob");
ok(d1.ok === true, "decline outgoing bob (canceling our request)");
ok(fl.isFriend("bob") === false, "bob still not a friend");

// 5. Block + remove
const dave = Id.makeProfile("dave");
fl.receiveRequest(dave);
fl.acceptRequest("dave");
fl.block("dave");
ok(fl.isFriend("dave") === false, "blocked dave is not a friend (treated)");

const eve = Id.makeProfile("eve");
fl.receiveRequest(eve);
fl.acceptRequest("eve");
const rm = fl.removeFriend("eve");
ok(rm.ok === true, "removed eve");
ok(fl.isFriend("eve") === false, "eve gone");

// 6. setStatus + listFriends("online")
fl.setStatus("carol", "online", "w_main");
const frank = Id.makeProfile("frank");
fl.receiveRequest(frank);
fl.acceptRequest("frank");
fl.setStatus("frank", "offline");
const online = fl.listFriends("online");
ok(online.length === 1 && online[0].profile.handle === "carol",
   "only carol shows online");

// 7. friendsInWorld for proximity-based world merge
fl.setStatus("frank", "online", "w_main");
const grace = Id.makeProfile("grace");
fl.receiveRequest(grace); fl.acceptRequest("grace");
fl.setStatus("grace", "online", "w_other");
const inWMain = fl.friendsInWorld("w_main");
ok(inWMain.length === 2, `2 friends in w_main (got ${inWMain.length})`);
const handles = inWMain.map(f => f.profile.handle).sort();
ok(handles.join(",") === "carol,frank", `correct friends in w_main (${handles.join(",")})`);

// 8. Persistence via injected storage
const store = (function () {
  const data = {};
  return { read: k => data[k] || null, write: (k, v) => { data[k] = v; } };
})();
const fl2 = Id.createFriendsList({ storage: store });
fl2.receiveRequest(Id.makeProfile("hank"));
fl2.acceptRequest("hank");
ok(store.read("friends.json"), "storage was written");

// Reload from same storage
const fl3 = Id.createFriendsList({ storage: store });
ok(fl3.isFriend("hank") === true, "friends persisted across instances");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
