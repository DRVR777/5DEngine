// test_iter_95.js — friends: request, accept, block, status, invites.
const F = require("./friends.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

// 1. Send request
const sys = F.createSystem();
const r1 = sys.sendRequest("alice", "bob");
ok(r1.ok === true, "alice → bob");
ok(sys.listRequestsOut("alice").includes("bob"), "in alice's out");
ok(sys.listRequestsIn("bob").includes("alice"), "in bob's in");

// 2. Duplicate request
ok(sys.sendRequest("alice", "bob").ok === false, "duplicate rejected");

// 3. Self-request
ok(sys.sendRequest("alice", "alice").ok === false, "self rejected");

// 4. Accept
const a1 = sys.acceptRequest("bob", "alice");
ok(a1.ok === true, "bob accepts");
ok(sys.isFriends("alice", "bob") === true, "now friends");
ok(sys.isFriends("bob", "alice") === true, "symmetric");
ok(sys.listFriends("alice").includes("bob"), "in friends list");
ok(!sys.listRequestsIn("bob").includes("alice"), "request cleared");

// Accepting nonexistent request
ok(sys.acceptRequest("bob", "ghost").ok === false, "ghost accept fails");
ok(sys.acceptRequest("ghost", "alice").ok === false, "ghost requester fails");

// 5. Decline
sys.sendRequest("carol", "dave");
ok(sys.declineRequest("dave", "carol").ok === true, "dave declines");
ok(!sys.isFriends("carol", "dave"), "not friends");
ok(!sys.listRequestsIn("dave").includes("carol"), "request gone");

// 6. cancelRequest
sys.sendRequest("eve", "frank");
ok(sys.cancelRequest("eve", "frank").ok === true, "eve cancels");
ok(!sys.listRequestsOut("eve").includes("frank"), "out cleared");
ok(!sys.listRequestsIn("frank").includes("eve"), "in cleared");

// Cancel nonexistent
ok(sys.cancelRequest("eve", "frank").ok === false, "cancel missing fails");

// 7. removeFriend (symmetric)
sys.sendRequest("a", "b");
sys.acceptRequest("b", "a");
ok(sys.removeFriend("a", "b").ok === true, "remove");
ok(!sys.isFriends("a", "b"), "a no longer friends with b");
ok(!sys.isFriends("b", "a"), "b no longer friends with a");
ok(sys.removeFriend("a", "b").ok === false, "double-remove fails");

// 8. Block
sys.sendRequest("attacker", "victim");
const bl = sys.block("victim", "attacker");
ok(bl.ok === true, "block ok");
ok(sys.isBlocked("victim", "attacker"), "is blocked");
ok(!sys.listRequestsIn("victim").includes("attacker"), "pending request auto-removed");
ok(!sys.listRequestsOut("attacker").includes("victim"), "out request cleared");

// Blocked can't re-request
ok(sys.sendRequest("attacker", "victim").ok === false, "blocked send rejected");
ok(sys.sendRequest("victim", "attacker").ok === false, "victim's own block stops outgoing too");

// 9. Block while friends → removes friendship
sys.sendRequest("x", "y");
sys.acceptRequest("y", "x");
sys.block("x", "y");
ok(!sys.isFriends("x", "y"), "friendship dissolved by block");

// 10. Self-block
ok(sys.block("alice", "alice").ok === false, "self-block rejected");

// 11. Unblock
sys.unblock("victim", "attacker");
ok(!sys.isBlocked("victim", "attacker"), "unblocked");
ok(sys.sendRequest("attacker", "victim").ok === true, "can request again after unblock");

// 12. listBlocked
ok(sys.listBlocked("x").includes("y"), "x's block list");

// 13. Status
const st1 = sys.setStatus("alice", "online");
ok(st1.ok === true, "status online ok");
ok(sys.getStatus("alice").status === "online", "alice online");
ok(sys.setStatus("alice", "weird").ok === false, "bad status rejected");

ok(sys.getStatus("ghost") === null, "ghost null status");

// 14. onlineFriends
sys.setStatus("bob", "online");
sys.setStatus("alice", "online");
// (alice and bob were friends earlier)
const ofs = sys.onlineFriends("alice");
ok(ofs.includes("bob"), "bob in alice's online friends");

sys.setStatus("bob", "offline");
ok(!sys.onlineFriends("alice").includes("bob"), "offline bob excluded");

sys.setStatus("bob", "online");

// 15. Invite friend to session
const inv1 = sys.invite("alice", "bob", "session_xyz", { message: "join me!" });
ok(inv1.ok === true, "invite ok");
ok(inv1.invite.sessionId === "session_xyz", "session id");
ok(inv1.invite.message === "join me!", "message");

// Non-friend invite rejected
ok(sys.invite("alice", "stranger", "s").ok === false, "non-friend invite rejected");

// Bob's pending invites
const bobInvites = sys.listInvitesIn("bob");
ok(bobInvites.length === 1, "bob has 1 invite");
ok(bobInvites[0].from === "alice", "from alice");

// 16. Accept invite
const ai = sys.acceptInvite("bob", inv1.inviteId);
ok(ai.ok === true, "invite accepted");
ok(ai.sessionId === "session_xyz", "sessionId returned");

// Re-accept fails
ok(sys.acceptInvite("bob", inv1.inviteId).ok === false, "double accept fails");

// 17. Decline invite
const inv2 = sys.invite("alice", "bob", "session_abc");
ok(sys.declineInvite("bob", inv2.inviteId).ok === true, "decline ok");
ok(sys.declineInvite("bob", inv2.inviteId).ok === false, "double decline fails");
ok(sys.declineInvite("bob", "ghost").ok === false, "ghost invite fails");

// 18. Invite expiration
const sys2 = F.createSystem({ config: { inviteTtlMs: 100 } });
sys2.sendRequest("a", "b"); sys2.acceptRequest("b", "a");
const sinv = sys2.invite("a", "b", "session_1");
// Force expiration
sinv.invite.expiresAt = Date.now() - 1;
sys2.expireOldInvites();
const accExp = sys2.acceptInvite("b", sinv.inviteId);
ok(accExp.ok === false && (accExp.reason === "expired" || accExp.reason === "already_resolved"),
   `expired invite rejected (got ${accExp.reason})`);

// 19. Blocked recipient can't receive invite
sys.block("victim", "alice");
ok(sys.invite("alice", "victim", "s").ok === false, "blocked recipient rejects");

// 20. Max friends
const sys3 = F.createSystem({ config: { maxFriends: 2 } });
sys3.sendRequest("a", "b"); sys3.acceptRequest("b", "a");
sys3.sendRequest("a", "c"); sys3.acceptRequest("c", "a");
const overflow = sys3.sendRequest("a", "d");
ok(overflow.ok === false && overflow.reason === "too_many", "max friends enforced");

// 21. recentEvents
const ev = sys.recentEvents();
ok(ev.length > 0, "events logged");
ok(ev.some(e => e.kind === "accepted"), "accepted events");
ok(ev.some(e => e.kind === "blocked"), "blocked events");

// 22. listPlayers
ok(sys.listPlayers().length > 0, "players list");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
