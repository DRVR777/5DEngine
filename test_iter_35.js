// test_iter_35.js — sidecar capability-checked I/O.
const Side = require("./sidecar.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

const sc = Side.createSidecar({ handle: "alice", pubkey: "ed25519:alice" });

// 1. No token → all calls denied
ok(sc.storageRead(null, "x").ok === false, "no token: storage.read denied");
ok(sc.storageWrite(null, "x", "v").ok === false, "no token: storage.write denied");
ok(sc.identityWho(null).ok === false, "no token: identity.who denied");

// 2. Grant + use scoped capability
const tokRead = sc.grant(["storage:read:config.json"]);
ok(sc.capsOf(tokRead).length === 1, "1 cap on tokRead");
ok(sc.storageRead(tokRead, "config.json").ok === true, "read with exact cap ok");
ok(sc.storageRead(tokRead, "secrets.json").ok === false, "read with wrong key denied");
ok(sc.storageWrite(tokRead, "config.json", "x").ok === false, "write denied (only read granted)");

// 3. Wildcard cap
const tokAdmin = sc.grant(["storage:read:*", "storage:write:*", "storage:list"]);
ok(sc.storageWrite(tokAdmin, "a", "1").ok === true, "wildcard write ok");
ok(sc.storageWrite(tokAdmin, "b", "2").ok === true, "wildcard write 2 ok");
ok(sc.storageRead(tokAdmin, "a").value === "1", "wildcard read returns value");
ok(sc.storageList(tokAdmin).keys.length === 2, "list returns 2 keys");
ok(sc.storageList(tokAdmin, "a").keys.length === 1, "list with prefix filter");

// 4. Read of missing key returns null
ok(sc.storageRead(tokAdmin, "missing").value === null, "missing key → null (not denied)");

// 5. Delete with cap
ok(sc.storageDelete(tokAdmin, "a").ok === true, "delete with cap ok");
ok(sc.storageList(tokAdmin).keys.length === 1, "list after delete = 1");

// 6. Pubsub subscribe + publish
const tokSub = sc.grant(["pubsub:subscribe:room/*"]);
const tokPub = sc.grant(["pubsub:publish:room/*"]);
const received = [];
const sub = sc.pubsubSubscribe(tokSub, "room/world1", (m) => received.push(m));
ok(sub.ok === true, "subscribe ok");

const p = sc.pubsubPublish(tokPub, "room/world1", { hello: "world" });
ok(p.ok === true && p.delivered === 1, "publish ok, 1 delivered");
ok(received.length === 1 && received[0].hello === "world", "subscriber received");

// Subscribe to wrong topic with same token
const sub2 = sc.pubsubSubscribe(tokSub, "global/news", () => {});
ok(sub2.ok === false, "subscribe to non-room/* denied");

// 7. Unsubscribe stops delivery
sub.unsubscribe();
const p2 = sc.pubsubPublish(tokPub, "room/world1", { again: true });
ok(p2.delivered === 0, "after unsubscribe: 0 delivered");

// 8. Identity API
const tokId = sc.grant(["identity:who"]);
const who = sc.identityWho(tokId);
ok(who.ok === true && who.handle === "alice", "identityWho returns handle");

// 9. Revoke token disables it
sc.revoke(tokAdmin);
ok(sc.storageRead(tokAdmin, "b").ok === false, "revoked token denied");
ok(sc.capsOf(tokAdmin).length === 0, "revoked token has no caps");

// 10. Audit log captures all calls
const logTail = sc.recentLog(50);
ok(logTail.length > 5, `audit log has entries (${logTail.length})`);
const denied = logTail.filter(l => !l.ok).length;
const allowed = logTail.filter(l => l.ok).length;
ok(denied > 0 && allowed > 0, `mix of denied (${denied}) and allowed (${allowed}) entries`);

// 11. Capability match rules
ok(sc._capMatches("storage:read:foo", "storage:read:foo") === true, "exact match");
ok(sc._capMatches("storage:read:*", "storage:read:bar") === true, "wildcard match");
ok(sc._capMatches("storage:read:*", "storage:write:bar") === false, "wildcard doesn't cross verb");
ok(sc._capMatches("a:b", "a:c") === false, "no match");

// 12. Listener exception isolated
const tokSub2 = sc.grant(["pubsub:subscribe:test", "pubsub:publish:test"]);
const okFlag = { fired: false };
sc.pubsubSubscribe(tokSub2, "test", () => { throw new Error("boom"); });
sc.pubsubSubscribe(tokSub2, "test", () => { okFlag.fired = true; });
sc.pubsubPublish(tokSub2, "test", {});
ok(okFlag.fired === true, "subscriber exception doesn't break later subscribers");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
