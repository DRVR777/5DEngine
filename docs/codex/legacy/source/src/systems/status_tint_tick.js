const PILL_POISON  = "font-family:var(--mono);font-size:10px;padding:2px 7px;border-radius:3px;background:rgba(0,100,20,0.85);border:1px solid #00bb44;color:#66ff99;letter-spacing:0.08em";
const PILL_BURNING = "font-family:var(--mono);font-size:10px;padding:2px 7px;border-radius:3px;background:rgba(100,30,0,0.85);border:1px solid #ff6600;color:#ffaa44;letter-spacing:0.08em";
const PILL_EMP     = "font-family:var(--mono);font-size:10px;padding:2px 7px;border-radius:3px;background:rgba(0,20,80,0.85);border:1px solid #4488ff;color:#88bbff;letter-spacing:0.08em";

export function mountStatusTintTick({ get, set, actions }) {
  function tick(dt, now, tintEl, hudEl) {
    const sfxList = actions.getActiveEffects("hero") || [];
    const hasPoisoned = sfxList.some(e => e.id === "poison");
    const hasBurning  = get.heroFireT() > 0 || sfxList.some(e => e.id === "burning");

    if (tintEl) {
      if (get.heroBlindT() > 0) {
        set.heroBlindT(get.heroBlindT() - dt);
        const fade = Math.min(1, get.heroBlindT() * 1.5);
        tintEl.style.background = `rgba(255,255,255,${fade.toFixed(2)})`;
        tintEl.style.opacity = "1";
      } else if (hasPoisoned || hasBurning) {
        const pulse = 0.12 + 0.08 * Math.sin(now / 220);
        const r = hasBurning ? 255 : 0, g = hasPoisoned ? 180 : (hasBurning ? 80 : 0);
        tintEl.style.background = `radial-gradient(ellipse at center, transparent 50%, rgba(${r},${g},0,0.7) 100%)`;
        tintEl.style.opacity = pulse.toFixed(3);
      } else {
        tintEl.style.opacity = "0";
      }
    }

    if (hudEl) {
      const pills = [];
      if (hasPoisoned) {
        const pt = sfxList.find(e => e.id === "poison");
        const ps = pt && pt.timeLeft ? Math.ceil(pt.timeLeft) : "";
        pills.push(`<div style="${PILL_POISON}">POISON${ps ? " " + ps + "s" : ""}</div>`);
      }
      if (hasBurning) {
        const bt = Math.ceil(get.heroFireT());
        pills.push(`<div style="${PILL_BURNING}">BURNING${bt > 0 ? " " + bt + "s" : ""}</div>`);
      }
      if (get.heroEmpT() > 0) {
        pills.push(`<div style="${PILL_EMP}">EMP ${Math.ceil(get.heroEmpT())}s</div>`);
      }
      hudEl.style.display = pills.length ? "flex" : "none";
      hudEl.innerHTML = pills.join("");
    }
  }
  return { tick };
}
