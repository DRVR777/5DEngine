export default { priority:70, tick(_t,d,_dt,_r){ if(d._init)return; d._init=true; d.HP_COLLECT_DIST=1.2; d.HP_GAIN=15; } };
