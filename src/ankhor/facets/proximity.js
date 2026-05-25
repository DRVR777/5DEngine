/** proximity — magic numbers: INTERACT_DIST=2.5, SCREEN_HUE_PERIOD=2000 */
export default {
  priority: 75,
  tick(_t, data, _dt, _r) {
    const hu = data.heroU || 0, hv = data.heroV || 0;
    data.nearComputer = Math.hypot(hu - (data.compU || 0), hv - (data.compV || 0)) < 2.5;
    data.screenHue = (Date.now() / 2000) % 1;
    data.nearNpc = null;
    if (!data.dialogOpen && !data.computerOpen) {
      for (const n of (data.npcDefs || [])) {
        if (Math.hypot(hu - (n.u || 0), hv - (n.v || 0)) < 2.5) { data.nearNpc = n; break; }
      }
    }
  }
};
