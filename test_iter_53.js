// test_iter_53.js — voice chat signaling state machine.
const VC = require("./voice_chat.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

ok(VC.STATES.includes("idle") && VC.STATES.includes("connected") && VC.STATES.includes("closed"),
   "STATES enumerated");

// Capture envelopes sent in both directions
const aSent = [], bSent = [];
const a = VC.createSession({ peerId: "alice", sender: env => aSent.push(env) });
const b = VC.createSession({ peerId: "bob",   sender: env => bSent.push(env) });

// 1. Initial state
ok(a.getPeerState("bob") === null, "no peer state initially");
ok(a.activePeers().length === 0, "no active peers");

// 2. Alice calls Bob → emits voice.offer
const c1 = a.call("bob");
ok(c1.ok === true, "call ok");
ok(a.getPeerState("bob") === "offer_sent", "alice → offer_sent");
ok(aSent.length === 1, "offer envelope queued");
ok(aSent[0].type === "voice.offer", "envelope type voice.offer");
ok(aSent[0].from === "alice" && aSent[0].to === "bob", "from/to set");
ok(aSent[0].payload.sdp.type === "offer", "SDP offer payload");

// 3. Bob receives the offer via handleEnvelope → auto-answer
const handled = b.handleEnvelope(aSent[0]);
ok(handled === true, "bob handled offer");
ok(b.getPeerState("alice") === "ice_exchange",
   `bob → ice_exchange after auto-answer (got ${b.getPeerState("alice")})`);
ok(bSent.length === 1, "answer envelope queued");
ok(bSent[0].type === "voice.answer", "answer type");

// 4. Alice receives Bob's answer → ice_exchange
a.handleEnvelope(bSent[0]);
ok(a.getPeerState("bob") === "ice_exchange", "alice → ice_exchange");

// 5. Exchange one ICE candidate each → connected
a.sendIceCandidate("bob", { candidate: "candidate:fake1" });
ok(aSent.length === 2 && aSent[1].type === "voice.ice", "ice envelope sent");
b.handleEnvelope(aSent[1]);
ok(b.getPeerState("alice") === "connected", "bob marks alice connected after ICE");

b.sendIceCandidate("alice", { candidate: "candidate:fake2" });
a.handleEnvelope(bSent[1]);
ok(a.getPeerState("bob") === "connected", "alice marks bob connected after ICE");

// 6. activePeers reports both
ok(a.activePeers().length === 1, "alice has 1 active peer");
ok(a.activePeers()[0].peerId === "bob", "active peer is bob");
ok(a.activePeers()[0].state === "connected", "state is connected");

// 7. Mute notifies remote
a.setMute(true);
ok(a.isMuted() === true, "alice muted");
const muteEnv = aSent[aSent.length - 1];
ok(muteEnv.type === "voice.mute", "mute envelope sent");
ok(muteEnv.payload.muted === true, "muted flag in payload");

a.setMute(false);
ok(a.isMuted() === false, "alice unmuted");

// 8. Hangup
const hu = a.hangup("bob");
ok(hu === true, "alice hangs up");
ok(a.getPeerState("bob") === null, "peer removed from alice");
const hangupEnv = aSent[aSent.length - 1];
ok(hangupEnv.type === "voice.hangup", "hangup envelope sent");

b.handleEnvelope(hangupEnv);
ok(b.getPeerState("alice") === null, "bob's peer removed too");

// 9. Re-call
a.call("bob");
ok(a.getPeerState("bob") === "offer_sent", "re-call works");
const c2 = a.call("bob");
ok(c2.ok === false && c2.reason === "already_calling", "duplicate call rejected");

// 10. Bad envelopes
ok(a.handleEnvelope(null) === false, "null envelope rejected");
ok(a.handleEnvelope({ type: "not_voice" }) === false, "non-voice envelope rejected");
ok(a.handleEnvelope({ type: "voice.unknown", from: "x" }) === false, "unknown subtype rejected");

// 11. receiveAnswer in wrong state
const c = VC.createSession({ peerId: "carol", sender: () => {} });
const badAns = c.receiveAnswer("ghost", { type: "answer" });
ok(badAns.ok === false, "answer for unknown peer rejected");

c.call("dave");
const ans2 = c.receiveAnswer("dave", { type: "answer" });
ok(ans2.ok === true, "answer in offer_sent state ok");
const ans3 = c.receiveAnswer("dave", { type: "answer" });
ok(ans3.ok === false, "second answer in wrong state rejected");

// 12. State transitions emit
const evts = [];
const d = VC.createSession({ peerId: "dora", sender: () => {} });
d.on("state", e => evts.push(`${e.peerId}:${e.prev}→${e.state}`));
d.call("eve");
ok(evts.length >= 1, "state event fired on call");
ok(evts[0] === "eve:idle→offer_sent", `state transition recorded (${evts[0]})`);

// 13. Adapter hooks
const hookCalls = [];
const e = VC.createSession({
  peerId: "ed",
  sender: () => {},
  adapter: {
    createOffer: (peer) => { hookCalls.push(`offer:${peer}`); return { type: "offer", sdp: "real-offer" }; },
    createAnswer: (peer) => { hookCalls.push(`answer:${peer}`); return { type: "answer", sdp: "real-answer" }; },
  },
});
e.call("fran");
ok(hookCalls[0] === "offer:fran", "adapter.createOffer called");
e.handleEnvelope({ type: "voice.offer", from: "geri", payload: { sdp: { type: "offer", sdp: "x" } } });
ok(hookCalls.includes("answer:geri"), "adapter.createAnswer called");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
