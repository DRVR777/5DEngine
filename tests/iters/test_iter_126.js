// test_iter_126.js — mounts: spawn, mount, gait, stamina, tame, summon.
const M = require("./mounts.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

// 1. GAITS + species
ok(M.GAITS.length === 5, "5 gaits");
ok(M.GAITS.includes("gallop"), "gallop");
ok(M.DEFAULT_SPECIES.horse !== undefined, "horse species");

// 2. spawn
const sys = M.createSystem();
const sp = sys.spawn({ species: "horse", ownerId: "alice", position: { u: 0, v: 0 } });
ok(sp.ok && sp.mount.species === "horse", "spawn horse");
ok(sp.mount.stamina === 100, "default max stamina");
ok(sp.mount.wild === false, "not wild (owner set)");

// Wild
const wild = sys.spawn({ species: "horse", position: { u: 50, v: 50 } });
ok(wild.mount.wild === true, "wild without owner");

// Bad spawn
ok(sys.spawn({ species: "ghost" }).ok === false, "no species");
ok(sys.spawn({}).ok === false, "missing species");

// 3. mount (the verb)
const m1 = sys.mount(sp.mountId, "alice");
ok(m1.ok === true, "mount ok");
ok(sys.getMount(sp.mountId).currentRider === "alice", "rider set");
ok(sys.getMount(sp.mountId).gait === "walk", "auto walk on mount");

// Already occupied
ok(sys.mount(sp.mountId, "bob").ok === false, "occupied");

// Non-owner can't mount owned
ok(sys.mount(wild.mountId, "alice").ok === true, "wild can be mounted by anyone");
sys.dismount(wild.mountId, "alice");

// 4. setGait
ok(sys.setGait(sp.mountId, "alice", "gallop").ok, "gallop");
ok(sys.getMount(sp.mountId).gait === "gallop", "gait set");

ok(sys.setGait(sp.mountId, "alice", "weird").ok === false, "bad gait");
ok(sys.setGait(sp.mountId, "intruder", "walk").ok === false, "not rider");
ok(sys.setGait("ghost", "alice", "walk").ok === false, "no mount");

// 5. tick — gallop drains stamina
const before = sys.getMount(sp.mountId).stamina;
sys.tick(sp.mountId, 1, { direction: { u: 1, v: 0 } });
const after = sys.getMount(sp.mountId).stamina;
ok(after < before, `stamina dropped (${before} → ${after})`);

// Position moved
ok(sys.getMount(sp.mountId).position.u > 0, "moved east");

// 6. Idle restores stamina
sys.dismount(sp.mountId, "alice");
sys.tick(sp.mountId, 5);
const restored = sys.getMount(sp.mountId).stamina;
ok(restored > after, `restored (${after} → ${restored})`);

// 7. Exhaustion auto-dismount
const sys2 = M.createSystem();
const ex = sys2.spawn({ species: "horse", ownerId: "p" });
sys2.mount(ex.mountId, "p");
sys2.setGait(ex.mountId, "p", "gallop");
// Tick 100s straight on gallop
for (let i = 0; i < 100; i++) sys2.tick(ex.mountId, 1);
const exhausted = sys2.getMount(ex.mountId);
// Stamina hits 0 → auto-dismount; remaining ticks restore some stamina
ok(exhausted.currentRider === null, "auto-dismounted at exhaustion");

// 8. dismount
const sys3 = M.createSystem();
const d = sys3.spawn({ species: "horse", ownerId: "p" });
sys3.mount(d.mountId, "p");
ok(sys3.dismount(d.mountId, "p").ok === true, "dismount");
ok(sys3.dismount(d.mountId, "p").ok === false, "not rider");
ok(sys3.dismount("ghost", "p").ok === false, "no mount");

// 9. feed
sys3.spawn({ id: "fed_h", species: "horse", ownerId: "p", stamina: 50, bond: 10 });
const fed = sys3.feed("fed_h", "p");
ok(fed.ok && fed.stamina === 100, "fed full stamina");
ok(fed.bond === 15, "bond +5");

ok(sys3.feed("fed_h", "intruder").ok === false, "non-owner can't feed");

// 10. pet
const beforeBond = sys3.getMount("fed_h").bond;
sys3.pet("fed_h", "p");
ok(sys3.getMount("fed_h").bond > beforeBond, "bond from pet");

// 11. tame
const sys4 = M.createSystem({ config: { tameBondThreshold: 50 } });
const w = sys4.spawn({ species: "horse" });
ok(sys4.tame(w.mountId, "alice").ok === false, "bond too low");
sys4.getMount(w.mountId).bond = 60;
ok(sys4.tame(w.mountId, "alice").ok === true, "tamed");
ok(sys4.getMount(w.mountId).wild === false, "no longer wild");
ok(sys4.getMount(w.mountId).ownerId === "alice", "alice owns now");

// Can't re-tame
ok(sys4.tame(w.mountId, "bob").ok === false, "not wild");

// 12. summon — nearest owned mount in range
const sys5 = M.createSystem({ config: { summonRange: 50 } });
sys5.spawn({ id: "near", species: "horse", ownerId: "alice", position: { u: 10, v: 0 } });
sys5.spawn({ id: "far",  species: "horse", ownerId: "alice", position: { u: 1000, v: 0 } });
const sum = sys5.summon("alice", { position: { u: 0, v: 0 } });
ok(sum.ok && sum.mountId === "near", "near summoned");
ok(sys5.getMount("near").position.u === 0, "moved to player");

// None in range
sys5.spawn({ species: "horse", ownerId: "bob", position: { u: 5, v: 0 } });
ok(sys5.summon("carol", { position: { u: 0, v: 0 } }).ok === false, "none in range");

// 13. Camel species
sys.spawn({ id: "c1", species: "camel" });
ok(sys.getMount("c1").maxStamina === 150, "camel has 150 stamina");

// 14. registerSpecies
ok(sys.registerSpecies("dragon", {
  maxStamina: 500, restorePerSec: 10,
  gaits: { idle: { speed: 0, costPerSec: -5 }, fly: { speed: 30, costPerSec: 20 } },
}).ok, "register dragon");
ok(sys.registerSpecies("horse", {}).ok === false, "duplicate");
ok(sys.registerSpecies("", {}).ok === false, "empty");
ok(sys.registerSpecies("x", {}).ok === false, "bad spec");

const dr = sys.spawn({ species: "dragon" });
ok(sys.getMount(dr.mountId).maxStamina === 500, "dragon stamina");

// 15. listMounts filters
const sys6 = M.createSystem();
sys6.spawn({ species: "horse", ownerId: "a" });
sys6.spawn({ species: "horse", ownerId: "a" });
sys6.spawn({ species: "horse" });   // wild
ok(sys6.listMounts().length === 3, "all 3");
ok(sys6.listMounts({ ownerId: "a" }).length === 2, "a has 2");
ok(sys6.listMounts({ wild: true }).length === 1, "1 wild");

// ridden filter
const a1 = sys6.listMounts({ ownerId: "a" })[0];
sys6.mount(a1.id, "a");
ok(sys6.listMounts({ ridden: true }).length === 1, "1 ridden");
ok(sys6.listMounts({ ridden: false }).length === 2, "2 not ridden");

// 16. despawn
const dp = sys6.spawn({ species: "horse" });
ok(sys6.despawn(dp.mountId).ok === true, "despawn");
ok(sys6.getMount(dp.mountId) === null, "removed");

// 17. listSpecies
ok(sys.listSpecies().includes("dragon"), "dragon listed");

// 18. recentEvents
ok(sys.recentEvents().length > 0, "events");
ok(sys.recentEvents().some(e => e.kind === "mount"), "mount events");

// 19. getConfig
ok(sys.getConfig().summonRange > 0, "config");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
