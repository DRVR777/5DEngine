// test_iter_75.js — cinematics: cutscene timeline + camera moves.
const C = require("./cinematics.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

// 1. createCutscene validation
let threw = false;
try { C.createCutscene({}); } catch (e) { threw = true; }
ok(threw, "missing id throws");

threw = false;
try { C.createCutscene({ id: "x" }); } catch (e) { threw = true; }
ok(threw, "missing tracks throws");

threw = false;
try {
  C.createCutscene({
    id: "x",
    tracks: [{ kind: "camera", keys: [{ t: 5, value: {} }, { t: 1, value: {} }] }],
  });
} catch (e) { threw = true; }
ok(threw, "unsorted keyframes throws");

// 2. Simple camera cutscene
const cam = C.createCutscene({
  id: "intro",
  tracks: [
    { kind: "camera", easing: "linear", keys: [
      { t: 0, value: { pos: { u: 0, v: 0, y: 10 }, lookAt: { u: 0, v: 10, y: 0 } } },
      { t: 5, value: { pos: { u: 10, v: 0, y: 10 }, lookAt: { u: 0, v: 10, y: 0 } } },
    ] },
  ],
});
ok(cam.duration === 5, "inferred duration = 5");

// 3. evaluateAt at midpoint → halfway
const mid = C.evaluateAt(cam, 2.5);
ok(Math.abs(mid.tracks[0].value.pos.u - 5) < 0.001, `camera u at t=2.5 = 5 (got ${mid.tracks[0].value.pos.u})`);

// 4. Director play
const dir = C.createDirector();
ok(!dir.isPlaying(), "not playing initially");
ok(dir.play(cam).ok === true, "play ok");
ok(dir.isPlaying(), "playing");
ok(dir.currentCutscene() === "intro", "currentCutscene = intro");

// Double-play rejected
ok(dir.play(cam).ok === false, "already_playing");

// 5. tick → camera updates
const evs1 = dir.tick(1);
ok(evs1.some(e => e.kind === "camera_update"), "camera_update event");
const camUp = evs1.find(e => e.kind === "camera_update");
ok(Math.abs(camUp.value.pos.u - 2) < 0.001, `camera u at t=1 = 2 (got ${camUp.value.pos.u})`);

// 6. Pause/resume
dir.pause();
const tBefore = dir.currentT();
dir.tick(10);
ok(dir.currentT() === tBefore, "paused: t doesn't advance");
dir.resume();
dir.tick(0.5);
ok(Math.abs(dir.currentT() - 1.5) < 0.001, `t = 1.5 (got ${dir.currentT()})`);

// 7. Marker fires once
const mk = C.createCutscene({
  id: "marker_test",
  tracks: [
    { kind: "marker", keys: [
      { t: 1, name: "act_one_done" },
      { t: 3, name: "act_two_done" },
    ] },
  ],
});
const d2 = C.createDirector();
d2.play(mk);
const e1 = d2.tick(1.5);
ok(e1.some(e => e.kind === "marker" && e.name === "act_one_done"), "marker act_one fired");
const e2 = d2.tick(0.5);
ok(!e2.some(e => e.kind === "marker" && e.name === "act_one_done"), "marker doesn't refire");
const e3 = d2.tick(2);
ok(e3.some(e => e.kind === "marker" && e.name === "act_two_done"), "marker act_two fired");

// 8. End event + onEnd callback + returnCamTo
let onEndCalled = false;
const d3 = C.createDirector();
d3.play(cam, { onEnd: () => { onEndCalled = true; }, returnCamTo: "player" });
const eEnd = d3.tick(10);
ok(eEnd.some(e => e.kind === "end"), "end event");
const endEv = eEnd.find(e => e.kind === "end");
ok(endEv.returnCamTo === "player", "returnCamTo propagated");
ok(onEndCalled, "onEnd called");
ok(!d3.isPlaying(), "not playing after end");

// 9. Subtitle track with duration
const sub = C.createCutscene({
  id: "sub_test",
  tracks: [
    { kind: "subtitle", keys: [
      { t: 0, text: "Hello.", duration: 2 },
      { t: 2, text: "Welcome.", duration: 3 },
    ] },
  ],
});
ok(sub.duration === 5, "subtitle extends duration (got " + sub.duration + ")");
const d4 = C.createDirector();
d4.play(sub);
const sEv = d4.tick(0.1);
ok(sEv.some(e => e.kind === "subtitle" && e.text === "Hello."), "subtitle fires");

// 10. Audio cue
const audio = C.createCutscene({
  id: "a", tracks: [
    { kind: "audio", keys: [{ t: 1, cue: "boom", volume: 0.8 }] }
  ],
  duration: 2,
});
const d5 = C.createDirector();
d5.play(audio);
const aEv = d5.tick(1.5);
const audioE = aEv.find(e => e.kind === "audio");
ok(audioE && audioE.cue === "boom", "audio cue fired");
ok(audioE.volume === 0.8, "volume preserved");

// 11. Easing curves
const easeC = C.createCutscene({
  id: "ease", tracks: [
    { kind: "entity", targetId: "x", easing: "easeIn", keys: [
      { t: 0, value: { u: 0, v: 0, y: 0 } },
      { t: 10, value: { u: 100, v: 0, y: 0 } },
    ] },
  ],
});
const ev5 = C.evaluateAt(easeC, 5);
// easeIn at t=0.5 → 0.25 → u = 25
ok(Math.abs(ev5.tracks[0].value.u - 25) < 0.001, `easeIn at t=5 → 25 (got ${ev5.tracks[0].value.u})`);

// 12. Step easing
const stepC = C.createCutscene({
  id: "step", tracks: [
    { kind: "entity", targetId: "y", easing: "step", keys: [
      { t: 0, value: { u: 0, v: 0, y: 0 } },
      { t: 10, value: { u: 100, v: 0, y: 0 } },
    ] },
  ],
});
const stepMid = C.evaluateAt(stepC, 5);
ok(stepMid.tracks[0].value.u === 0, "step: u still 0 before keyframe");

// 13. Stop mid-play
const d6 = C.createDirector();
d6.play(cam, { returnCamTo: "hero" });
d6.tick(1);
const stopRes = d6.stop();
ok(stopRes.ok === true, "stop ok");
ok(stopRes.returnCamTo === "hero", "stop returns cam to hero");
ok(!d6.isPlaying(), "not playing after stop");

// 14. Events logged
const ev = d6.recentEvents();
ok(ev.length >= 2, "events logged");

// 15. Speed multiplier
const d7 = C.createDirector();
d7.play(cam, { speed: 2 });
d7.tick(1);
ok(Math.abs(d7.currentT() - 2) < 0.001, "speed 2x: t=2 after dt=1");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
