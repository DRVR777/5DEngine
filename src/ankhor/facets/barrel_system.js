/** barrel_system — barrel HP=40, maxHp=40, explodes when hp<=0 */
export default {
  priority: 60,
  tick(_t, data, _dt, _r) {
    const barrels = data.barrels; if (!barrels || !barrels.length) return;
    for (const b of barrels) {
      if (b.exploded) continue;
      if (b.hp <= 0) { b.exploded = true; data.barrelsExploded = (data.barrelsExploded || 0) + 1; }
    }
  }
};
