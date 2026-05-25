/** combo_hud — mul≥6 red #ff4466, mul≥4 orange #ff8800, else #ffd166, pulse 0.08*sin(12t), decay frac, display threshold combo≥2 */
export default {
  priority: 84,
  tick(_t, data, _dt, _r) {
    const count = data.comboCount || 0;
    data.comboVisible = count >= 2;
    if (!data.comboVisible) return;
    const mul = Math.min(8, count);
    data.comboMul = mul;
    data.comboHue = mul >= 6 ? "#ff4466" : mul >= 4 ? "#ff8800" : "#ffd166";
    data.comboPulse = 1 + 0.08 * Math.sin(Date.now() / 1000 * 12);
    const decay = data.comboDecay || 5;
    data.comboFrac = Math.min(1, Math.max(0, 1 - (Date.now() / 1000 - (data.comboLastT || 0)) / decay));
  }
};
