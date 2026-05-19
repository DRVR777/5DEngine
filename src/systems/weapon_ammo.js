const PISTOL_FALLBACK = {
  id: "pistol", ammoItem: "pistol_9mm", fireRate: 5, damage: 20,
  range: 30, speed: 80, magCap: 12, bulletRadius: 0.04, reloadDuration: 1200,
  pellets: 1, spread: 0, automatic: false,
};

export function mountWeaponAmmo({ getWeapons, getActiveWeaponId }) {
  const weaponAmmo = new Map();

  function getWeapon() {
    const weps = getWeapons() || [];
    return weps.find(w => w.id === getActiveWeaponId()) || PISTOL_FALLBACK;
  }

  function getAmmo() {
    const w = getWeapon();
    return weaponAmmo.has(w.id) ? weaponAmmo.get(w.id) : w.magCap;
  }

  function setAmmo(n) {
    weaponAmmo.set(getActiveWeaponId(), n);
  }

  return { getWeapon, getAmmo, setAmmo, weaponAmmo };
}
