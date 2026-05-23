export function mountWeaponHudTick({ get, set, actions }) {
  function tick(now, pistolAmmo, reloading, grenades, els) {
    const { wpName, wpAmmo, wpReserve, wpMagBar, wpGrenades } = els;
    if (!wpName && !wpAmmo) return;

    const wp = actions.getWeapon();
    if (wpName) wpName.textContent = (wp.name || wp.id || "weapon").toUpperCase();
    const reserve = actions.getReserve(wp.ammoItem || "pistol_9mm");
    if (wpAmmo) wpAmmo.childNodes[0].textContent = pistolAmmo;
    if (wpReserve) wpReserve.textContent = " / " + reserve;

    const lowAmmoThresh = Math.max(1, Math.floor((wp.magCap || 12) * 0.25));
    const isLowAmmo = pistolAmmo > 0 && pistolAmmo <= lowAmmoThresh && !reloading;
    if (wpAmmo) {
      const flash = isLowAmmo ? (Math.sin(now / 110) > 0 ? "#ff2222" : "#ff8888") : "var(--holo-warn)";
      wpAmmo.style.color = flash;
    }
    if (isLowAmmo && get.lowAmmoWarnedAt() !== pistolAmmo) {
      set.lowAmmoWarnedAt(pistolAmmo);
      actions.playSfx("tone:440:60:square", 0.15);
      actions.playSfx("tone:330:45:square", 0.10);
    }
    if (!isLowAmmo) set.lowAmmoWarnedAt(-1);

    if (wpMagBar && (pistolAmmo !== get.lastMagBarAmmo() || reloading !== get.lastMagBarReloading())) {
      set.lastMagBarAmmo(pistolAmmo);
      set.lastMagBarReloading(reloading);
      const cap = Math.min(wp.magCap || 12, 30);
      const filled = Math.min(pistolAmmo, cap);
      wpMagBar.innerHTML = Array.from({ length: cap }, (_, i) => {
        const lit = i < filled;
        const clr = reloading ? "#ff8800" : (lit ? "#00ccff" : "#1a2a3a");
        return `<div style="width:5px;height:10px;background:${clr};border-radius:1px;opacity:${lit || reloading ? 1 : 0.4}"></div>`;
      }).join("");
    }

    if (wpGrenades) {
      const { frag, smoke, flash, mines } = grenades;
      wpGrenades.innerHTML = `⬡ ${frag} frag <span style="color:#555">[G]</span>  ◎ ${smoke} smoke <span style="color:#555">[T]</span>  ◈ ${flash} flash <span style="color:#555">[U]</span>  ⊠ ${mines} mine${mines !== 1 ? "s" : ""} <span style="color:#555">[M]</span>`;
    }
  }
  return { tick };
}
