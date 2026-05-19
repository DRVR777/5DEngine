export function mountClockHudTick({ actions }) {
  function tick(now, dayMixFallback, el) {
    if (!el) return;
    let gameH, gameM, dayMix;
    const hour = actions.getDayNightHour();
    if (hour != null) {
      gameH = Math.floor(hour);
      gameM = Math.floor((hour - gameH) * 60);
      dayMix = Math.max(0, Math.min(1, (hour >= 6 && hour < 19) ? 1 - Math.abs(hour - 12.5) / 6.5 : 0));
    } else {
      const dayFrac = ((now / 1000) % 60) / 60;
      gameH = Math.floor(dayFrac * 24);
      gameM = Math.floor((dayFrac * 24 - gameH) * 60);
      dayMix = dayMixFallback;
    }
    const isPM = gameH >= 12;
    const h12 = ((gameH % 12) || 12).toString().padStart(2, "0");
    const mStr = gameM.toString().padStart(2, "0");
    const icon = dayMix > 0.7 ? "☀" : (dayMix > 0.3 ? "🌤" : "🌙");
    el.textContent = `${icon} ${h12}:${mStr} ${isPM ? "PM" : "AM"}`;
    el.style.color = dayMix > 0.5 ? "#ffd166" : "#6699cc";
  }
  return { tick };
}
