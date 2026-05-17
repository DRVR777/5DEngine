// audio_webaudio.js — WebAudio adapter for audio.js's mixer.
//
// audio.js is engine-agnostic (it routes play/stop events to whatever
// adapter is plugged in). This file is the browser-side adapter that
// actually emits sound via the WebAudio API.
//
// `src` semantics (we synthesize, no asset files required):
//   "beep"          → 220Hz square pulse, 80ms
//   "beep:440"      → 440Hz square pulse, 80ms (Hz after colon)
//   "click"         → short 80Hz thump, 40ms
//   "blip"          → 880Hz sine, 60ms
//   "noise"         → 100ms white-noise burst
//   "tone:F:MS"     → custom: F Hz, MS milliseconds
//   "music:loop_*"  → looping triangle wave (volume scaled by mixer)
//
// Usage:
//   const adapter = createWebAudioAdapter();
//   const mixer = GTAAudio.createMixer({ adapter });
//   mixer.play({ src: "beep:440", route: "sfx", volume: 0.4 });
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.WebAudioAdapter = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function _now() { return Date.now(); }

  // Parse a synth spec string → { kind, freq, durMs, type }
  function parseSrc(src) {
    if (typeof src !== "string") return null;
    if (src === "beep")  return { kind: "tone", freq: 220, durMs: 80, type: "square" };
    if (src === "click") return { kind: "tone", freq: 80,  durMs: 40, type: "square" };
    if (src === "blip")  return { kind: "tone", freq: 880, durMs: 60, type: "sine" };
    if (src === "noise") return { kind: "noise", durMs: 100 };
    if (src.startsWith("beep:")) {
      const f = parseFloat(src.slice(5));
      if (!isFinite(f)) return null;
      return { kind: "tone", freq: f, durMs: 80, type: "square" };
    }
    if (src.startsWith("tone:")) {
      const parts = src.slice(5).split(":");
      const f = parseFloat(parts[0]);
      const ms = parts[1] ? parseFloat(parts[1]) : 80;
      const type = parts[2] || "sine";
      if (!isFinite(f) || !isFinite(ms)) return null;
      return { kind: "tone", freq: f, durMs: ms, type };
    }
    if (src.startsWith("music:")) {
      return { kind: "loop", freq: 110, type: "triangle" };
    }
    return null;
  }

  function createWebAudioAdapter(opts) {
    opts = opts || {};
    const active = new Map();  // handle → { stop() }
    let ctx = null;

    function _ctx() {
      if (ctx) return ctx;
      const g = (typeof self !== "undefined") ? self
              : (typeof window !== "undefined") ? window
              : (typeof globalThis !== "undefined") ? globalThis : null;
      const AC = g && (g.AudioContext || g.webkitAudioContext);
      if (!AC) return null;
      try { ctx = new AC(); } catch (_) { return null; }
      return ctx;
    }

    function _playTone(c, spec, gain) {
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = spec.type;
      osc.frequency.value = spec.freq;
      g.gain.value = gain;
      // tiny envelope to avoid clicks
      const t = c.currentTime;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(gain, t + 0.005);
      g.gain.linearRampToValueAtTime(0, t + spec.durMs / 1000);
      osc.connect(g).connect(c.destination);
      osc.start(t);
      osc.stop(t + spec.durMs / 1000 + 0.02);
      return {
        stop: () => { try { osc.stop(); } catch (_) {} },
      };
    }

    function _playNoise(c, spec, gain) {
      const bufSize = Math.floor((c.sampleRate * spec.durMs) / 1000);
      const buf = c.createBuffer(1, bufSize, c.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
      const node = c.createBufferSource();
      node.buffer = buf;
      const g = c.createGain();
      g.gain.value = gain;
      node.connect(g).connect(c.destination);
      node.start();
      return { stop: () => { try { node.stop(); } catch (_) {} } };
    }

    function _playLoop(c, spec, gain) {
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = spec.type || "triangle";
      osc.frequency.value = spec.freq;
      g.gain.value = gain;
      osc.connect(g).connect(c.destination);
      osc.start();
      return { stop: () => { try { osc.stop(); } catch (_) {} } };
    }

    function play(handle, src, volume, loop, position) {
      const spec = parseSrc(src);
      if (!spec) return;
      const c = _ctx();
      if (!c) return;
      // Resume on first user gesture (most browsers require this)
      if (c.state === "suspended") { try { c.resume(); } catch (_) {} }
      const gain = Math.max(0, Math.min(1, volume != null ? volume : 1));
      let inst;
      if (spec.kind === "tone")  inst = _playTone(c, spec, gain);
      if (spec.kind === "noise") inst = _playNoise(c, spec, gain);
      if (spec.kind === "loop")  inst = _playLoop(c, spec, gain);
      if (inst) active.set(handle, inst);
    }

    function stop(handle) {
      const inst = active.get(handle);
      if (!inst) return;
      inst.stop();
      active.delete(handle);
    }

    function setVolume(handle, vol) {
      // No-op for now — finite tones already played out. Future: ramp loop gain.
    }

    return { play, stop, setVolume, activeCount: () => active.size,
             VERSION: "0.1.0-iter135" };
  }

  return { createWebAudioAdapter, parseSrc };
});
