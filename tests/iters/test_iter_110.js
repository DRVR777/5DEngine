// test_iter_110.js — caravan AI: routes, travel, ambush, escort.
const C = require("./caravan.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

// 1. defineRoute
const sys = C.createSystem();
const r1 = sys.defineRoute({
  id: "north_trail",
  waypoints: [
    { u: 0, v: 0 }, { u: 50, v: 0 }, { u: 50, v: 50 }, { u: 0, v: 50 },
  ],
  loop: true,
});
ok(r1.ok, "route defined");
ok(sys.defineRoute({}).ok === false, "missing id");
ok(sys.defineRoute({ id: "x" }).ok === false, "missing waypoints");
ok(sys.defineRoute({ id: "x", waypoints: [{ u: 0, v: 0 }] }).ok === false, "1 wp not enough");
ok(sys.defineRoute({ id: "north_trail", waypoints: [{},{}] }).ok === false, "duplicate");

ok(sys.listRoutes().length === 1, "1 route");

// 2. spawnCaravan
const s1 = sys.spawnCaravan({ routeId: "north_trail", cargo: ["wool", "ale"] });
ok(s1.ok, "spawn");
ok(s1.caravan.position.u === 0, "starts at wp 0");
ok(s1.caravan.state === "travelling", "travelling");
ok(s1.caravan.cargo.length === 2, "2 cargo");

ok(sys.spawnCaravan({ routeId: "ghost" }).ok === false, "no route");

// 3. tick → moves toward next wp
const t0 = 1000;
sys.tick(1, t0);
const c1 = sys.getCaravan(s1.id);
ok(c1.position.u > 0, `moved (got ${c1.position.u})`);
ok(c1.position.u < 50, "not yet at wp 1");

// 4. Arrive at wp
for (let i = 0; i < 30; i++) sys.tick(1, t0 + i * 1000);
const c2 = sys.getCaravan(s1.id);
ok(c2.currentWpIdx >= 1, `progressed past wp 0 (now at ${c2.currentWpIdx})`);

// 5. at_waypoint pause then resume
const sys2 = C.createSystem({ config: { waypointPauseMs: 1000 } });
sys2.defineRoute({ id: "r", waypoints: [{ u: 0, v: 0 }, { u: 5, v: 0 }] });
const sCar = sys2.spawnCaravan({ routeId: "r", speed: 100 });
sys2.tick(0.1, 1000);
ok(sys2.getCaravan(sCar.id).state === "at_waypoint", "at wp after fast travel");

// Tick before pause expires
sys2.tick(0, 1100);
ok(sys2.getCaravan(sCar.id).state === "at_waypoint", "still pausing");

// Past pause
sys2.tick(0, 3000);
ok(sys2.getCaravan(sCar.id).state === "travelling", "resumed");

// 6. Non-loop route arrives
const sys3 = C.createSystem();
sys3.defineRoute({ id: "one_way", waypoints: [{ u: 0, v: 0 }, { u: 10, v: 0 }], loop: false });
const oneCar = sys3.spawnCaravan({ routeId: "one_way", speed: 100 });
for (let i = 0; i < 5; i++) sys3.tick(1, i * 1000);
ok(sys3.getCaravan(oneCar.id).state === "arrived", "non-loop arrived");

// 7. Ambush by strong threat
const sys4 = C.createSystem({ config: { ambushDangerRadius: 50 } });
sys4.defineRoute({ id: "r", waypoints: [{ u: 0, v: 0 }, { u: 100, v: 0 }] });
const ac = sys4.spawnCaravan({ routeId: "r", guards: [{ strength: 1 }] });
const ambush = sys4.threatNearby(ac.id, { u: 10, v: 0 }, 5);   // threat > guard
ok(ambush.ok === true, "ambush triggered");
ok(ambush.state === "ambushed", "ambushed state");
ok(ambush.escortRequested === true, "escort requested");
ok(sys4.getCaravan(ac.id).state === "ambushed", "caravan marked ambushed");

// Drain queue
const reqs = sys4.drainEscortRequests();
ok(reqs.length === 1, "1 escort request");
ok(reqs[0].caravanId === ac.id, "right caravan");
ok(sys4.drainEscortRequests().length === 0, "queue cleared");

// 8. Ambushed caravan stops moving
const before = sys4.getCaravan(ac.id).position.u;
sys4.tick(5);
ok(sys4.getCaravan(ac.id).position.u === before, "ambushed = stationary");

// 9. Rescue caravan
const rescue = sys4.rescueCaravan(ac.id);
ok(rescue.ok === true, "rescue");
ok(rescue.reward.ccy === "coin", "coin reward");
ok(sys4.getCaravan(ac.id).state === "travelling", "back to travelling");
ok(sys4.rescueCaravan(ac.id).ok === false, "double rescue fails");

// 10. Flee by weak threat
const sys5 = C.createSystem({ config: { ambushDangerRadius: 50, fleeDistance: 30 } });
sys5.defineRoute({ id: "r", waypoints: [{ u: 0, v: 0 }, { u: 200, v: 0 }] });
const fc = sys5.spawnCaravan({ routeId: "r", guards: [{ strength: 100 }] });
const flee = sys5.threatNearby(fc.id, { u: 10, v: 0 }, 5);   // weak threat
ok(flee.ok === true && flee.state === "fleeing", "fleeing");
ok(sys5.getCaravan(fc.id).state === "fleeing", "state fleeing");

// Tick → moves away
const beforeF = sys5.getCaravan(fc.id).position.u;
sys5.tick(1);
ok(sys5.getCaravan(fc.id).position.u !== beforeF, "moved while fleeing");

// Eventually return to travelling
for (let i = 0; i < 50; i++) sys5.tick(1);
ok(sys5.getCaravan(fc.id).state !== "fleeing", "stops fleeing after distance");

// 11. Out-of-range threat
const sys6 = C.createSystem({ config: { ambushDangerRadius: 10 } });
sys6.defineRoute({ id: "r", waypoints: [{ u: 0, v: 0 }, { u: 200, v: 0 }] });
const oc = sys6.spawnCaravan({ routeId: "r" });
const far = sys6.threatNearby(oc.id, { u: 1000, v: 0 }, 100);
ok(far.ok === false && far.reason === "out_of_range", "far threat ignored");

// 12. Already-ambushed: re-trigger rejected
const sys7 = C.createSystem();
sys7.defineRoute({ id: "r", waypoints: [{ u: 0, v: 0 }, { u: 50, v: 0 }] });
const c7 = sys7.spawnCaravan({ routeId: "r" });
sys7.threatNearby(c7.id, { u: 10, v: 0 }, 99);
ok(sys7.threatNearby(c7.id, { u: 10, v: 0 }, 99).ok === false, "re-trigger blocked");

// 13. applyDamage
const sys8 = C.createSystem();
sys8.defineRoute({ id: "r", waypoints: [{ u: 0, v: 0 }, { u: 50, v: 0 }] });
const dc = sys8.spawnCaravan({ routeId: "r", hp: 50 });
const dmg1 = sys8.applyDamage(dc.id, 30);
ok(dmg1.ok && dmg1.hp === 20, "20 hp left");
const dmg2 = sys8.applyDamage(dc.id, 99);
ok(dmg2.destroyed === true, "destroyed");
ok(sys8.getCaravan(dc.id).state === "destroyed", "state destroyed");
ok(dmg2.lostCargo !== undefined, "cargo reported");

// Damage missing
ok(sys8.applyDamage("ghost", 1).ok === false, "ghost dmg");

// 14. listCaravans by state
const sys9 = C.createSystem();
sys9.defineRoute({ id: "r", waypoints: [{ u: 0, v: 0 }, { u: 50, v: 0 }] });
const a = sys9.spawnCaravan({ routeId: "r" });
const b = sys9.spawnCaravan({ routeId: "r" });
sys9.applyDamage(b.id, 999);
ok(sys9.listCaravans().length === 2, "2 total");
ok(sys9.listCaravans("travelling").length === 1, "1 travelling");
ok(sys9.listCaravans("destroyed").length === 1, "1 destroyed");

// 15. despawn
ok(sys9.despawnCaravan(a.id).ok === true, "despawn ok");
ok(sys9.getCaravan(a.id) === null, "removed");
ok(sys9.despawnCaravan(a.id).ok === false, "double despawn");

// 16. recentEvents
const ev = sys.recentEvents();
ok(ev.length > 0, "events");
ok(ev.some(e => e.kind === "spawn"), "spawn events");
ok(ev.some(e => e.kind === "route"), "route events");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
