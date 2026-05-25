export default { priority:50, tick(_t,d,_dt,_r){ if(d._init)return; d._init=true; d.FOW_RADIUS=25; d.FOW_FADE_START=18; d.FOW_OPACITY=0.85; } };
