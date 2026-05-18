// HUD element cache + damage-direction SVG — initialized once at startup.
// mountHudElements() → { dom, hud, mini, MINI_HALF, dmgDirSvg, dmgDirG }
export function mountHudElements(CFG) {
  if (typeof document === "undefined") {
    return { dom: {}, hud: null, mini: null, MINI_HALF: 35, dmgDirSvg: null, dmgDirG: null };
  }

  const hud  = document.getElementById("hud");
  const mini = document.getElementById("minimap")?.getContext("2d") || null;
  const MINI_HALF = (CFG && CFG.miniMapHalfExtent) || 35;

  const dom = {
    fpsCounter:       document.getElementById("fpsCounter"),
    ammoHud:          document.getElementById("ammoHud"),
    reloadCircle:     document.getElementById("reloadCircle"),
    scopeOverlay:     document.getElementById("scopeOverlay"),
    crosshair:        document.getElementById("crosshair"),
    killMarker:       document.getElementById("killMarker"),
    dmgDirIndicator:  document.getElementById("dmgDirIndicator"),
    hbGhost:          document.getElementById("hbGhost"),
    hbFill:           document.getElementById("hbFill"),
    hbVal:            document.getElementById("hbVal"),
    armorBar:         document.getElementById("armorBar"),
    arFill:           document.getElementById("arFill"),
    arVal:            document.getElementById("arVal"),
    stFill:           document.getElementById("stFill"),
    bossHpBar:        document.getElementById("bossHpBar"),
    bossHpFill:       document.getElementById("bossHpFill"),
    bossHpVal:        document.getElementById("bossHpVal"),
    bossName:         document.getElementById("bossName"),
    comboHud:         document.getElementById("comboHud"),
    comboMulText:     document.getElementById("comboMulText"),
    comboFill:        document.getElementById("comboFill"),
    wpName:           document.getElementById("wpName"),
    wpAmmo:           document.getElementById("wpAmmo"),
    wpReserve:        document.getElementById("wpReserve"),
    wpMagBar:         document.getElementById("wpMagBar"),
    wpGrenades:       document.getElementById("wpGrenades"),
    vehicleDash:      document.getElementById("vehicleDash"),
    vdSpeed:          document.getElementById("vdSpeed"),
    vdGear:           document.getElementById("vdGear"),
    waveHud:          document.getElementById("waveHud"),
    waveLabel:        document.getElementById("waveLabel"),
    waveDetail:       document.getElementById("waveDetail"),
    waveBanner:       document.getElementById("waveBanner"),
    waveBannerLabel:  document.getElementById("waveBannerLabel"),
    waveBannerSub:    document.getElementById("waveBannerSub"),
    heroLevelHud:     document.getElementById("heroLevelHud"),
    waveChallengeHud: document.getElementById("waveChallengeHud"),
    statusTint:       document.getElementById("statusTint"),
    statusEffectsHud: document.getElementById("statusEffectsHud"),
    clockHud:         document.getElementById("clockHud"),
    grenadeWarn:      document.getElementById("grenadeWarn"),
    grenCookTimer:    document.getElementById("grenCookTimer"),
  };

  // Pre-create dmgDir SVG once — transform attr updated in tick() instead of rebuilding innerHTML
  const _SVG_NS = "http://www.w3.org/2000/svg";
  const dmgDirSvg  = document.createElementNS(_SVG_NS, "svg");
  dmgDirSvg.setAttribute("width", "120"); dmgDirSvg.setAttribute("height", "120");
  dmgDirSvg.setAttribute("viewBox", "-60 -60 120 120");
  const dmgDirG    = document.createElementNS(_SVG_NS, "g");
  const dmgDirPoly = document.createElementNS(_SVG_NS, "polygon");
  dmgDirPoly.setAttribute("points", "0,-42 -10,-26 10,-26");
  dmgDirPoly.setAttribute("fill", "rgba(255,40,40,0.9)");
  dmgDirPoly.setAttribute("stroke", "rgba(255,80,80,0.5)");
  dmgDirPoly.setAttribute("stroke-width", "1");
  dmgDirG.appendChild(dmgDirPoly);
  dmgDirSvg.appendChild(dmgDirG);
  if (dom.dmgDirIndicator) dom.dmgDirIndicator.appendChild(dmgDirSvg);

  return { dom, hud, mini, MINI_HALF, dmgDirSvg, dmgDirG };
}
