/** enemy_mesh — 9 constants from legacy mountEnemyMeshTick */
export default {
  priority: 42,
  init(_t, data) {
    data.COLLAPSE_DUR = 0.6;
    data.BLEED_INTERVAL = 0.12;
    data.BLEED_HP_FRAC = 0.30;
    data.FLASH_DUR_MAX = 2.0;
    data.SPAWN_DUR = 0.4;
    data.FLINCH_SPRING = 14;
    data.BOB_FREQ_MUL = 3.5;
    data.GEM_SPIN_RATE = 2.5;
    data.HP_BAR_SHOW_T = 2.5;
    data.BOB_AMP = { boss: 0.06, heavy: 0.05, fast: 0.04 };
    data.BOB_AMP_DEFAULT = 0.035;
  }
};
