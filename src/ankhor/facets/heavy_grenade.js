/** heavy_grenade — cd 4s/2.5s, dist 3.5-12m, tof 1.5s */
export default { priority: 37, tick(_t,d,_dt,_r){ if(d._init)return; d._init=true; d.HG_CD=4.0; d.HG_CD_ENRAGED=2.5; d.HG_MIN_RANGE=3.5; d.HG_MAX_RANGE=12; d.HG_TOF=1.5; } };
