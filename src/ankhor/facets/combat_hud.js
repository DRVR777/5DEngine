/** combat_hud — hitScale=1.5, spread*0.6, opacity 0.7-spread*0.3, km fade/300, kmH=#ffd166 kmN=#ff2244 */
export default {
  priority: 85,
  tick(_t, data, _dt, _r) {
    data.hitNow = Date.now() < (data.hitMarkerUntil || 0);
    const spread = data.moveSpread || 0;
    data.crosshairScale = data.hitNow ? 1.5 : 1 + spread * 0.6;
    data.crosshairOpacity = data.hitNow ? "var(--holo-red)" : `rgba(0,200,255,${(0.7 - spread * 0.3).toFixed(2)})`;
    if (Date.now() < (data.killMarkerUntil || 0)) {
      data.killFade = Math.max(0, ((data.killMarkerUntil || 0) - Date.now()) / 300);
      data.killBg = data.killMarkerHs ? "#ffd166" : "#ff2244";
    } else { data.killFade = 0; }
  }
};
