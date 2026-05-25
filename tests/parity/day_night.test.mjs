/** Parity test: day_night _sample() vs legacy keyframes */
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

// Ground truth: exact samples at key hours
const cases = [
  {h:0,  sky:0x020818, fog:0x030c1e, ambI:0.05, sunI:0.0,  sunColor:0x102040},
  {h:6,  sky:0xf4a147, fog:0xe8956c, ambI:0.30, sunI:0.4,  sunColor:0xff9955},
  {h:12, sky:0x6ab4e8, fog:0x88c8f0, ambI:0.65, sunI:1.2,  sunColor:0xfff9f0},
  {h:18, sky:0xb04020, fog:0xb05030, ambI:0.25, sunI:0.2,  sunColor:0xff4400},
  {h:24, sky:0x020818, fog:0x030c1e, ambI:0.05, sunI:0.0,  sunColor:0x102040},
];
let fail = 0;
for(const c of cases){
  const s=_sample(c.h);
  if(s.sky!==c.sky||s.fog!==c.fog||Math.abs(s.ambI-c.ambI)>0.001||Math.abs(s.sunI-c.sunI)>0.001||s.sunColor!==c.sunColor){
    console.log(`FAIL h=${c.h}: sky=${s.sky.toString(16)} vs ${c.sky.toString(16)}, fog=${s.fog.toString(16)} vs ${c.fog.toString(16)}, ambI=${s.ambI} vs ${c.ambI}, sunI=${s.sunI} vs ${c.sunI}, sunColor=${s.sunColor?.toString(16)} vs ${c.sunColor?.toString(16)}`);
    fail++;
  }
}
// Tick accumulation test
const mod = await import("../../src/ankhor/facets/day_night.js");
const facet = mod.default || mod;
const data = {};
facet.tick(null, data, 0, null); // init
// Advance 60 seconds at speed 60 (1 hour should pass)
facet.tick(null, data, 60, null);
const expectedHour = 9; // 8 + 1*hour at speed=60 for 60s
if(Math.abs(data.hour-expectedHour)>0.01){console.log(`FAIL tick: hour=${data.hour} vs ${expectedHour}`);fail++;}
if(data.sky===undefined){console.log("FAIL tick: no sky computed");fail++;}
// Sun position at noon
facet.tick(null, data, -60, null); // back to 8, then set to 12
data.hour=12;data._lastHour=-1;
facet.tick(null, data, 0, null);
if(Math.abs(data.sunPos.x-0)>1||Math.abs(data.sunPos.y-80)>1){console.log(`FAIL sunPos: ${JSON.stringify(data.sunPos)}`);fail++;}
console.log(fail===0?"PASS all day_night parity":"FAIL "+fail+" tests");
