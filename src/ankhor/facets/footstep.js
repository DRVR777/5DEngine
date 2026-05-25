/** footstep — detect 12m, vol base 0.10, heavy 32/0.50, fast 62/0.28, normal 46/0.40 */
export default { priority: 78, tick(_t,d,_dt,_r){ if(d._init)return; d._init=true; d.FS_RADIUS=12; d.FS_VOL_BASE=0.10; d.FS_FREQ_HEAVY=32; d.FS_INT_HEAVY=0.50; d.FS_FREQ_FAST=62; d.FS_INT_FAST=0.28; d.FS_FREQ_NORMAL=46; d.FS_INT_NORMAL=0.40; } };
