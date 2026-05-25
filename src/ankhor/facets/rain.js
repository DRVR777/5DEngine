export default { priority:12, tick(_t,d,_dt,_r){ if(d._init)return; d._init=true; d.rainDrops=true; d.rainIntensity=1; } };
