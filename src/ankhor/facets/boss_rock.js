/** boss_rock — cooldown 6s/3.5s enraged, range 5-15m, tof 1.8s */
export default { priority: 37, tick(_t,d,_dt,_r){ if(d._init)return; d._init=true; d.ROCK_CD=6.0; d.ROCK_CD_ENRAGED=3.5; d.ROCK_MIN_RANGE=5; d.ROCK_MAX_RANGE=15; d.ROCK_TOF=1.8; } };
