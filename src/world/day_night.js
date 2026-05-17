// src/world/day_night.js — automatic day/night cycle
// Rotates the sun through a full arc, blends sky/fog/ambient colors,
// fires EventBus events at dawn/dusk, updates window._sunLight.
//
// API (window.DayNight):
//   init(opts)       — attach to scene; call once
//   tick(dt)         — advance clock; call every frame
//   setHour(h)       — jump to hour 0-24
//   getHour()        → float 0..24
//   pause(bool)
//   speed            — public: time scale (default 1; 60 = 1 real min per game day)
//
// opts:
//   scene            — THREE.Scene (for fog color)
//   sunLight         — THREE.DirectionalLight
//   ambLight         — THREE.AmbientLight
//   renderer         — THREE.WebGLRenderer (for clear color)
//   speed            — game minutes per real second (default 1)
//   startHour        — float (default 8.0)
//   onHourChange(h)  — callback each game hour

(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.DayNight = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  let _scene    = null;
  let _sun      = null;
  let _amb      = null;
  let _renderer = null;
  let _hour     = 8.0;
  let _paused   = false;
  let _speed    = 1.0;         // game-minutes per real-second  (1 = very slow)
  let _lastGameHour = -1;
  let _onHourChange = null;
  let _initialized  = false;

  // Keyframes for sky color, fog color, ambient intensity, sun intensity
  // at hours 0..24 (0 = midnight, 6 = dawn, 12 = noon, 18 = dusk)
  const _kf = [
    // [hour, skyHex, fogHex, ambI, sunI, sunColor]
    [ 0, 0x020818, 0x030c1e, 0.05, 0.0,  0x102040 ],
    [ 4, 0x040c22, 0x050e28, 0.06, 0.0,  0x1a2a50 ],
    [ 5, 0x1a2040, 0x202848, 0.15, 0.05, 0x4060a0 ],
    [ 6, 0xf4a147, 0xe8956c, 0.30, 0.4,  0xff9955 ],  // sunrise
    [ 7, 0x87b8e8, 0xa0c4e4, 0.50, 0.7,  0xffeedd ],
    [ 9, 0x87ceeb, 0xaad4f0, 0.60, 1.0,  0xffffff ],
    [12, 0x6ab4e8, 0x88c8f0, 0.65, 1.2,  0xfff9f0 ],  // noon — slightly warmer
    [15, 0x78bce8, 0x90caf0, 0.60, 1.0,  0xffeedd ],
    [17, 0xe87848, 0xe8946a, 0.40, 0.6,  0xff6600 ],  // sunset
    [18, 0xb04020, 0xb05030, 0.25, 0.2,  0xff4400 ],
    [19, 0x301828, 0x280e1a, 0.12, 0.0,  0x301828 ],
    [21, 0x060c1c, 0x050a18, 0.07, 0.0,  0x101838 ],
    [24, 0x020818, 0x030c1e, 0.05, 0.0,  0x102040 ],
  ];

  function _lerp(a, b, t) { return a + (b - a) * t; }

  function _lerpColor(cA, cB, t) {
    const rA = (cA >> 16) & 0xff, gA = (cA >> 8) & 0xff, bA = cA & 0xff;
    const rB = (cB >> 16) & 0xff, gB = (cB >> 8) & 0xff, bB = cB & 0xff;
    return (Math.round(_lerp(rA, rB, t)) << 16) |
           (Math.round(_lerp(gA, gB, t)) << 8)  |
           (Math.round(_lerp(bA, bB, t)));
  }

  function _sample(hour) {
    const h = ((hour % 24) + 24) % 24;
    let lo = _kf[0], hi = _kf[_kf.length - 1];
    for (let i = 0; i < _kf.length - 1; i++) {
      if (_kf[i][0] <= h && _kf[i + 1][0] >= h) { lo = _kf[i]; hi = _kf[i + 1]; break; }
    }
    const span = hi[0] - lo[0] || 1;
    const t = (h - lo[0]) / span;
    return {
      sky:      _lerpColor(lo[1], hi[1], t),
      fog:      _lerpColor(lo[2], hi[2], t),
      ambI:     _lerp(lo[3], hi[3], t),
      sunI:     _lerp(lo[4], hi[4], t),
      sunColor: _lerpColor(lo[5], hi[5], t),
    };
  }

  function _applyColors(s) {
    if (_scene) {
      _scene.background && (_scene.background.setHex ? _scene.background.setHex(s.sky) : null);
      if (_scene.fog) { _scene.fog.color.setHex(s.fog); }
    }
    if (_renderer) _renderer.setClearColor(s.sky);
    if (_amb)  { _amb.intensity = s.ambI; }
    if (_sun)  {
      _sun.intensity = s.sunI;
      _sun.color.setHex(s.sunColor);
      // Orbit sun: 0h=below horizon, 12h=zenith, 24h=below again
      const angle = ((_hour / 24) * Math.PI * 2) - Math.PI / 2;
      const r = 80;
      _sun.position.set(Math.cos(angle) * r, Math.sin(angle) * r, 20);
      if (_sun.target) _sun.target.position.set(0, 0, 0);
    }
  }

  function init(opts = {}) {
    _scene    = opts.scene    || (typeof window !== "undefined" && window._scene) || null;
    _sun      = opts.sunLight || (typeof window !== "undefined" && window._sunLight) || null;
    _amb      = opts.ambLight || (typeof window !== "undefined" && window._ambLight) || null;
    _renderer = opts.renderer || (typeof window !== "undefined" && window._renderer) || null;
    _speed    = opts.speed    || 1.0;
    _hour     = opts.startHour != null ? opts.startHour : 8.0;
    _onHourChange = opts.onHourChange || null;
    _initialized  = true;
    _applyColors(_sample(_hour));
  }

  function tick(dt) {
    if (!_initialized || _paused) return;
    _hour += (_speed / 60) * dt;   // _speed game-mins/s → game-hours/s = /60
    if (_hour >= 24) _hour -= 24;

    _applyColors(_sample(_hour));

    const floorHour = Math.floor(_hour);
    if (floorHour !== _lastGameHour) {
      _lastGameHour = floorHour;
      if (_onHourChange) _onHourChange(_hour);
      // EventBus events
      if (typeof EventBus !== "undefined") {
        if (floorHour === 6)  EventBus.emit("world:dawn",  { hour: _hour });
        if (floorHour === 12) EventBus.emit("world:noon",  { hour: _hour });
        if (floorHour === 18) EventBus.emit("world:dusk",  { hour: _hour });
        if (floorHour === 0)  EventBus.emit("world:midnight", { hour: _hour });
      }
      if (typeof DevConsole !== "undefined" && typeof Engine !== "undefined" && Engine.debug.enabled) {
        DevConsole.print(`[DayNight] ${floorHour}:00`, "echo");
      }
    }
  }

  function setHour(h) { _hour = ((h % 24) + 24) % 24; _applyColors(_sample(_hour)); }
  function getHour()  { return _hour; }
  function pause(on)  { _paused = on; }

  return {
    init, tick, setHour, getHour, pause,
    get speed() { return _speed; },
    set speed(v) { _speed = v; },
    get hour() { return _hour; },
  };
});
