// test_iter_135.js — WebAudio src parsing + bus→speaker→mixer integration.
const WA = require("./audio_webaudio.js");
const GTAAudio = require("./audio.js");
const D = require("./devices.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

// =====================================================================
// 1. parseSrc — synth spec parser
// =====================================================================
ok(WA.parseSrc("beep").kind === "tone", "beep is tone");
ok(WA.parseSrc("beep").freq === 220, "beep freq 220");
ok(WA.parseSrc("beep").durMs === 80, "beep 80ms");

ok(WA.parseSrc("beep:440").freq === 440, "beep:440 freq parsed");
ok(WA.parseSrc("beep:1000").freq === 1000, "beep:1000 freq parsed");
ok(WA.parseSrc("beep:bad") === null, "beep:bad rejected");

ok(WA.parseSrc("click").kind === "tone", "click is tone");
ok(WA.parseSrc("click").durMs === 40, "click is short");

ok(WA.parseSrc("blip").freq === 880, "blip is 880");
ok(WA.parseSrc("blip").type === "sine", "blip is sine");

ok(WA.parseSrc("noise").kind === "noise", "noise");

const t = WA.parseSrc("tone:330:120:sine");
ok(t.freq === 330, "tone freq");
ok(t.durMs === 120, "tone duration");
ok(t.type === "sine", "tone type");

ok(WA.parseSrc("music:track_a").kind === "loop", "music loops");
ok(WA.parseSrc(null) === null, "null src");
ok(WA.parseSrc("") === null, "empty src");
ok(WA.parseSrc("unknown") === null, "unknown src");

// =====================================================================
// 2. Adapter API surface (no AudioContext in node — calls should noop, not throw)
// =====================================================================
const adapter = WA.createWebAudioAdapter();
ok(typeof adapter.play === "function", "play exported");
ok(typeof adapter.stop === "function", "stop exported");
ok(typeof adapter.setVolume === "function", "setVolume exported");
ok(typeof adapter.activeCount === "function", "activeCount exported");

// In node there's no AudioContext, so play silently does nothing.
adapter.play(1, "beep", 0.5);
ok(adapter.activeCount() === 0, "no audio context → no active sounds");
adapter.stop(1);
adapter.setVolume(1, 0.7);

// =====================================================================
// 3. Mixer integration — adapter receives the play call
// =====================================================================
const calls = [];
const fakeAdapter = {
  play: (handle, src, volume, loop, pos) => calls.push({ handle, src, volume, loop, pos }),
  stop: (handle) => calls.push({ stop: handle }),
};
const mixer = GTAAudio.createMixer({ adapter: fakeAdapter });
const r1 = mixer.play({ src: "beep", route: "sfx", volume: 0.8 });
ok(r1.ok && r1.handle, "mixer.play OK");
ok(calls.length === 1, "adapter received 1 play");
ok(calls[0].src === "beep", "src passed through");
ok(calls[0].volume > 0 && calls[0].volume <= 1, "volume effective in [0..1]");

mixer.play({ src: "click", route: "sfx" });
mixer.play({ src: "noise", route: "ambient" });
ok(calls.length === 3, "3 plays delivered");

// =====================================================================
// 4. Bus → speaker → mixer round-trip
// Simulates the demo loop: PC sends audio packet to spk1 over a wire;
// each tick we drain spk1's inbox and dispatch to the mixer.
// =====================================================================
const bus = D.createBus();
bus.makeComputer({ id: "pc1" });
bus.makeSpeaker({ id: "spk1" });
bus.connect("pc1", "audio_out", "spk1", "audio_in", "audio");

const calls2 = [];
const fakeAdapter2 = {
  play: (h, src, vol) => calls2.push({ src, vol }),
  stop: () => {},
};
const mixer2 = GTAAudio.createMixer({ adapter: fakeAdapter2 });

// PC plays a tune
bus.send("pc1", "audio_out", { kind: "audio", payload: { src: "beep:440", volume: 0.6 } });
bus.send("pc1", "audio_out", { kind: "audio", payload: { src: "click",    volume: 0.3 } });

// "tick": drain inbox + dispatch each packet to the mixer
const drained = bus.drain("spk1", "audio_in");
ok(drained.length === 2, "speaker received 2 packets");
for (const p of drained) {
  if (p && p.payload && p.payload.src) {
    mixer2.play({ src: p.payload.src, route: "sfx", volume: p.payload.volume });
  }
}
ok(calls2.length === 2, "mixer called twice");
ok(calls2[0].src === "beep:440", "first packet → beep:440");
ok(calls2[1].src === "click",    "second packet → click");

// =====================================================================
// 5. Stop + active count
// =====================================================================
const r2 = mixer2.play({ src: "blip", route: "sfx" });
const stopOk = mixer2.stop(r2.handle);
ok(stopOk, "mixer stop returns true");
ok(mixer2.stop(99999) === false, "stop unknown handle false");

// =====================================================================
// 6. Volume scales by mixer route
// =====================================================================
const calls3 = [];
const fakeAdapter3 = { play: (h, s, v) => calls3.push(v), stop: () => {} };
const mixer3 = GTAAudio.createMixer({ adapter: fakeAdapter3,
  master: 0.5, sfx: 0.5, music: 1.0 });
mixer3.play({ src: "beep", route: "sfx", volume: 1.0 });
mixer3.play({ src: "beep", route: "music", volume: 1.0 });
ok(calls3[0] === 0.25, `sfx scaled: 0.5*0.5*1.0=0.25 (got ${calls3[0]})`);
ok(calls3[1] === 0.5,  `music scaled: 0.5*1.0*1.0=0.5 (got ${calls3[1]})`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
