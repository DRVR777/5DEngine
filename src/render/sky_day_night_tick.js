export function mountSkyDayNightTick({ actions }) {
  function tick(dn) {
    const sunsetMix = Math.max(0, 1 - Math.abs(dn.sun.y) * 5) * (dn.sun.y < 0.3 ? 1 : 0);
    actions.setTopColor(
      0.05 + 0.48 * dn.dayMix + 0.4 * sunsetMix,
      0.07 + 0.73 * dn.dayMix + 0.18 * sunsetMix,
      0.18 + 0.74 * dn.dayMix
    );
    actions.setBottomColor(
      0.10 + 0.85 * dn.dayMix + 0.5 * sunsetMix,
      0.15 + 0.70 * dn.dayMix + 0.25 * sunsetMix,
      0.30 + 0.50 * dn.dayMix
    );
    actions.setFogColor(dn.sky.r, dn.sky.g, dn.sky.b);
    actions.setSunPos(dn.sun.x * 30, Math.max(2, dn.sun.y * 30), dn.sun.z * 30);
    actions.setSunIntensity(0.3 + 1.0 * dn.dayMix);
  }
  return { tick };
}
