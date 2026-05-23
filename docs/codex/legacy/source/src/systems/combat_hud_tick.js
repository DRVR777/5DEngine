export function mountCombatHudTick() {
  function tick(els, { now, hitMarkerUntil, killMarkerUntil, killMarkerHs, moveSpread, dmgDirAngle, dmgDirUntil, camYaw, dmgDirG }) {
    const { crosshair, killMarker, dmgDirIndicator } = els;

    if (crosshair) {
      const hitNow = now < hitMarkerUntil;
      crosshair.style.transform = `translate(-50%,-50%) scale(${(hitNow ? 1.5 : 1 + moveSpread * 0.6).toFixed(2)})`;
      crosshair.style.borderColor = hitNow
        ? "var(--holo-red)"
        : `rgba(0,200,255,${(0.7 - moveSpread * 0.3).toFixed(2)})`;
    }

    if (killMarker) {
      if (now < killMarkerUntil) {
        const fade = Math.max(0, (killMarkerUntil - now) / 300);
        killMarker.style.display = "block";
        killMarker.style.background = killMarkerHs ? "#ffd166" : "#ff2244";
        killMarker.style.boxShadow = `0 0 6px ${killMarkerHs ? "#ffd166" : "#ff2244"}`;
        killMarker.style.opacity = fade.toFixed(2);
      } else {
        killMarker.style.display = "none";
      }
    }

    if (dmgDirIndicator) {
      if (now < dmgDirUntil) {
        const fade = Math.max(0, (dmgDirUntil - now) / 1200);
        dmgDirIndicator.style.display = "block";
        dmgDirIndicator.style.opacity = (fade * 0.85).toFixed(2);
        if (dmgDirG) dmgDirG.setAttribute("transform", `rotate(${((dmgDirAngle - camYaw) * 180 / Math.PI).toFixed(1)})`);
      } else {
        dmgDirIndicator.style.display = "none";
      }
    }
  }
  return { tick };
}
