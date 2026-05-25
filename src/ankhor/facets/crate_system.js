/** crate_system — crate HP=35, maxHp=35, broken state */
export default {
  priority: 60,
  tick(_t, data, dt, _r) {
    const crates = data.crates; if (!crates || !crates.length) return;
    for (const c of crates) {
      if (c.broken) continue;
      if (c.hp <= 0) { c.broken = true; data.cratesBroken = (data.cratesBroken || 0) + 1; }
    }
  }
};
