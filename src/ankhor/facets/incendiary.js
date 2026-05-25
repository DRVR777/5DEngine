/** incendiary — trail 1s, patch dur 2.2s, radius 1.0, trail fade 0.6 */
export default { priority: 37, tick(_t,d,_dt,_r){ if(d._init)return; d._init=true; d.INC_TRAIL_INTERVAL=1.0; d.INC_PATCH_DUR=2.2; d.INC_PATCH_RADIUS=1.0; d.INC_TRAIL_FADE=0.6; } };
