// test_iter_114.js — crime/police: heat tiers, bounty, chase, arrest.
const CP = require("./crime_police.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

function mkEcon() {
  const bal = new Map();
  const k = (p, c) => p + "::" + c;
  return {
    deposit: (p, c, a) => bal.set(k(p,c), (bal.get(k(p,c)) || 0) + a),
    withdraw: (p, c, a) => {
      const cur = bal.get(k(p,c)) || 0;
      if (cur < a) return { ok: false };
      bal.set(k(p,c), cur - a);
      return { ok: true };
    },
    balance: (p, c) => bal.get(k(p,c)) || 0,
  };
}

// 1. TIERS + CRIME_HEAT
ok(CP.TIERS.length === 6, "6 tiers");
ok(CP.TIERS[0].name === "clean", "clean tier");
ok(CP.TIERS[5].name === "swat", "swat tier");
ok(CP.CRIME_HEAT.homicide === 150, "homicide=150");

// 2. Default state
const sys = CP.createSystem();
ok(sys.getHeat("alice") === 0, "default heat 0");
ok(sys.getState("alice") === "clean", "default clean");
ok(sys.getBounty("alice") === 0, "no bounty");
ok(sys.getTier("alice").name === "clean", "tier clean");

// 3. Record crime
const r1 = sys.recordCrime("alice", { crime: "petty_theft" });
ok(r1.ok, "crime recorded");
ok(r1.heat === 10, `heat 10 (got ${r1.heat})`);
ok(r1.bounty === 20, "bounty = 2x heat = 20");
ok(r1.tier.name === "clean", "still clean (heat<50)");

// 4. Custom heat amount
sys.recordCrime("alice", { heat: 60 });
ok(sys.getHeat("alice") === 70, "heat 70");
ok(sys.getTier("alice").name === "noticed", "noticed at 50+");
ok(sys.getState("alice") === "wanted", "wanted state");

// 5. Witnessed false → reduced heat
const sys2 = CP.createSystem();
sys2.recordCrime("alice", { crime: "homicide", witnessed: false });
ok(sys2.getHeat("alice") === 30, `unwitnessed homicide = 30 (got ${sys2.getHeat("alice")})`);

// 6. Unknown crime rejected
ok(sys.recordCrime("alice", { crime: "litter" }).ok === false, "unknown crime");
ok(sys.recordCrime("alice", {}).ok === false, "no heat/crime");

// 7. Heat caps at maxHeat
const sys3 = CP.createSystem({ config: { maxHeat: 100 } });
sys3.recordCrime("p", { heat: 9999 });
ok(sys3.getHeat("p") === 100, "capped");

// 8. Heat decay over time
const sys4 = CP.createSystem({ config: { decayPerSec: 10 } });
sys4.recordCrime("p", { heat: 100 });
sys4.tick("p", 5);   // 5s × 10 = 50 decay
ok(sys4.getHeat("p") === 50, `decayed to 50 (got ${sys4.getHeat("p")})`);

// State transitions on tier drop
sys4.tick("p", 10);   // more decay → 0
ok(sys4.getHeat("p") === 0, "heat 0");
ok(sys4.getState("p") === "clean", "back to clean");

// 9. Hidden → faster decay
const sys5 = CP.createSystem({ config: { decayPerSec: 10, hideMultiplier: 5 } });
sys5.recordCrime("p", { heat: 200 });
sys5.setHidden("p", true);
sys5.tick("p", 1);   // 10 × 5 = 50 decay
ok(sys5.getHeat("p") === 150, "hidden = faster decay");

// 10. No decay during chase
const sys6 = CP.createSystem({ config: { decayPerSec: 100 } });
sys6.recordCrime("p", { heat: 200 });
sys6.startChase("p", { u: 0, v: 0 });
sys6.tick("p", 5);
ok(sys6.getHeat("p") === 200, "no decay during chase");

// 11. startChase requires wanted
const sys7 = CP.createSystem();
ok(sys7.startChase("clean_p", { u: 0, v: 0 }).ok === false, "clean can't be chased");
sys7.recordCrime("clean_p", { heat: 100 });
ok(sys7.startChase("clean_p", { u: 0, v: 0 }).ok === true, "wanted can be chased");
ok(sys7.getState("clean_p") === "chased", "state chased");

// 12. corner + arrest flow
sys7.corner("clean_p");
ok(sys7.getState("clean_p") === "cornered", "cornered");
ok(sys7.corner("clean_p").ok === false, "double corner fails");

const arr = sys7.arrest("clean_p");
ok(arr.ok === true, "arrest");
ok(arr.bountyOwed > 0, "bounty owed reported");
ok(sys7.getState("clean_p") === "arrested", "arrested state");
ok(sys7.getHeat("clean_p") === 0, "heat zeroed");
ok(sys7.getBounty("clean_p") === 0, "bounty zeroed");

// Arrest without corner fails
const sys8 = CP.createSystem();
sys8.recordCrime("p", { heat: 100 });
ok(sys8.arrest("p").ok === false, "can't arrest without corner");
ok(sys8.arrest("p", { force: true }).ok === true, "force arrest works");

// 13. escape
const sys9 = CP.createSystem();
sys9.recordCrime("p", { heat: 100 });
sys9.startChase("p");
ok(sys9.escape("p").ok === true, "escape");
ok(sys9.getState("p") === "escaped", "escaped");
ok(sys9.getHeat("p") > 0, "heat persists");
ok(sys9.escape("p").ok === false, "double escape fails");

// 14. payFine
const sys10 = CP.createSystem({ config: { fineMul: 0.5 } });
const econ = mkEcon();
econ.deposit("rich", "coin", 10000);
sys10.recordCrime("rich", { crime: "grand_theft" });   // heat=60, bounty=120
const pay = sys10.payFine("rich", { economy: econ });
ok(pay.ok === true, "pay fine");
ok(pay.cost === 60, `cost = bounty * 0.5 = 60 (got ${pay.cost})`);
ok(econ.balance("rich", "coin") === 9940, "balance reduced");
ok(sys10.getHeat("rich") === 0, "heat cleared");
ok(sys10.getBounty("rich") === 0, "bounty cleared");

// Insufficient funds
const econPoor = mkEcon();
sys10.recordCrime("poor", { crime: "homicide" });
const payFail = sys10.payFine("poor", { economy: econPoor });
ok(payFail.ok === false && payFail.reason === "insufficient", "poor can't pay");

// No bounty
ok(sys10.payFine("noBounty").ok === false, "no bounty rejected");

// 15. release from jail
const sys11 = CP.createSystem();
sys11.recordCrime("crook", { heat: 200 });
sys11.startChase("crook");
sys11.corner("crook");
sys11.arrest("crook");
ok(sys11.release("crook").ok === true, "release ok");
ok(sys11.getState("crook") === "clean", "clean after release");
ok(sys11.release("crook").ok === false, "release non-arrested fails");

// 16. policeResponse projection
const sys12 = CP.createSystem();
sys12.recordCrime("vip", { heat: 1500 });
const resp = sys12.policeResponse("vip");
ok(resp.tier === 4, `tier 4 (got ${resp.tier})`);
ok(resp.patrols === 12, "12 patrols");
ok(resp.chase === false, "not chasing");

sys12.startChase("vip");
const respChase = sys12.policeResponse("vip");
ok(respChase.chase === true, "chasing");

// Clean player
const respClean = sys12.policeResponse("never_crime");
ok(respClean.tier === 0, "clean tier 0");
ok(respClean.patrols === 0, "0 patrols");

// 17. listPlayers / reset
ok(sys.listPlayers().length > 0, "players listed");
ok(sys.reset("alice").ok === true, "reset ok");
ok(sys.getHeat("alice") === 0, "reset cleared");
ok(sys.reset("ghost").ok === false, "ghost reset");

// 18. recentEvents
ok(sys.recentEvents().length > 0, "events");
ok(sys.recentEvents().some(e => e.kind === "crime"), "crime event");

// 19. Stacked crimes accumulate
const sys13 = CP.createSystem();
for (let i = 0; i < 5; i++) sys13.recordCrime("repeat", { crime: "petty_theft" });
ok(sys13.getHeat("repeat") === 50, "5 thefts = 50 heat");
ok(sys13.getBounty("repeat") === 100, "5 thefts = 100 bounty");

// 20. Tier transitions accurate
const sys14 = CP.createSystem();
sys14.recordCrime("crim", { heat: 49 });
ok(sys14.getTier("crim").tier === 0, "49 = tier 0");
sys14.recordCrime("crim", { heat: 1 });
ok(sys14.getTier("crim").tier === 1, "50 = tier 1");
sys14.recordCrime("crim", { heat: 1950 });
ok(sys14.getTier("crim").tier === 5, "2000 = tier 5");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
