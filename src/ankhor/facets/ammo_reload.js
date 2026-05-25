export default {
  priority: 80,
  tick(thing, data, _dt, _registry) {
    if (!data.reloading || !data.reloadStart) return;
    const elapsed = Date.now() - data.reloadStart;
    const dur = data.reloadDurationMs || 1500;
    if (elapsed >= dur) {
      const need = (data.magCapacity || 17) - (data.pistolAmmo || 0);
      const take = Math.min(need, data.inventoryAmmo || 0);
      if (take > 0) { data.inventoryAmmo -= take; data.pistolAmmo = (data.pistolAmmo || 0) + take; data.pistolCooldown = 0; }
      data.reloading = false;
    }
    data.ammoColor = (data.pistolAmmo || 0) === 0 ? "#ff5d5d" : "#ffd166";
  }
};
