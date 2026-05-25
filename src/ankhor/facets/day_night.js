/** day_night — 13 keyframes exactly from legacy DayNight cycle. hour→sky/fog/ambI/sunI/sunColor */
const _lerp = (a,b,t) => a+(b-a)*t;
const _lerpColor = (cA,cB,t) => {
  const rA=(cA>>16)&0xff,gA=(cA>>8)&0xff,bA=cA&0xff;
  const rB=(cB>>16)&0xff,gB=(cB>>8)&0xff,bB=cB&0xff;
  return (Math.round(_lerp(rA,rB,t))<<16)|(Math.round(_lerp(gA,gB,t))<<8)|(Math.round(_lerp(bA,bB,t)));
};
const KEYFRAMES = [
  [ 0, 0x020818, 0x030c1e, 0.05, 0.0,  0x102040 ],
  [ 4, 0x040c22, 0x050e28, 0.06, 0.0,  0x1a2a50 ],
  [ 5, 0x1a2040, 0x202848, 0.15, 0.05, 0x4060a0 ],
  [ 6, 0xf4a147, 0xe8956c, 0.30, 0.4,  0xff9955 ],
  [ 7, 0x87b8e8, 0xa0c4e4, 0.50, 0.7,  0xffeedd ],
  [ 9, 0x87ceeb, 0xaad4f0, 0.60, 1.0,  0xffffff ],
  [12, 0x6ab4e8, 0x88c8f0, 0.65, 1.2,  0xfff9f0 ],
  [15, 0x78bce8, 0x90caf0, 0.60, 1.0,  0xffeedd ],
  [17, 0xe87848, 0xe8946a, 0.40, 0.6,  0xff6600 ],
  [18, 0xb04020, 0xb05030, 0.25, 0.2,  0xff4400 ],
  [19, 0x301828, 0x280e1a, 0.12, 0.0,  0x301828 ],
  [21, 0x060c1c, 0x050a18, 0.07, 0.0,  0x101838 ],
  [24, 0x020818, 0x030c1e, 0.05, 0.0,  0x102040 ],
];
function _sample(hour) {
  const h=((hour%24)+24)%24;
  let lo=KEYFRAMES[0], hi=KEYFRAMES[KEYFRAMES.length-1];
  for(let i=0;i<KEYFRAMES.length-1;i++) {
    if(KEYFRAMES[i][0]<=h&&KEYFRAMES[i+1][0]>=h){lo=KEYFRAMES[i];hi=KEYFRAMES[i+1];break;}
  }
  const span=hi[0]-lo[0]||1, t=(h-lo[0])/span;
  return {sky:_lerpColor(lo[1],hi[1],t),fog:_lerpColor(lo[2],hi[2],t),ambI:_lerp(lo[3],hi[3],t),sunI:_lerp(lo[4],hi[4],t),sunColor:_lerpColor(lo[5],hi[5],t)};
}
export default {
  priority: 8,
  tick(_t, data, dt, _r) {
    if(!data._init){data.hour=8.0;data.speed=1.0;data.paused=false;data._lastHour=-1;data._init=true;}
    if(data.paused)return;
    data.hour=((data.hour+data.speed/60*dt)%24+24)%24;
    const s=_sample(data.hour);
    data.sky=s.sky;data.fog=s.fog;data.ambI=s.ambI;data.sunI=s.sunI;data.sunColor=s.sunColor;
    const angle=(data.hour/24)*Math.PI*2-Math.PI/2, r=80;
    data.sunPos={x:Math.cos(angle)*r,y:Math.sin(angle)*r,z:20};
    const floorHour=Math.floor(data.hour);
    if(floorHour!==data._lastHour){data._lastHour=floorHour;}
  }
};
