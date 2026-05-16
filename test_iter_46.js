// test_iter_46.js — audio mixer + routes + spatialization.
const Audio = require("./audio.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

// 1. Routes + default volumes
ok(Audio.ROUTES.length === 4, "4 routes");
const m = Audio.createMixer();
ok(m.volumes.master === 0.8, "master default 0.8");
ok(m.volumes.sfx === 1.0, "sfx default 1.0");
ok(m.volumes.music === 0.6, "music default 0.6");
ok(m.volumes.ambient === 0.4, "ambient default 0.4");

// 2. effectiveVolume math
ok(m.effectiveVolume("sfx", 1.0) === 0.8, `sfx * master = 0.8 (got ${m.effectiveVolume("sfx", 1.0)})`);
ok(m.effectiveVolume("music", 1.0) === 0.48, `music * master = 0.48`);
ok(m.effectiveVolume("unknown", 1.0) === 0.8, "unknown route falls through with 1.0");

// 3. play returns handle + volume
const r1 = m.play({ src: "boom.wav", route: "sfx" });
ok(r1.ok === true, "play sfx ok");
ok(typeof r1.handle === "number", "handle returned");
ok(r1.volume === 0.8, "effective volume returned");
ok(m.activeCount() === 1, "1 active sound");

// 4. Multiple routes coexist
m.play({ src: "song.mp3", route: "music", loop: true });
m.play({ src: "talk.wav", route: "voice" });
m.play({ src: "wind.wav", route: "ambient" });
ok(m.activeCount() === 4, "4 sounds active");
ok(m.activeCount("music") === 1, "1 music");
ok(m.activeCount("sfx") === 1, "1 sfx");

// 5. stop by handle
const stopped = m.stop(r1.handle);
ok(stopped === true, "stop ok");
ok(m.activeCount() === 3, "1 fewer active");
ok(m.stop(999) === false, "stop unknown handle returns false");

// 6. stopAll by route
const n = m.stopAll("sfx");
ok(n === 0, "stopAll sfx: 0 (already stopped)");
const allMusic = m.stopAll("music");
ok(allMusic === 1, "stopAll music: 1 stopped");
ok(m.activeCount("music") === 0, "no music active");
const total = m.stopAll();
ok(total === 2, "stopAll with no route: stops remaining 2 (voice + ambient)");
ok(m.activeCount() === 0, "all stopped");

// 7. setVolume + clamping
ok(m.setVolume("master", 0.5) === true, "setVolume master ok");
ok(m.volumes.master === 0.5, "master = 0.5");
m.setVolume("sfx", 2.0);
ok(m.volumes.sfx === 1.0, "sfx clamped at 1.0");
m.setVolume("music", -1);
ok(m.volumes.music === 0, "music clamped at 0");
ok(m.setVolume("bogus", 1) === false, "bad route rejected");

// 8. Bad input
ok(m.play({}).ok === false, "missing src rejected");
ok(m.play({ src: "x.wav", route: "ghost" }).ok === false, "bad route rejected");

// 9. Adapter receives play/stop calls
const calls = { play: [], stop: [], setVolume: [] };
const m2 = Audio.createMixer({
  adapter: {
    play: (h, src, v, loop, pos) => calls.play.push({ h, src, v, loop, pos }),
    stop: (h) => calls.stop.push(h),
    setVolume: (h, v) => calls.setVolume.push({ h, v }),
  },
});
const r2 = m2.play({ src: "a.wav", route: "sfx", volume: 0.5 });
ok(calls.play.length === 1, "adapter.play called");
ok(calls.play[0].src === "a.wav", "src forwarded");
ok(Math.abs(calls.play[0].v - 0.5 * 1.0 * 0.8) < 1e-9, `effective volume forwarded (got ${calls.play[0].v})`);

m2.stop(r2.handle);
ok(calls.stop.length === 1, "adapter.stop called");

m2.play({ src: "b.wav", route: "music" });
m2.setVolume("music", 0.5);
ok(calls.setVolume.length > 0, "adapter.setVolume called on route change");

// 10. Event listeners
const events = [];
m.on("play", e => events.push("play:" + e.src));
m.on("stop", e => events.push("stop:" + e.src));
m.play({ src: "evt.wav", route: "sfx" });
ok(events[0] === "play:evt.wav", "play event fired");
m.stopAll();
ok(events.length === 2 && events[1].startsWith("stop:"), "stop event fired");

// 11. spatialVolume
const sp1 = m.spatialVolume({ u: 0, v: 0 }, { u: 0, v: 0 }, 20);
ok(sp1 === 1.0, "same position → full volume");
const sp2 = m.spatialVolume({ u: 10, v: 0 }, { u: 0, v: 0 }, 20);
ok(Math.abs(sp2 - 0.5) < 1e-9, `10/20 fall-off → 0.5 (got ${sp2})`);
const sp3 = m.spatialVolume({ u: 50, v: 0 }, { u: 0, v: 0 }, 20);
ok(sp3 === 0, "past falloff → 0");
const sp4 = m.spatialVolume(null, { u: 0, v: 0 }, 20);
ok(sp4 === 1.0, "missing position → 1.0");

// 12. Adapter exception isolated
const noisy = Audio.createMixer({
  adapter: { play: () => { throw new Error("boom"); } },
});
const r3 = noisy.play({ src: "x.wav" });
ok(r3.ok === true, "play succeeds even when adapter throws");
ok(noisy.activeCount() === 1, "active still tracked");

// 13. Listener exception isolated
let safeFlag = false;
m.on("play", () => { throw new Error("boom"); });
m.on("play", () => { safeFlag = true; });
m.play({ src: "iso.wav" });
ok(safeFlag === true, "listener exception doesn't stop later listeners");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
