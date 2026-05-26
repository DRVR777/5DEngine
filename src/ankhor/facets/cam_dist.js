/** cam_dist — lerp rate 8 from legacy mountCamDistTick */
export default { priority: 95, init(_t,d){ d.LERP_RATE=8; d.SNAP_EPSILON=0.05; } };
