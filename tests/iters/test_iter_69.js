// test_iter_69.js — day/night NPC visibility + light sources.
const V = require("./visibility.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

// 1. ambientLight at key hours
ok(V.ambientLight(12) === 1.0, "noon = full light");
ok(V.ambientLight(0) === 0, "midnight = dark");
ok(V.ambientLight(3) === 0, "3am = dark");
ok(V.ambientLight(7) === 1.0, "7am = full");
ok(V.ambientLight(17) === 1.0, "5pm = full");
ok(V.ambientLight(20) === 0, "8pm = dark");

// Twilight gradient
ok(Math.abs(V.ambientLight(6) - 0.5) < 0.01, "6am sunrise ~ 0.5");
ok(Math.abs(V.ambientLight(18) - 0.5) < 0.01, "6pm sunset ~ 0.5");

// 2. createLightField
const lf = V.createLightField();
const id1 = lf.add({ pos: { u: 10, v: 10 }, radius: 5, intensity: 1.0, kind: "lamp" });
ok(typeof id1 === "string", "add returns id");
ok(lf.list().length === 1, "1 source");

// Custom id
const id2 = lf.add({ id: "torch1", pos: { u: 0, v: 0 }, radius: 3 });
ok(lf.get("torch1") !== null, "custom id");

// 3. lightnessAt
ok(lf.lightnessAt({ u: 10, v: 10 }) === 1.0, "at lamp center = 1.0");
ok(lf.lightnessAt({ u: 10, v: 12.5 }) > 0 && lf.lightnessAt({ u: 10, v: 12.5 }) < 1,
   "halfway out = partial");
ok(lf.lightnessAt({ u: 100, v: 100 }) === 0, "far away = 0");

// Two sources: max contribution wins
lf.add({ pos: { u: 10.5, v: 10.5 }, radius: 5, intensity: 0.8 });
const l1 = lf.lightnessAt({ u: 10, v: 10 });
ok(l1 === 1.0, "still 1.0 at lamp center (max wins)");

// 4. remove / update
lf.remove("torch1");
ok(lf.get("torch1") === null, "removed");

lf.update(id1, { intensity: 0.5 });
ok(lf.get(id1).intensity === 0.5, "intensity updated");

// 5. entityVisibility at noon — always visible
const e1 = { u: 100, v: 100, y: 0 };
const v1 = V.entityVisibility(e1, 12, lf);
ok(v1 === 1, "noon → entity fully visible");

// 6. At midnight, far from lights → near 0
const v2 = V.entityVisibility(e1, 0, lf);
ok(v2 < 0.2, `midnight far from light → ${v2.toFixed(2)} < 0.2`);

// minOutdoor floor
const v3 = V.entityVisibility(e1, 0, lf, { minOutdoor: 0.1 });
ok(v3 === 0.1, "minOutdoor floor preserved");

// 7. Near a light at night → visible
const e2 = { u: 10, v: 10, y: 0 };
const v4 = V.entityVisibility(e2, 0, lf);
ok(v4 >= 0.5, `near lamp at midnight → visible (${v4.toFixed(2)})`);

// Carrying a torch → boost
const v5 = V.entityVisibility(e1, 0, lf, { carrying: 0.6 });
ok(v5 >= 0.6, `carrying torch → at least 0.6 (got ${v5.toFixed(2)})`);

// alwaysVisible: 1.0 regardless
const v6 = V.entityVisibility(e1, 0, lf, { alwaysVisible: true });
ok(v6 === 1, "alwaysVisible = 1");

// 8. isVisible threshold
ok(V.isVisible(e2, 0, lf) === true, "near light at night → visible");
ok(V.isVisible(e1, 0, lf) === false, "far at night → invisible");
ok(V.isVisible(e1, 12, lf) === true, "noon → visible");
ok(V.isVisible(e1, 0, lf, { threshold: 0.05 }) === true, "low threshold passes");

// 9. classifyEntities
const entities = new Map([
  ["npc1", { position: { u: 0, v: 0, y: 0 } }],
  ["npc2", { position: { u: 10, v: 10, y: 0 } }],
  ["npc3", { position: { u: 200, v: 200, y: 0 } }],
  ["player", { position: { u: 200, v: 200, y: 0 } }],
  ["torchbearer", { position: { u: 50, v: 50, y: 0 } }],
]);
const result = V.classifyEntities(entities, 1, lf, {
  isPlayerFn: (e) => e === entities.get("player"),
  carryingFn: (e) => (e === entities.get("torchbearer")) ? 0.8 : 0,
});
ok(result.size === 5, "5 entries");
ok(result.get("npc1").visible === false, "npc1 at (0,0) far from any light → invisible");
ok(result.get("npc2").visible === true, "npc2 near lamp → visible");
ok(result.get("npc3").visible === false, "npc3 at (200,200) → invisible");
ok(result.get("player").visible === true, "player always visible");
ok(result.get("torchbearer").visible === true, "torchbearer carries → visible");

// Entity without position
const noPos = new Map([["floater", { name: "no position" }]]);
const r2 = V.classifyEntities(noPos, 0, lf);
ok(r2.get("floater").visible === true, "no position → default visible (1)");

// 10. Custom threshold
const strict = V.classifyEntities(entities, 1, lf, { threshold: 0.99 });
ok(strict.get("npc2").visible === false, "high threshold makes npc2 invisible too");

// 11. Empty light field at night
const lfEmpty = V.createLightField();
ok(V.isVisible({ u: 0, v: 0 }, 0, lfEmpty) === false, "no lights at midnight → invisible");

// 12. Multiple lights overlap — best wins
const lfMulti = V.createLightField();
lfMulti.add({ pos: { u: 0, v: 0 }, radius: 5, intensity: 0.4 });
lfMulti.add({ pos: { u: 0, v: 0 }, radius: 5, intensity: 0.9 });
ok(lfMulti.lightnessAt({ u: 0, v: 0 }) === 0.9, "max wins, not sum");

// 13. ambient + lamp combine
const v7 = V.entityVisibility({ u: 10, v: 10 }, 6, lf);  // half daylight + halfway in lamp
ok(v7 > 0.5, `half-light + lamp = bright (got ${v7.toFixed(2)})`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
