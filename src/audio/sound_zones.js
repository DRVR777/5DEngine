// sound_zones.js — 5DEngine ambient audio zones
// Zones with looping audio that fade in/out as the player enters/exits.
// Uses the Web Audio API. Falls back silently if audio is unavailable.
//
// API (window.SoundZones):
//   addZone(id, centerU, centerV, radius, audioDesc, opts)
//      audioDesc: tone descriptor "tone:220:sine" OR a URL to an audio file
//      opts: { gain, fadeTime, label }
//   removeZone(id)
//   tick(heroU, heroV)   — call every frame
//   setMasterGain(0..1)  — global volume multiplier

(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.SoundZones = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  let _ctx = null;
  let _master = null;
  const _zones = new Map();   // id → zone state

  function _ensureCtx() {
    if (_ctx) return _ctx;
    try {
      _ctx = new (window.AudioContext || window.webkitAudioContext)();
      _master = _ctx.createGain();
      _master.gain.value = 0.6;
      _master.connect(_ctx.destination);
    } catch (_) {}
    return _ctx;
  }

  function _makeToneNode(freq, type) {
    if (!_ctx) return null;
    const osc = _ctx.createOscillator();
    osc.frequency.value = freq;
    osc.type = type || "sine";
    osc.start();
    return osc;
  }

  async function _makeFileNode(url) {
    if (!_ctx) return null;
    try {
      const resp = await fetch(url);
      const buf  = await resp.arrayBuffer();
      const decoded = await _ctx.decodeAudioData(buf);
      const src = _ctx.createBufferSource();
      src.buffer  = decoded;
      src.loop    = true;
      src.start();
      return src;
    } catch (_) { return null; }
  }

  async function addZone(id, centerU, centerV, radius, audioDesc, opts = {}) {
    if (_zones.has(id)) removeZone(id);
    _ensureCtx();
    if (!_ctx) return;
    if (_ctx.state === "suspended") _ctx.resume().catch(() => {});

    const gainNode = _ctx.createGain();
    gainNode.gain.value = 0;
    gainNode.connect(_master);

    let srcNode = null;
    const isTone = typeof audioDesc === "string" && audioDesc.startsWith("tone:");
    if (isTone) {
      const parts = audioDesc.split(":");
      srcNode = _makeToneNode(+parts[1] || 220, parts[2] || "sine");
    } else if (typeof audioDesc === "string") {
      srcNode = await _makeFileNode(audioDesc);
    }

    if (srcNode) srcNode.connect(gainNode);

    _zones.set(id, {
      id, centerU, centerV, radius,
      gainNode, srcNode,
      targetGain: 0,
      maxGain: opts.gain || 0.3,
      fadeTime: opts.fadeTime || 1.5,
      label: opts.label || id,
    });
  }

  function removeZone(id) {
    const z = _zones.get(id);
    if (!z) return;
    try { z.srcNode && z.srcNode.stop(); } catch (_) {}
    try { z.gainNode.disconnect(); } catch (_) {}
    _zones.delete(id);
  }

  function tick(heroU, heroV) {
    if (!_ctx) return;
    const now = _ctx.currentTime;
    for (const [, z] of _zones) {
      const dist = Math.hypot(heroU - z.centerU, heroV - z.centerV);
      const t = Math.max(0, 1 - dist / z.radius);
      z.targetGain = t * z.maxGain;
      z.gainNode.gain.setTargetAtTime(z.targetGain, now, z.fadeTime * 0.33);
    }
  }

  function setMasterGain(v) {
    _ensureCtx();
    if (_master) _master.gain.value = Math.max(0, Math.min(1, v));
  }

  function getAll() { return [..._zones.values()].map(z => ({ id: z.id, centerU: z.centerU, centerV: z.centerV, radius: z.radius, label: z.label })); }

  return { addZone, removeZone, tick, setMasterGain, getAll };
});
