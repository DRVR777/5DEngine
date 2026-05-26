/** boss_bar — color gradients from legacy boss_bar_tick */
export default {
  priority: 50,
  init(_t, data) {
    data.GRAD_BOSS_HIGH = "linear-gradient(90deg,#cc0000,#ff4400)";
    data.GRAD_BOSS_MID = "linear-gradient(90deg,#aa0000,#ff2200)";
    data.GRAD_BOSS_LOW = "linear-gradient(90deg,#660000,#cc0000)";
  }
};
