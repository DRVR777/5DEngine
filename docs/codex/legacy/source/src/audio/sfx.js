// SFX + Ambient — extracted from index.html
// Call Sfx.init(mixer) once after audioMixer is created.
// Public API: Sfx.playSfx(src, vol), Sfx.setAmbient(id, freq, type, targetVol, fadeSecs)

let _mixer = null;
const _ambCtx = window.AudioContext || window.webkitAudioContext
  ? new (window.AudioContext || window.webkitAudioContext)() : null;
const _ambNodes = {};

export function init(mixer) {
  _mixer = mixer;
}

export function playSfx(src, vol) {
  if (!_mixer) return;
  _mixer.play({ src, route: "sfx", volume: vol != null ? vol : 0.4 });
}

export function setAmbient(id, freq, type, targetVol, fadeSecs) {
  if (!_ambCtx) return;
  if (_ambCtx.state === "suspended") _ambCtx.resume();
  if (!_ambNodes[id]) {
    const osc = _ambCtx.createOscillator();
    const gain = _ambCtx.createGain();
    osc.type = type || "sine";
    osc.frequency.value = freq;
    gain.gain.value = 0;
    osc.connect(gain);
    gain.connect(_ambCtx.destination);
    osc.start();
    _ambNodes[id] = { osc, gain };
  }
  _ambNodes[id].osc.frequency.setTargetAtTime(freq, _ambCtx.currentTime, 0.3);
  _ambNodes[id].gain.gain.setTargetAtTime(targetVol, _ambCtx.currentTime, fadeSecs || 1.5);
}

export function isAmbientReady() {
  return !!_ambCtx && _ambCtx.state !== "closed";
}

export const Sfx = { init, playSfx, setAmbient, isAmbientReady };
export default Sfx;
