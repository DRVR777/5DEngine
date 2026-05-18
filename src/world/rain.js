// Rain system — extracted from index.html
// Public API: Rain.setRain(bool), Rain.tick(dt)

const RAIN_COUNT = 180;
let _rainActive = false;
let _rainDrops = [];
let _rainCtx = null;
let _canvas = null;

function _initRain() {
  _canvas = document.getElementById("rainCanvas");
  if (!_canvas) return;
  _canvas.width = innerWidth; _canvas.height = innerHeight;
  _rainCtx = _canvas.getContext("2d");
  _rainDrops = [];
  for (let i = 0; i < RAIN_COUNT; i++) {
    _rainDrops.push({
      x: Math.random() * innerWidth,
      y: Math.random() * innerHeight,
      len: 8 + Math.random() * 14,
      speed: 280 + Math.random() * 200,
      alpha: 0.2 + Math.random() * 0.4,
    });
  }
}

export function setRain(on) {
  _rainActive = on;
  if (!_canvas) _canvas = document.getElementById("rainCanvas");
  if (!_canvas) return;
  _canvas.style.display = on ? "block" : "none";
  if (on && !_rainCtx) _initRain();
}

export function tick(dt) {
  if (!_rainActive || !_rainCtx) return;
  if (!_canvas) return;
  if (_canvas.width !== innerWidth || _canvas.height !== innerHeight) {
    _canvas.width = innerWidth; _canvas.height = innerHeight;
  }
  _rainCtx.clearRect(0, 0, _canvas.width, _canvas.height);
  _rainCtx.strokeStyle = "rgba(160,220,255,";
  _rainCtx.lineWidth = 0.8;
  for (const d of _rainDrops) {
    d.y += d.speed * dt;
    d.x += d.speed * dt * 0.18;
    if (d.y > _canvas.height + 20) {
      d.y = -20; d.x = Math.random() * _canvas.width;
    }
    _rainCtx.globalAlpha = d.alpha;
    _rainCtx.beginPath();
    _rainCtx.moveTo(d.x, d.y);
    _rainCtx.lineTo(d.x + d.len * 0.18, d.y + d.len);
    _rainCtx.stroke();
  }
  _rainCtx.globalAlpha = 1;
}

addEventListener("resize", () => {
  if (_rainCtx && _canvas) {
    _canvas.width = innerWidth; _canvas.height = innerHeight;
    _rainDrops = [];
    _initRain();
  }
});

export function toggle() { setRain(!_rainActive); }
export function isActive() { return _rainActive; }

export const Rain = { setRain, tick, toggle, isActive };
export default Rain;
