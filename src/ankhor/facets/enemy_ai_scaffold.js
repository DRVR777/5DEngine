/** enemy_ai_scaffold — constants extracted */
export default { priority: 20, tick(_t,d,_dt,_r){ if(d._init)return; d._init=true; d.AI_TICK_INTERVAL=0.25; d.MAX_SIMULTANEOUS_ATTACKERS=3; } };
