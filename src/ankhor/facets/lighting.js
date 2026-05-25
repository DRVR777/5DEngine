/** lighting — ambInt=0.9, sunInt=1.1, shadow=2048, shadowCam=40, sunPos=(20,30,10) */
export default { priority: 6, tick(_t,d,_dt,_r){ if(d._init)return; d._init=true; d.ambInt=0.9; d.sunInt=1.1; d.shadowMapSize=2048; d.shadowCamHalf=40; d.sunPos={x:20,y:30,z:10}; } };
