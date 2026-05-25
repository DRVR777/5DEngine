/** fast_charge — dist 2-8m, cd 3.5-5.5s, dur 0.38s, speed 2.2x, hitbox 0.7x0.7 */
export default { priority: 38, tick(_t,d,_dt,_r){ if(d._init)return; d._init=true; d.CHARGE_DIST_MIN=2.0; d.CHARGE_DIST_MAX=8; d.CHARGE_CD_BASE=3.5; d.CHARGE_CD_RANGE=2.0; d.CHARGE_CD_DEFAULT=4.0; d.CHARGE_DUR=0.38; d.CHARGE_SPEED_MUL=2.2; } };
