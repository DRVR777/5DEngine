// High score — extracted from index.html
// Persists to localStorage. API: HighScore.check(kills, wave, acc), HighScore.get()

const _HS_KEY = "5DEngine_highscore";
let _bestRecord = null;
try { _bestRecord = JSON.parse(localStorage.getItem(_HS_KEY)); } catch (_) {}

export function check(kills, wave, acc) {
  const score = kills * 10 + wave * 50 + acc;
  const prevBest = _bestRecord ? (_bestRecord.kills * 10 + _bestRecord.wave * 50 + _bestRecord.acc) : -1;
  if (score > prevBest) {
    _bestRecord = { kills, wave, acc, ts: Date.now() };
    try { localStorage.setItem(_HS_KEY, JSON.stringify(_bestRecord)); } catch (_) {}
    return true;
  }
  return false;
}

export function get() { return _bestRecord; }

export const HighScore = { check, get };
export default HighScore;
