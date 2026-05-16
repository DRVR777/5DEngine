// test_iter_79.js — ride-along: replay buffer + spectator follow/free + catchup.
const R = require("./ride_along.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

// 1. Buffer basics
const buf = R.createBuffer({ capacity: 5 });
ok(buf.size() === 0, "empty buffer");
ok(buf.range() === null, "no range when empty");

const r1 = buf.push({ pos: { u: 0, v: 0 }, look: { yaw: 0 } });
ok(r1.ok && r1.seq === 0, "first push seq = 0");

for (let i = 1; i < 7; i++) {
  buf.push({ pos: { u: i, v: 0 }, look: { yaw: 0 } });
}
ok(buf.size() === 5, "capped at capacity");
ok(buf.range().first === 2 && buf.range().last === 6, `range 2..6 (got ${JSON.stringify(buf.range())})`);
ok(buf.getDropped() === 2, "2 dropped");

// Bad frame
ok(buf.push({}).ok === false, "missing pos rejected");

// 2. Buffer.get
const f3 = buf.get(3);
ok(f3 && f3.pos.u === 3, "get(3).pos.u = 3");
ok(buf.get(99) === null, "missing seq → null");
ok(buf.get(0) === null, "dropped seq → null");

// slice
const sl = buf.slice(3, 5);
ok(sl.length === 3, "slice(3,5) → 3 frames");

// snapshot
ok(buf.snapshot().length === 5, "snapshot = 5");

// 3. Spectator
const spec = R.createSpectator({});
ok(spec.getMode() === "follow", "default mode = follow");
ok(spec.getPlaySpeed() === 1, "default speed 1");

// Feed via spectator
for (let i = 0; i < 60; i++) {
  spec.feed({ pos: { u: i, v: 0 }, look: { yaw: 0 } });
}
ok(spec.buffer.size() === 60, "60 frames");

// 4. tick advances cursor
const f = spec.tick(1);   // 1s @ 60Hz = step 60 → clamps to last (seq 59)
ok(f != null, "tick returns frame");
ok(spec.getCursor() === 59, `cursor at last (got ${spec.getCursor()})`);
ok(spec.getLastFrame().pos.u === 59, "last frame is u=59");

// 5. Seek
const seek1 = spec.seek(30);
ok(seek1.ok && seek1.frame.pos.u === 30, "seek(30)");
ok(spec.getCursor() === 30, "cursor at 30");

const seekBad = spec.seek(999);
ok(seekBad.ok === false, "out-of-range seek fails");

// 6. setMode
ok(spec.setMode("free").ok === true, "set free");
ok(spec.getMode() === "free", "free mode active");
ok(spec.setMode("ghost").ok === false, "bad mode rejected");
spec.setMode("follow");

// 7. setPlaySpeed
ok(spec.setPlaySpeed(2).ok === true, "speed 2x");
ok(spec.getPlaySpeed() === 2, "speed = 2");
ok(spec.setPlaySpeed(0).ok === false, "0 rejected");
ok(spec.setPlaySpeed(99).ok === false, "99 rejected");

// 8. tick with speed 2
spec.seek(0);
spec.setPlaySpeed(2);
spec.tick(0.5);  // 0.5 * 2 * 60 = 60 steps; clamps at 59
ok(spec.getCursor() === 59, `2x speed (got ${spec.getCursor()})`);

// 9. Pause/resume
spec.seek(10);
spec.pause();
spec.tick(1);
ok(spec.getCursor() === 10, "paused cursor doesn't advance");
spec.resume();
spec.tick(0.1);   // 0.1 * 2 * 60 = 12 steps
ok(spec.getCursor() === 22, `resumed: 10+12=22 (got ${spec.getCursor()})`);

// 10. Subscribe
let received = 0;
const unsub = spec.subscribe(() => received++);
spec.seek(20);
spec.tick(0.05);  // emits at least 1 frame
ok(received >= 1, `subscriber got ${received} updates`);

unsub();
const before = received;
spec.tick(0.05);
ok(received === before, "unsubscribed: no more updates");

// 11. Catchup
const spec2 = R.createSpectator({});
for (let i = 0; i < 100; i++) spec2.feed({ pos: { u: i, v: 0 }, look: { yaw: 0 } });
spec2.seek(10);
const cu = spec2.catchup();
ok(cu.seq === 99, "catchup → last seq");
ok(spec2.getCursor() === 99, "cursor advanced");

// 12. Tick when buffer empty
const spec3 = R.createSpectator({});
ok(spec3.tick(1) === null, "tick empty → null");
ok(spec3.catchup() === null, "catchup empty → null");
ok(spec3.seek(5).ok === false, "seek empty → fail");

// 13. Vel + action preserved
const buf2 = R.createBuffer();
buf2.push({ pos: { u: 0, v: 0 }, look: { yaw: 0 }, vel: { u: 5 }, action: "jump" });
const f0 = buf2.get(0);
ok(f0.vel.u === 5, "vel preserved");
ok(f0.action === "jump", "action preserved");

// 14. Cursor clamps to buffer.first if behind dropped frames
const buf3 = R.createBuffer({ capacity: 10 });
const spec4 = R.createSpectator({ buffer: buf3, cursorSeq: 0 });
for (let i = 0; i < 30; i++) buf3.push({ pos: { u: i, v: 0 }, look: { yaw: 0 } });
// Buffer now has seq 20..29; cursor was 0
spec4.tick(0.01);
ok(spec4.getCursor() >= 20, `cursor caught up to alive range (got ${spec4.getCursor()})`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
