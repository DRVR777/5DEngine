// cutscene.js — 5DEngine camera path + cutscene player
// Animates the camera along a Catmull-Rom spline through defined keyframes.
// While playing, player input is locked and a letterbox overlay appears.
//
// API (window.Cutscene):
//   define(id, keyframes)
//     keyframes: [{pos:{x,y,z}, target:{x,y,z}, duration, ease}, ...]
//   play(id, opts)
//     opts: { onComplete, letterbox, skipKey }  (defaults: letterbox=true, skipKey="Escape")
//   stop()
//   isPlaying()
//   record()        — start recording camera positions every 0.5s (build mode tool)
//   stopRecord()    — stop recording, returns keyframe array
//
// Fires window CustomEvent "cutsceneEnd" with detail {id} when finished.
// Input lock: sets window._cutscenePlaying = true (checked by main keydown handler).

(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Cutscene = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const _scenes = new Map();    // id → keyframe[]
  let   _playing = null;        // active play state
  let   _recording = false;
  let   _recordFrames = [];
  let   _recordTimer  = 0;

  // ---- easing ----
  function _ease(t, type) {
    if (type === "linear") return t;
    if (type === "in")  return t * t;
    if (type === "out") return t * (2 - t);
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;  // inOut (default)
  }

  function _lerp(a, b, t) { return a + (b - a) * t; }
  function _lerpV(a, b, t) {
    return { x: _lerp(a.x, b.x, t), y: _lerp(a.y, b.y, t), z: _lerp(a.z, b.z, t) };
  }

  function define(id, keyframes) {
    _scenes.set(id, keyframes.map(kf => ({ ...kf })));
  }

  function play(id, opts = {}) {
    const kfs = _scenes.get(id);
    if (!kfs || !kfs.length) { console.warn("[Cutscene] unknown id:", id); return; }
    stop();
    _playing = {
      id,
      kfs,
      segIdx: 0,
      segT: 0,
      letterbox: opts.letterbox !== false,
      onComplete: opts.onComplete || null,
      skipKey: opts.skipKey || "Escape",
    };
    window._cutscenePlaying = true;
    if (_playing.letterbox) _showLetterbox(true);
    _installSkipKey();
  }

  function stop() {
    if (!_playing) return;
    window._cutscenePlaying = false;
    _showLetterbox(false);
    _removeSkipKey();
    const { id, onComplete } = _playing;
    _playing = null;
    window.dispatchEvent(new CustomEvent("cutsceneEnd", { detail: { id } }));
    if (typeof onComplete === "function") onComplete();
  }

  function isPlaying() { return !!_playing; }

  // Call from main animation tick with dt (seconds) and camera object
  function tick(dt, camera) {
    // Recording mode: sample camera pos every 0.5s
    if (_recording) {
      _recordTimer += dt;
      if (_recordTimer >= 0.5) {
        _recordTimer = 0;
        _recordFrames.push({
          pos:    { x: camera.position.x, y: camera.position.y, z: camera.position.z },
          target: { x: 0, y: 0, z: 0 },  // user fills in target manually
          duration: 0.5,
          ease: "inOut",
        });
      }
    }

    if (!_playing) return;

    const { kfs, segIdx } = _playing;
    if (segIdx >= kfs.length - 1) { stop(); return; }

    const from = kfs[segIdx];
    const to   = kfs[segIdx + 1];
    const segDur = from.duration || 1.0;

    _playing.segT += dt;
    let t = Math.min(1, _playing.segT / segDur);
    t = _ease(t, from.ease || "inOut");

    // Interpolate camera position
    const pos = _lerpV(from.pos, to.pos, t);
    camera.position.set(pos.x, pos.y, pos.z);

    // Interpolate look-at target
    if (from.target && to.target) {
      const tgt = _lerpV(from.target, to.target, t);
      camera.lookAt(tgt.x, tgt.y, tgt.z);
    }

    if (_playing.segT >= segDur) {
      _playing.segIdx++;
      _playing.segT = 0;
      if (_playing.segIdx >= kfs.length - 1) stop();
    }
  }

  // ---- Recording ----
  function record() {
    _recording = true;
    _recordFrames = [];
    _recordTimer = 0;
  }

  function stopRecord() {
    _recording = false;
    return [..._recordFrames];
  }

  // ---- Letterbox overlay ----
  function _showLetterbox(on) {
    let el = document.getElementById("_cutsceneLetterbox");
    if (!el && on) {
      el = document.createElement("div");
      el.id = "_cutsceneLetterbox";
      el.style.cssText = "position:fixed;left:0;right:0;pointer-events:none;z-index:9000;transition:height 0.35s";
      const top = document.createElement("div");
      top.id = "_lbTop";
      top.style.cssText = "position:fixed;top:0;left:0;right:0;background:#000;height:0;transition:height 0.35s;z-index:9001";
      const bot = document.createElement("div");
      bot.id = "_lbBot";
      bot.style.cssText = "position:fixed;bottom:0;left:0;right:0;background:#000;height:0;transition:height 0.35s;z-index:9001";
      document.body.appendChild(top);
      document.body.appendChild(bot);
    }
    const top = document.getElementById("_lbTop");
    const bot = document.getElementById("_lbBot");
    if (!top || !bot) return;
    const h = on ? "12vh" : "0px";
    top.style.height = h;
    bot.style.height = h;
  }

  // ---- Skip key ----
  function _skipHandler(e) { if (_playing && e.key === _playing.skipKey) stop(); }
  function _installSkipKey()  { window.addEventListener("keydown", _skipHandler); }
  function _removeSkipKey()   { window.removeEventListener("keydown", _skipHandler); }

  return { define, play, stop, isPlaying, tick, record, stopRecord };
});
