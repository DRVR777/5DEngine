// test_iter_94.js — voice chat: registration, PTT, spatial falloff, mute, channels.
const V = require("./voice_envelopes.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

// 1. Channels
ok(V.CHANNELS.length === 3, "3 channels");
ok(V.CHANNELS.includes("proximity"), "proximity");

// 2. createSystem + registration
const sys = V.createSystem({ config: { maxRangeM: 20 } });
sys.registerSpeaker("alice", { pos: { u: 0, v: 0 } });
sys.registerSpeaker("bob",   { pos: { u: 10, v: 0 } });
sys.registerListener("listener1", { pos: { u: 0, v: 0 } });
sys.registerListener("listener2", { pos: { u: 30, v: 0 } });

ok(sys.listSpeakers().length === 2, "2 speakers");
ok(sys.listListeners().length === 2, "2 listeners");

// 3. pushFrame without PTT (default) → rejected
const f1 = sys.pushFrame({ speakerId: "alice", payload: "audio_blob_1" });
ok(f1.ok === false && f1.reason === "not_transmitting", "ptt required by default");

// 4. startTalking + pushFrame succeeds
sys.startTalking("alice");
const f2 = sys.pushFrame({ speakerId: "alice", payload: "blob2" });
ok(f2.ok === true, `frame ok (${f2.reason || ""})`);
ok(f2.distributed.length >= 1, `distributed to listeners (${f2.distributed.length})`);

// 5. Speaker doesn't get own frame
const hasAlice = f2.distributed.find(d => d.listenerId === "alice");
ok(!hasAlice, "speaker excluded from own distribution");

// 6. Listener at distance 0 → volume = 1 (linear falloff)
const l1Dist = f2.distributed.find(d => d.listenerId === "listener1");
ok(l1Dist && l1Dist.volume === 1, `listener1 vol=1 (got ${l1Dist && l1Dist.volume})`);

// 7. Listener at distance 30m > range 20m → excluded
const l2 = f2.distributed.find(d => d.listenerId === "listener2");
ok(!l2, "out-of-range listener excluded");

// 8. Linear falloff at intermediate distance
sys.registerListener("mid", { pos: { u: 10, v: 0 } });  // 10m from alice
const f3 = sys.pushFrame({ speakerId: "alice", payload: "x" });
const midD = f3.distributed.find(d => d.listenerId === "mid");
ok(midD && Math.abs(midD.volume - 0.5) < 0.01, `linear at 10m/20m = 0.5 (got ${midD && midD.volume})`);

// 9. Bad pushFrame
ok(sys.pushFrame(null).ok === false, "null frame rejected");
ok(sys.pushFrame({ speakerId: "ghost", payload: "x" }).ok === false, "ghost speaker rejected");
ok(sys.pushFrame({ payload: "x" }).ok === false, "no speaker rejected");

// 10. stopTalking
sys.stopTalking("alice");
const f4 = sys.pushFrame({ speakerId: "alice", payload: "x" });
ok(f4.ok === false, "stop → drops frames");

// 11. setChannel + bad channel
sys.startTalking("alice");
ok(sys.setChannel("alice", "weird").ok === false, "bad channel");
ok(sys.setChannel("alice", "global").ok === true, "global channel");

// Global channel: distance doesn't matter, all listeners get full volume
const f5 = sys.pushFrame({ speakerId: "alice", payload: "x" });
const farListener = f5.distributed.find(d => d.listenerId === "listener2");
ok(farListener && farListener.volume === 1, `global far listener vol=1 (got ${farListener && farListener.volume})`);

// 12. Team channel
sys.registerSpeaker("teamPlayer", { team: "red", channel: "team", transmitting: true, pos: { u: 0, v: 0 } });
sys.registerListener("redM", { team: "red", pos: { u: 0, v: 0 } });
sys.registerListener("blueM", { team: "blue", pos: { u: 0, v: 0 } });

const fT = sys.pushFrame({ speakerId: "teamPlayer", payload: "x" });
const reds = fT.distributed.find(d => d.listenerId === "redM");
const blues = fT.distributed.find(d => d.listenerId === "blueM");
ok(reds, "red teammate hears");
ok(!blues, "blue does not hear team channel");

// 13. Mute roster
sys.setChannel("alice", "global");
sys.startTalking("alice");
sys.mute("listener1", "alice");
const fM = sys.pushFrame({ speakerId: "alice", payload: "x" });
const muted = fM.distributed.find(d => d.listenerId === "listener1");
ok(muted && muted.muted === true && muted.volume === 0, "muted: vol=0");
ok(sys.isMuted("listener1", "alice") === true, "isMuted true");

sys.unmute("listener1", "alice");
ok(sys.isMuted("listener1", "alice") === false, "unmuted");

// 14. setChannelEnabled
sys.setChannelEnabled("listener1", "global", false);
const fOff = sys.pushFrame({ speakerId: "alice", payload: "x" });
ok(!fOff.distributed.find(d => d.listenerId === "listener1"),
   "listener1 doesn't hear disabled channel");

// 15. envelope construction (CWP v1.0)
const env = sys.envelope("alice", "audio_blob", "session1", { alice: 5 });
ok(env.cwp === "1.0", "cwp version");
ok(env.type === "voice", "type voice");
ok(env.payload.speakerId === "alice", "speaker in payload");
ok(env.payload.channel === "global", "channel in payload");
ok(env.payload.audio === "audio_blob", "audio in payload");

// envelope on unregistered throws
let threw = false;
try { sys.envelope("ghost", "x"); } catch (e) { threw = true; }
ok(threw, "envelope on missing speaker throws");

// 16. Inverse falloff
const inv = V.createSystem({ config: { maxRangeM: 100, falloffShape: "inverse", pttRequired: false } });
inv.registerSpeaker("s", { pos: { u: 0, v: 0 } });
inv.registerListener("l1", { pos: { u: 0, v: 0 } });
inv.registerListener("l2", { pos: { u: 10, v: 0 } });
inv.registerListener("l3", { pos: { u: 50, v: 0 } });
inv.startTalking("s");
const fInv = inv.pushFrame({ speakerId: "s", payload: "x" });
const at0 = fInv.distributed.find(d => d.listenerId === "l1").volume;
const at10 = fInv.distributed.find(d => d.listenerId === "l2").volume;
const at50 = fInv.distributed.find(d => d.listenerId === "l3").volume;
ok(at0 > at10 && at10 > at50, `inverse falloff (0→${at0}, 10→${at10}, 50→${at50})`);

// 17. setPosition updates spatial
sys.setPosition("alice", { u: 100, v: 100 });
const newDist = sys.pushFrame({ speakerId: "alice", payload: "x" });
// Most listeners now too far for proximity, but global still works
sys.setChannel("alice", "proximity");
const proxFar = sys.pushFrame({ speakerId: "alice", payload: "x" });
// Listener "mid" was at (10,0); alice now at (100,100); dist > 100 > 20
ok(!proxFar.distributed.find(d => d.listenerId === "mid"), "moved out of range");

// 18. Recent frames / events
ok(sys.recentFrames().length > 0, "frames logged");
ok(sys.recentEvents().some(e => e.kind === "ptt_start"), "events include ptt_start");

// 19. unregister cleanup
sys.unregisterSpeaker("alice");
ok(sys.pushFrame({ speakerId: "alice", payload: "x" }).ok === false,
   "removed speaker can't push");

sys.unregisterListener("listener1");
ok(!sys.listListeners().includes("listener1"), "listener removed");

// 20. PTT not required when disabled
const noPTT = V.createSystem({ config: { pttRequired: false } });
noPTT.registerSpeaker("s", { pos: { u: 0, v: 0 }, channel: "global" });
noPTT.registerListener("l", { pos: { u: 0, v: 0 } });
const noPTTF = noPTT.pushFrame({ speakerId: "s", payload: "x" });
ok(noPTTF.ok === true, "ptt disabled → frames go through without startTalking");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
