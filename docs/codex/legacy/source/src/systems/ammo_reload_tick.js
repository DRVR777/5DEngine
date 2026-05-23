// Ammo HUD text + reload-circle show/hide + reload completion logic.
export function mountAmmoReloadTick({ set, actions }) {
  function tick(_dt, { nowMs, reloading, reloadStart, pistolAmmo }) {
    const reloadDur = actions.getReloadDur();

    // Reload circle: visible while in progress, hides (and finalises) on completion
    const circleEl = actions.getReloadCircle();
    if (circleEl) {
      if (reloading && nowMs < reloadStart + reloadDur) {
        circleEl.style.display = "block";
      } else {
        if (reloading && nowMs >= reloadStart + reloadDur) {
          set.reloading(false);
          const wep = actions.getWeapon();
          const magCap = actions.getMagCap();
          const need = magCap - pistolAmmo;
          const invAmmo = actions.countInvAmmo(wep.ammoItem || "pistol_9mm");
          const take = Math.min(need, invAmmo);
          if (take > 0) {
            actions.removeInvAmmo(wep.ammoItem || "pistol_9mm", take);
            const newAmmo = pistolAmmo + take;
            set.pistolAmmo(newAmmo);
            actions.setAmmo(newAmmo);
            set.pistolCooldown(0);
          }
        }
        circleEl.style.display = "none";
      }
    }

    // Ammo HUD — displayed after reload completes so count is up to date
    const ammoEl = actions.getAmmoHud();
    if (ammoEl) {
      const wep = actions.getWeapon();
      const reserve = actions.countInvAmmo(wep.ammoItem || "pistol_9mm");
      const mag = set.getPistolAmmo();
      ammoEl.textContent = `${mag} / ${reserve}`;
      ammoEl.style.color = mag === 0 ? "#ff5d5d" : "#ffd166";
    }
  }

  return { tick };
}
