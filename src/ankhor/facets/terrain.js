export default { priority:50, tick(_t,d,_dt,_r){ if(d._init)return; d._init=true; d.gridSize=100; } };
