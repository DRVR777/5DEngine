// test_iter_60.js — server-authoritative anticheat validation.
const AC = require("./anticheat.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

ok(AC.DECISIONS.includes("reject") && AC.DECISIONS.includes("ban"), "DECISIONS enumerated");

// 1. Validator with default config
const v = AC.createValidator();
ok(v.config.maxSpeedMps === 12, "default maxSpeedMps = 12");
ok(v.config.strikesUntilBan === 5, "default strikesUntilBan = 5");

// 2. validateMove — normal
const r1 = v.validateMove("alice", { u: 0, v: 0, y: 0 }, { u: 1, v: 0, y: 0 }, 0.1);
ok(r1.decision === "accept", `normal move 10m/s accepted (got ${r1.decision})`);

// Speed hack: 13m/s (past 12 but under 1.5x)
const r2 = v.validateMove("alice", { u: 0, v: 0, y: 0 }, { u: 13, v: 0, y: 0 }, 1.0);
ok(r2.decision === "warn", `13m/s → warn (got ${r2.decision})`);
ok(v.getStrikes("alice") === 1, "1 strike");

// Teleport: 50m/s
const r3 = v.validateMove("bob", { u: 0, v: 0, y: 0 }, { u: 100, v: 0, y: 0 }, 1.0);
ok(r3.decision === "reject", "teleport rejected");
ok(r3.reason === "teleport", "reason = teleport");

// Bad dt
const rDt = v.validateMove("x", { u: 0, v: 0, y: 0 }, { u: 5, v: 0, y: 0 }, 0);
ok(rDt.decision === "reject" && rDt.reason === "bad_dt", "bad dt rejected");

// Vertical jump
const rJump = v.validateMove("y", { u: 0, v: 0, y: 0 }, { u: 0, v: 0, y: 10 }, 0.1);
ok(rJump.decision === "reject", "huge jump rejected");

// 3. Strike escalation: 5 warns → ban
for (let i = 0; i < 4; i++) {
  v.validateMove("alice", { u: 0, v: 0, y: 0 }, { u: 13, v: 0, y: 0 }, 1.0);
}
ok(v.isBanned("alice"), `alice banned after ${v.getStrikes("alice")} strikes`);
const banned = v.validateMove("alice", { u: 0, v: 0, y: 0 }, { u: 1, v: 0, y: 0 }, 0.1);
ok(banned.decision === "reject" && banned.reason === "banned", "banned player rejected");

v.unban("alice");
ok(!v.isBanned("alice"), "unban works");
ok(v.getStrikes("alice") === 0, "strikes cleared on unban");

// 4. validateFire — ammo invariant
const fire1 = v.validateFire("carol", { name: "pistol", fireRate: 5 }, 12, 11, 1.0);
ok(fire1.decision === "accept", "fire with -1 ammo ok");

// Ammo went UP (impossible)
const fire2 = v.validateFire("carol", { name: "pistol", fireRate: 5 }, 11, 15, 1.5);
ok(fire2.decision !== "accept", "ammo increase flagged");

// 5. Fire rate cap
const v2 = AC.createValidator();
v2.validateFire("dave", { name: "smg", fireRate: 14 }, 30, 29, 1.0);
const fast = v2.validateFire("dave", { name: "smg", fireRate: 14 }, 29, 28, 1.0001);  // ~10000Hz
ok(fast.decision !== "accept", "absurd fire rate flagged");

// 6. validateBulletSpawn
const sp1 = v.validateBulletSpawn("eve", { u: 5, v: 5 }, { u: 5, v: 5 }, 1.5);
ok(sp1.decision === "accept", "bullet at firer pos ok");

const sp2 = v.validateBulletSpawn("eve", { u: 5, v: 5 }, { u: 50, v: 50 }, 1.5);
ok(sp2.decision !== "accept", "bullet 50m from firer flagged");

// 7. validateDamageClaim
const dmg1 = v.validateDamageClaim("frank", 25, { name: "pistol", damage: 18 });
// 25 > 18 * 1.2 = 21.6 → flag
ok(dmg1.decision !== "accept", "inflated damage flagged");

const dmg2 = v.validateDamageClaim("frank", 18, { name: "pistol", damage: 18 });
ok(dmg2.decision === "accept", "exact damage ok");

// No weapon def → warn
const dmg3 = v.validateDamageClaim("frank", 100, null);
ok(dmg3.decision === "warn" && dmg3.reason === "no_weapon_def", "missing def → warn");

// 8. validateSignedAction
const v3 = AC.createValidator();
const r4 = v3.validateSignedAction("grace", { type: "trade" }, () => true);
ok(r4.decision !== "accept", "unsigned action flagged");
ok(r4.reason === "unsigned_action", "unsigned reason");

const r5 = v3.validateSignedAction("grace",
  { type: "trade", signature: "sig:x", signer: "ed25519:y" }, () => true);
ok(r5.decision === "accept", "signed + valid → accept");

const r6 = v3.validateSignedAction("grace",
  { type: "trade", signature: "sig:fake", signer: "ed25519:y" }, () => false);
ok(r6.decision !== "accept" && r6.reason === "bad_signature", "bad sig flagged");

// 9. Throttle decision after 2-3 strikes
const v4 = AC.createValidator({ config: { strikesUntilBan: 10, throttleStrikes: 2 } });
v4.validateMove("hal", { u: 0, v: 0, y: 0 }, { u: 13, v: 0, y: 0 }, 1.0);
ok(v4.getStrikes("hal") === 1, "1 strike");
const t = v4.validateMove("hal", { u: 0, v: 0, y: 0 }, { u: 13, v: 0, y: 0 }, 1.0);
ok(t.decision === "throttle", `2nd strike → throttle (got ${t.decision})`);

// 10. Audit log
const logs = v4.recentLog();
ok(logs.length >= 2, `audit log has entries (${logs.length})`);
ok(logs[0].playerId === "hal", "playerId in log");
ok(logs[0].kind === "speed_hack", "kind in log");
ok(logs[0].decision === "warn", "decision in log");

// 11. reset
v4.reset();
ok(v4.getStrikes("hal") === 0, "strikes cleared");
ok(v4.recentLog().length === 0, "log cleared");

// 12. Custom config
const v5 = AC.createValidator({ config: { maxSpeedMps: 30 } });
const ok5 = v5.validateMove("ivan", { u: 0, v: 0, y: 0 }, { u: 25, v: 0, y: 0 }, 1.0);
ok(ok5.decision === "accept", "25m/s ok with custom maxSpeedMps=30");

// 13. Independent player tracking
v.validateMove("p1", { u: 0, v: 0, y: 0 }, { u: 13, v: 0, y: 0 }, 1.0);
v.validateMove("p2", { u: 0, v: 0, y: 0 }, { u: 13, v: 0, y: 0 }, 1.0);
ok(v.getStrikes("p1") === 1 && v.getStrikes("p2") === 1, "strikes tracked per player");
ok(v.getStrikes("ghost") === 0, "unknown player has 0 strikes");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
