// test_iter_121.js — pet AI: spawn, commands, bond, follow, fetch.
const P = require("./pet_ai.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

// 1. Commands + moods
ok(P.COMMANDS.includes("follow"), "follow");
ok(P.COMMANDS.includes("fetch"), "fetch");
ok(P.MOODS.includes("ecstatic"), "ecstatic mood");

// 2. spawnPet
const sys = P.createSystem();
const sp = sys.spawnPet({ ownerId: "alice", species: "dog", name: "Rex" });
ok(sp.ok === true, "spawn");
ok(sp.pet.species === "dog", "species");
ok(sp.pet.command === "follow", "default follow");

ok(sys.spawnPet({}).ok === false, "missing owner");
ok(sys.spawnPet({ ownerId: "x", id: sp.id }).ok === false, "duplicate id");

// 3. command issuance
const c1 = sys.command(sp.id, "alice", "sit");
ok(c1.ok === true, "sit ok");
ok(sys.getPet(sp.id).command === "sit", "command set");
ok(c1.loyalty >= 50, "loyalty bumped");

ok(sys.command(sp.id, "intruder", "sit").ok === false, "non-owner blocked");
ok(sys.command(sp.id, "alice", "weird").ok === false, "bad command");
ok(sys.command("ghost", "alice", "sit").ok === false, "ghost pet");

// 4. Disobedient pet (low loyalty)
const sysLow = P.createSystem({ config: { minLoyaltyForObedience: 50 } });
const lp = sysLow.spawnPet({ ownerId: "p", loyalty: 30 });
const r1 = sysLow.command(lp.id, "p", "sit");
ok(r1.ok === false && r1.reason === "disobedient", "low loyalty disobedient");

// Try again — loyalty drops further
const r2 = sysLow.command(lp.id, "p", "sit");
ok(r2.ok === false, "still disobedient");
ok(sysLow.getPet(lp.id).loyalty < 30, "loyalty fell from refusal");

// 5. feed lowers hunger + boosts bond
const fed1 = sys.feed(sp.id, "alice");
ok(fed1.ok === true, "fed");
ok(fed1.bond > 30, "bond increased");
ok(fed1.hunger < 30, "hunger decreased");

ok(sys.feed(sp.id, "intruder").ok === false, "non-owner can't feed");
ok(sys.feed("ghost", "alice").ok === false, "ghost feed");

// 6. pet (the verb) boosts bond
const beforeBond = sys.getPet(sp.id).bond;
sys.pet(sp.id, "alice");
ok(sys.getPet(sp.id).bond > beforeBond, "bond went up from petting");

// 7. mood reflects state
const m1 = sys.mood(sp.id);
ok(P.MOODS.includes(m1), `mood = ${m1}`);

// High-bond, high-loyalty, low-hunger → ecstatic
sys.getPet(sp.id).bond = 100;
sys.getPet(sp.id).loyalty = 100;
sys.getPet(sp.id).hunger = 0;
ok(sys.mood(sp.id) === "ecstatic", "ecstatic");

// Worst case → sad
sys.getPet(sp.id).bond = 0;
sys.getPet(sp.id).loyalty = 0;
sys.getPet(sp.id).hunger = 100;
ok(sys.mood(sp.id) === "sad", "sad");

// 8. Follow behavior
const sys2 = P.createSystem({ config: { followDistance: 2 } });
const fp = sys2.spawnPet({ ownerId: "p", position: { u: 0, v: 0 } });
sys2.command(fp.id, "p", "follow");
sys2.tick(1, { playerPositions: { p: { u: 20, v: 0 } } });
const moved = sys2.getPet(fp.id).position.u;
ok(moved > 0, `pet moved toward player (got ${moved})`);

// Within follow distance → doesn't move
const close = sys2.spawnPet({ ownerId: "q", position: { u: 0, v: 0 } });
sys2.command(close.id, "q", "follow");
const beforeC = sys2.getPet(close.id).position.u;
sys2.tick(1, { playerPositions: { q: { u: 1, v: 0 } } });   // 1m < followDistance 2
ok(sys2.getPet(close.id).position.u === beforeC, "close pet doesn't move");

// 9. Heel: snaps next to owner
const hp = sys2.spawnPet({ ownerId: "h", position: { u: 100, v: 100 } });
sys2.command(hp.id, "h", "heel");
sys2.tick(0.1, { playerPositions: { h: { u: 50, v: 50 } } });
const hPet = sys2.getPet(hp.id);
ok(hPet.position.u === 51 && hPet.position.v === 50, "snapped to owner+1");

// 10. Fetch: move to target, then return
const fc = sys2.spawnPet({ ownerId: "f", position: { u: 0, v: 0 } });
sys2.command(fc.id, "f", "fetch", { targetPos: { u: 10, v: 0, itemId: "ball" } });
// Tick many times to reach ball
for (let i = 0; i < 20; i++) {
  sys2.tick(1, { playerPositions: { f: { u: 0, v: 0 } } });
}
const fetchedPet = sys2.getPet(fc.id);
ok(fetchedPet.fetchedItem === "ball", `picked up ball (got ${fetchedPet.fetchedItem})`);
ok(fetchedPet.command === "follow", "auto-returns to follow after pickup");

// takeFetched
const taken = sys2.takeFetched(fc.id, "f");
ok(taken.ok && taken.item === "ball", "took ball");
ok(sys2.getPet(fc.id).fetchedItem === null, "pet's hand empty");

ok(sys2.takeFetched(fc.id, "f").ok === false, "nothing more to take");
ok(sys2.takeFetched(fc.id, "intruder").ok === false, "non-owner can't take");

// 11. Hunger increases over time
const sys3 = P.createSystem({ config: { hungerPerSec: 1 } });
const hp3 = sys3.spawnPet({ ownerId: "p", hunger: 10 });
sys3.tick(20);   // 20 sec * 1 = 20 hunger added → 30
ok(sys3.getPet(hp3.id).hunger === 30, "hunger increased");

// Cap at max
sys3.tick(1000);
ok(sys3.getPet(hp3.id).hunger === 100, "capped");

// 12. listPets
const sys4 = P.createSystem();
sys4.spawnPet({ ownerId: "a" });
sys4.spawnPet({ ownerId: "a" });
sys4.spawnPet({ ownerId: "b" });
ok(sys4.listPets("a").length === 2, "2 a pets");
ok(sys4.listPets("b").length === 1, "1 b pet");
ok(sys4.listPets().length === 3, "3 total");

// 13. despawnPet
const sp4 = sys4.spawnPet({ ownerId: "z" });
ok(sys4.despawnPet(sp4.id).ok === true, "despawn");
ok(sys4.getPet(sp4.id) === null, "removed");
ok(sys4.despawnPet(sp4.id).ok === false, "double despawn");

// 14. recentEvents
ok(sys.recentEvents().length > 0, "events");
ok(sys.recentEvents().some(e => e.kind === "command"), "command events");
ok(sys.recentEvents().some(e => e.kind === "fed"), "fed events");

// 15. Bond + loyalty caps
const sys5 = P.createSystem({ config: { maxBond: 50, maxLoyalty: 70, bondPerFeed: 100 } });
const sp5 = sys5.spawnPet({ ownerId: "p", bond: 40, loyalty: 65 });
sys5.feed(sp5.id, "p");
ok(sys5.getPet(sp5.id).bond === 50, "bond capped");
for (let i = 0; i < 100; i++) sys5.command(sp5.id, "p", "sit");
ok(sys5.getPet(sp5.id).loyalty === 70, "loyalty capped");

// 16. getConfig
ok(sys.getConfig().followDistance > 0, "config");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
