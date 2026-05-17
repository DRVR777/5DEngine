// test_iter_48.js — boss battle phases + telegraphed attacks.
const Boss = require("./boss.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

// 1. Phases + attacks
ok(Boss.PHASES.intro && Boss.PHASES.enraged && Boss.PHASES.desperate, "3 phases");
ok(Boss.PHASES.intro.attacks.length === 1, "intro has 1 attack");
ok(Boss.PHASES.enraged.attacks.length === 3, "enraged has 3");
ok(Boss.PHASES.desperate.attacks.length === 3, "desperate has 3");
ok(Boss.ATTACKS.slam && Boss.ATTACKS.swipe && Boss.ATTACKS.missile && Boss.ATTACKS.scream,
   "4 attacks defined");

// Cooldowns decrease through phases
ok(Boss.PHASES.intro.cooldownMs > Boss.PHASES.enraged.cooldownMs,
   "enraged faster than intro");
ok(Boss.PHASES.enraged.cooldownMs > Boss.PHASES.desperate.cooldownMs,
   "desperate fastest");

// Telegraph windows shrink
ok(Boss.PHASES.intro.telegraphMs > Boss.PHASES.desperate.telegraphMs,
   "telegraph windows shrink with phase");

// 2. phaseForHp transitions
ok(Boss.phaseForHp(500, 500) === "intro", "full hp = intro");
ok(Boss.phaseForHp(350, 500) === "enraged", "70% = enraged");
ok(Boss.phaseForHp(151, 500) === "enraged", ">30% still enraged");
ok(Boss.phaseForHp(150, 500) === "desperate", "exactly 30% → desperate (strict)");
ok(Boss.phaseForHp(149, 500) === "desperate", "<30% desperate");
ok(Boss.phaseForHp(10, 500) === "desperate", "near-dead desperate");

// 3. makeBoss defaults
const boss = Boss.makeBoss({ name: "Test Lord", maxHp: 500 });
ok(boss.name === "Test Lord", "name set");
ok(boss.maxHp === 500, "maxHp set");
ok(boss.phase === "intro", "starts in intro");
ok(boss.attackQueue.length === 0, "no queued attacks initially");

// 4. tick issues a telegraphed attack after cooldown
const target = {
  position: { u: 1.5, v: 0, y: 0 },
  health: { current: 100, max: 100, dead: false },
};
const telegraphedAttacks = [];
const strikes = [];
const r1 = Boss.tick(boss, { u: 0, v: 0, y: 0 }, 0, target, 0.1, 1000, {
  telegraph: (type, pos, dir) => telegraphedAttacks.push({ type, pos, dir }),
  strike: (type, hits) => strikes.push({ type, hits }),
  bossHp: 500,
  targetId: "hero",
});
ok(r1.telegraphed !== null, "first tick after cooldown telegraphs");
ok(telegraphedAttacks.length === 1, "1 telegraph fired");
ok(telegraphedAttacks[0].type === "slam", "slam is intro's only attack");
ok(boss.attackQueue.length === 1, "attack queued");
ok(strikes.length === 0, "not struck yet (still in telegraph window)");

// 5. Strike fires after telegraph window
const r2 = Boss.tick(boss, { u: 0, v: 0, y: 0 }, 0, target, 0.1, 1000 + 850, {
  telegraph: () => {},
  strike: (type, hits) => strikes.push({ type, hits }),
  bossHp: 500,
  targetId: "hero",
});
ok(r2.attacked !== null, "strike fired after telegraph window");
ok(strikes.length === 1, "1 strike landed");
ok(strikes[0].type === "slam", "strike type matches");
ok(strikes[0].hits.length === 1, "hit registered (target in range 3.0, dist 1.5)");
ok(strikes[0].hits[0].damage === 25, "slam damage = 25");

// 6. Out-of-range strike misses
const farTarget = { position: { u: 100, v: 0, y: 0 }, health: { current: 100, max: 100 } };
boss.attackQueue.length = 0;
boss.lastAttackAt = -Infinity;
Boss.tick(boss, { u: 0, v: 0, y: 0 }, 0, farTarget, 0.1, 5000, {
  telegraph: () => {},
  strike: () => {},
  bossHp: 500,
  targetId: "far",
});
strikes.length = 0;
Boss.tick(boss, { u: 0, v: 0, y: 0 }, 0, farTarget, 0.1, 5000 + 900, {
  telegraph: () => {},
  strike: (type, hits) => strikes.push({ type, hits }),
  bossHp: 500,
  targetId: "far",
});
ok(strikes[0].hits.length === 0, "far target out of slam range → 0 hits");

// 7. Phase change: drop hp to <30%, expect desperate phase
boss.attackQueue.length = 0;
boss.lastAttackAt = -Infinity;
Boss.tick(boss, { u: 0, v: 0, y: 0 }, 0, target, 0.1, 10000, {
  telegraph: () => {}, strike: () => {}, bossHp: 100,    // 20% → desperate
  targetId: "hero",
});
ok(boss.phase === "desperate", "phase = desperate at 20% hp");

// 8. Stunned boss doesn't act
Boss.applyStun(boss, 5000, 20000);
boss.attackQueue.length = 0;
boss.lastAttackAt = 20000;
const stunR = Boss.tick(boss, { u: 0, v: 0, y: 0 }, 0, target, 0.1, 21000, {
  telegraph: () => {}, strike: () => {}, bossHp: 100,
  targetId: "hero",
});
ok(stunR.telegraphed === null && stunR.attacked === null, "stunned boss is silent");

// 9. Cone calculation: target in front
ok(Boss.inCone(0, 0, 5, 0, 0, Math.PI / 2) === true, "target straight ahead in 90° cone");
ok(Boss.inCone(0, 5, 0, 0, 0, Math.PI / 2) === false, "target 90° to side not in 90° cone");
ok(Boss.inCone(0, -5, 0, 0, 0, Math.PI / 2) === false, "target behind not in cone");
ok(Boss.inCone(0, 0, 5, 0, 0, Math.PI * 2) === true, "full circle always in cone");

// 10. Swipe in arc: behind target misses
const sideTarget = { position: { u: 0, v: -5, y: 0 }, health: { current: 100, max: 100 } };
boss.attackQueue.push({ type: "swipe", telegraphedAt: 100000, scheduledAt: 100000 });
strikes.length = 0;
Boss.tick(boss, { u: 0, v: 0, y: 0 }, 0, sideTarget, 0.1, 100100, {
  telegraph: () => {}, strike: (type, hits) => strikes.push({ type, hits }),
  bossHp: 100, targetId: "side",
});
ok(strikes[0].hits.length === 0, "swipe behind boss → 0 hits");

// 11. Phase advancing through attack list
const b2 = Boss.makeBoss({ maxHp: 500 });
const seen = [];
let now = 0;
function step() {
  now += 600;
  Boss.tick(b2, { u: 0, v: 0, y: 0 }, 0, target, 0.1, now, {
    telegraph: (type) => seen.push(type),
    strike: () => {}, bossHp: 50,  // desperate phase
    targetId: "hero",
  });
}
for (let i = 0; i < 10; i++) step();
// Desperate has 3 attacks rotating. Over 10 telegraphs we should see all 3 types.
const unique = new Set(seen);
ok(unique.size === 3, `all 3 desperate attacks rotated (got ${unique.size}: ${[...unique].join(",")})`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
