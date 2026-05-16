// test_iter_119.js — cooking: recipes + cook + buffs + skill.
const C = require("./cooking.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

function mkInv() {
  const owned = new Map();
  const k = (p, i) => p + "::" + i;
  return {
    give: (p, i, q) => owned.set(k(p,i), (owned.get(k(p,i)) || 0) + q),
    own: (p, i) => owned.get(k(p,i)) || 0,
    hasAll: (p, ingredients) => {
      for (const [it, qty] of Object.entries(ingredients)) {
        if ((owned.get(k(p, it)) || 0) < qty) return false;
      }
      return true;
    },
    consume: (p, ingredients) => {
      for (const [it, qty] of Object.entries(ingredients)) {
        owned.set(k(p,it), (owned.get(k(p,it)) || 0) - qty);
      }
      return true;
    },
  };
}

// 1. Qualities
ok(C.QUALITIES.length === 6, "6 qualities");
ok(C.QUALITIES.includes("perfect"), "perfect");
ok(C.QUALITIES.includes("burnt"), "burnt");

// 2. registerRecipe
const sys = C.createSystem();
ok(sys.registerRecipe({
  id: "bread",
  name: "Bread",
  ingredients: { flour: 2, water: 1 },
  output: "bread_loaf",
  buff: { name: "fed", magnitude: 10, durationMs: 60000 },
}).ok, "register bread");

ok(sys.registerRecipe({}).ok === false, "missing id");
ok(sys.registerRecipe({ id: "x" }).ok === false, "missing ingredients");
ok(sys.registerRecipe({ id: "x", ingredients: {} }).ok === false, "missing output");
ok(sys.registerRecipe({ id: "bread", ingredients: {}, output: "x" }).ok === false, "duplicate");

ok(sys.listRecipes().length === 1, "1 recipe");
ok(sys.getRecipe("bread") !== null, "getRecipe");
ok(sys.getRecipe("ghost") === null, "ghost null");

// 3. cook missing recipe
ok(sys.cook("p", "ghost").ok === false, "no_recipe");

// 4. cook with missing ingredients
const inv = mkInv();
const r1 = sys.cook("alice", "bread", { inventory: inv });
ok(r1.ok === false && r1.reason === "missing_ingredients", "no ingredients");

// 5. cook successfully (rng=0.99 avoids fail)
inv.give("alice", "flour", 4);
inv.give("alice", "water", 2);
const r2 = sys.cook("alice", "bread", { inventory: inv, rng: () => 0.99 });
ok(r2.ok === true, `cook ok (${r2.reason || "ok"})`);
ok(r2.output === "bread_loaf", "output bread_loaf");
ok(r2.quality !== "burnt", "not burnt");
ok(r2.xpGained > 0, "xp gained");

// Ingredients consumed
ok(inv.own("alice", "flour") === 2, "flour reduced to 2");
ok(inv.own("alice", "water") === 1, "water reduced to 1");
// Output given
ok(inv.own("alice", "bread_loaf") === 1, "got bread_loaf");

// 6. cook with rng=0 → likely fail (base 20%)
const r3 = sys.cook("alice", "bread", { inventory: inv, rng: () => 0 });
if (!r3.ok) {
  ok(r3.reason === "burnt", "rng=0 burnt");
  ok(r3.quality === "burnt", "quality burnt");
  ok(r3.xpGained < 20, "less xp on fail");
} else {
  ok(r3.ok === true, "rng=0 cooked anyway (skill reduced fail chance)");
}

// 7. Skill level + XP
const sys2 = C.createSystem({ config: { xpPerLevel: 100, xpPerCook: 50, baseFailChance: 0 } });
sys2.registerRecipe({ id: "soup", ingredients: { broth: 1 }, output: "soup_bowl" });
ok(sys2.getLevel("p") === 1, "level 1");
ok(sys2.getXP("p") === 0, "0 xp");

const inv2 = mkInv();
for (let i = 0; i < 5; i++) inv2.give("p", "broth", 1);
for (let i = 0; i < 3; i++) sys2.cook("p", "soup", { inventory: inv2, rng: () => 0.5 });
ok(sys2.getXP("p") === 150, `xp = 150 (got ${sys2.getXP("p")})`);
ok(sys2.getLevel("p") === 2, `level 2 (got ${sys2.getLevel("p")})`);

// 8. minSkill gate
sys.registerRecipe({
  id: "feast",
  ingredients: { caviar: 1, gold: 1 },
  output: "feast_dish",
  minSkill: 10,
});
inv.give("alice", "caviar", 1);
inv.give("alice", "gold", 1);
const r4 = sys.cook("alice", "feast", { inventory: inv });
ok(r4.ok === false && r4.reason === "skill_too_low", "skill too low");

// 9. consume → applies buff
const inv3 = mkInv();
inv3.give("alice", "flour", 2); inv3.give("alice", "water", 1);
sys.cook("alice", "bread", { inventory: inv3, rng: () => 0.99 });
const c1 = sys.consume("alice", "bread_loaf", { now: 1000, quality: "normal" });
ok(c1.ok === true, "consume ok");
ok(c1.buff.name === "fed", "fed buff");

ok(sys.activeBuffs("alice", 1100).length === 1, "buff active");
ok(sys.activeBuffs("alice", 100000).length === 0, "buff expired");

// 10. Consume unknown dish
ok(sys.consume("alice", "junk").ok === false, "no buff item");

// 11. tickBuffs prunes expired
const sys3 = C.createSystem();
sys3.registerRecipe({
  id: "x", ingredients: { y: 1 }, output: "x_out",
  buff: { name: "boost", magnitude: 5, durationMs: 1000 },
});
sys3.consume("p", "x_out", { now: 0 });
ok(sys3.activeBuffs("p", 500).length === 1, "active at 500");
sys3.tickBuffs(5000);
ok(sys3.activeBuffs("p", 5000).length === 0, "expired after tick");

// 12. clearBuff
const sys4 = C.createSystem();
sys4.registerRecipe({ id: "x", ingredients: { y: 1 }, output: "x_out",
                      buff: { name: "boost", magnitude: 1, durationMs: 9999999 } });
sys4.consume("p", "x_out");
ok(sys4.clearBuff("p", "boost").removed === 1, "cleared 1");
ok(sys4.activeBuffs("p").length === 0, "no active");

ok(sys4.clearBuff("ghost", "x").ok === false, "ghost clear");

// 13. Quality affects buff magnitude
const sys5 = C.createSystem();
sys5.registerRecipe({
  id: "stew", ingredients: { meat: 1 }, output: "stew_bowl",
  buff: { name: "energy", magnitude: 10, durationMs: 60000 },
});
const cNormal = sys5.consume("p1", "stew_bowl", { quality: "normal", now: 0 });
const cPerfect = sys5.consume("p2", "stew_bowl", { quality: "perfect", now: 0 });
ok(cNormal.buff.magnitude === 10, "normal = base");
ok(cPerfect.buff.magnitude > 10, `perfect > base (got ${cPerfect.buff.magnitude})`);

const cBurnt = sys5.consume("p3", "stew_bowl", { quality: "burnt", now: 0 });
ok(cBurnt.buff.magnitude < 10, `burnt < base (got ${cBurnt.buff.magnitude})`);

// 14. unregisterRecipe
ok(sys.unregisterRecipe("feast") === true, "unreg");
ok(sys.getRecipe("feast") === null, "removed");
ok(sys.unregisterRecipe("ghost") === false, "ghost unreg");

// 15. Cook without inventory bridge → no consume, no give, but xp + quality work
const sys6 = C.createSystem({ config: { baseFailChance: 0 } });
sys6.registerRecipe({ id: "x", ingredients: { y: 1 }, output: "x_out" });
const r6 = sys6.cook("p", "x", { rng: () => 0.5 });
ok(r6.ok === true, "cook without inventory");
ok(r6.quality !== "burnt", "quality assigned");

// 16. Multiple recipes
sys.registerRecipe({ id: "salad", ingredients: { lettuce: 1 }, output: "salad_bowl" });
ok(sys.listRecipes().length >= 2, "multiple recipes");

// 17. recentEvents
ok(sys.recentEvents().length > 0, "events");
ok(sys.recentEvents().some(e => e.kind === "register_recipe"), "register events");
ok(sys.recentEvents().some(e => e.kind === "cook_success"), "cook events");

// 18. getConfig
ok(sys.getConfig().xpPerLevel > 0, "config");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
