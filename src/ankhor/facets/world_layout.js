/** world_layout — arena HALF=28, THICK=1.6, HEIGHT=2.2 */
export default { priority: 10, tick(_t,d,_dt,_r){ if(d._init)return; d._init=true; d.ARENA_HALF=28; d.ARENA_THICK=1.6; d.ARENA_HEIGHT=2.2; } };
