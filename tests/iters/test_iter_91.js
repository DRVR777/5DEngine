// test_iter_91.js — replay export: serialize, delta-encode, roundtrip.
const RA = require("./ride_along.js");
const RX = require("./replay_export.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

// 1. Export empty buffer
const empty = RA.createBuffer();
const e1 = RX.exportBundle(empty);
ok(e1.ok === false && e1.reason === "empty_buffer", "empty buffer reported");
ok(e1.bundle.frames.length === 0, "empty bundle frames=0");

// 2. Single-frame export
const buf1 = RA.createBuffer();
buf1.push({ pos: { u: 5, v: 7, y: 1 }, look: { yaw: 0.5, pitch: 0.1 }, ts: 1000 });
const e2 = RX.exportBundle(buf1);
ok(e2.ok === true, "single frame ok");
ok(e2.bundle.frames.length === 1, "1 frame");
ok(e2.bundle.frames[0].pos.u === 5, "pos preserved");

// 3. Multi-frame delta encoding
const buf2 = RA.createBuffer();
for (let i = 0; i < 50; i++) {
  buf2.push({
    pos: { u: i * 0.5, v: 0, y: 0 },
    look: { yaw: i * 0.01, pitch: 0 },
    ts: 1000 + i * 16,
  });
}
const e3 = RX.exportBundle(buf2, { sessionId: "s1", hostId: "alice", fps: 60 });
ok(e3.ok === true, "50-frame export ok");
ok(e3.bundle.header.totalFrames === 50, "totalFrames");
ok(e3.bundle.header.sessionId === "s1", "sessionId in header");
ok(e3.bundle.header.fps === 60, "fps in header");
ok(e3.bundle.frames.length === 50, "50 entries");
// First is full
ok(e3.bundle.frames[0].pos !== undefined, "frame[0] is full");
// Rest are deltas
ok(e3.bundle.frames[1].dPos !== undefined, "frame[1] is delta");
ok(e3.bundle.frames[1].dts !== undefined, "delta has dts");

// 4. Roundtrip
const imp = RX.importBundle(e3.bundle);
ok(imp.ok === true, "import ok");
ok(imp.frames.length === 50, "reconstructed 50 frames");
ok(Math.abs(imp.frames[10].pos.u - 5) < 0.001, `pos[10].u = 5 (got ${imp.frames[10].pos.u})`);
ok(imp.frames[49].seq === buf2.snapshot()[49].seq, "last seq preserved");

// 5. Roundtrip values match originals (within rounding)
let allMatch = true, mismatchAt = -1;
const original = buf2.snapshot();
for (let i = 0; i < original.length; i++) {
  const o = original[i], r = imp.frames[i];
  if (Math.abs(o.pos.u - r.pos.u) > 0.001) { allMatch = false; mismatchAt = i; break; }
  if (o.ts !== r.ts) { allMatch = false; mismatchAt = i; break; }
}
ok(allMatch, `all frames match (mismatch at ${mismatchAt})`);

// 6. Bad bundle import
ok(RX.importBundle(null).ok === false, "null rejected");
ok(RX.importBundle({}).ok === false, "no header rejected");
ok(RX.importBundle({ header: { formatVersion: 99 }, frames: [] }).ok === false,
   "format mismatch rejected");

// 7. JSON roundtrip
const json = RX.toJSON(e3.bundle);
ok(typeof json === "string" && json.length > 0, "JSON nonempty");
const back = RX.fromJSON(json);
ok(back && back.header.sessionId === "s1", "fromJSON works");
ok(RX.fromJSON("garbage") === null, "bad JSON returns null");

// 8. Action and velocity preserved
const buf3 = RA.createBuffer();
buf3.push({ pos: { u: 0, v: 0 }, look: { yaw: 0 }, vel: { u: 5 }, action: "jump", ts: 0 });
buf3.push({ pos: { u: 1, v: 0 }, look: { yaw: 0 }, vel: { u: 10 }, action: "run", ts: 16 });
buf3.push({ pos: { u: 2, v: 0 }, look: { yaw: 0 }, vel: { u: 10 }, action: "run", ts: 32 });
const e4 = RX.exportBundle(buf3);
const i4 = RX.importBundle(e4.bundle);
ok(i4.frames[0].action === "jump", "action[0] = jump");
ok(i4.frames[1].action === "run", "action[1] = run");
ok(i4.frames[2].action === "run", "action[2] = run (carried from prev)");
ok(i4.frames[0].vel.u === 5, "vel[0]");
ok(i4.frames[1].vel.u === 10, "vel[1]");

// 9. Gzip roundtrip (Node only)
const gz = RX.toGzip(e3.bundle);
ok(gz && gz.length > 0, "gzip nonempty");
ok(gz.length < RX.toJSON(e3.bundle).length, `gzip smaller (${gz.length} vs ${RX.toJSON(e3.bundle).length})`);
const ungz = RX.fromGzip(gz);
ok(ungz && ungz.header.sessionId === "s1", "gunzip roundtrip");

// 10. describe
const d = RX.describe(e3.bundle);
ok(d.totalFrames === 50, "describe totalFrames");
ok(d.durationMs === 50 * (1000 / 60), `duration = ${d.durationMs}ms`);
ok(d.bytesJSON > 0, "bytesJSON nonzero");
ok(RX.describe(null) === null, "null describe");

// 11. Array input (no buffer wrapper)
const arr = [
  { seq: 0, ts: 0, pos: { u: 0, v: 0, y: 0 }, look: { yaw: 0, pitch: 0 } },
  { seq: 1, ts: 16, pos: { u: 1, v: 0, y: 0 }, look: { yaw: 0, pitch: 0 } },
];
const e5 = RX.exportBundle(arr);
ok(e5.ok === true && e5.bundle.frames.length === 2, "array input works");
const i5 = RX.importBundle(e5.bundle);
ok(i5.frames[1].pos.u === 1, "imported from array");

// 12. Format version exported
ok(e3.bundle.header.formatVersion === RX.FORMAT_VERSION, "format version stamped");

// 13. Large roundtrip (1000 frames)
const big = RA.createBuffer({ capacity: 1500 });
for (let i = 0; i < 1000; i++) {
  big.push({
    pos: { u: Math.sin(i * 0.1) * 10, v: Math.cos(i * 0.1) * 10, y: 0 },
    look: { yaw: i * 0.001, pitch: 0 },
    ts: i * 16,
  });
}
const bigExp = RX.exportBundle(big);
ok(bigExp.bundle.frames.length === 1000, "1000 exported");
const bigImp = RX.importBundle(bigExp.bundle);
ok(bigImp.frames.length === 1000, "1000 reimported");
// Compare a random sample
const sampleOrig = big.snapshot()[500];
const sampleImp = bigImp.frames[500];
ok(Math.abs(sampleOrig.pos.u - sampleImp.pos.u) < 0.01, "1000-frame mid sample matches");

// 14. Gzip + JSON consistent
const bigJSON = RX.toJSON(bigExp.bundle);
const bigGz = RX.toGzip(bigExp.bundle);
ok(bigGz.length < bigJSON.length / 2, `gzip <50% raw (${bigGz.length} vs ${bigJSON.length})`);

// 15. Meta passthrough
const e6 = RX.exportBundle(buf2, { meta: { player: "alice", map: "city" } });
ok(e6.bundle.header.meta.player === "alice", "meta passthrough");
ok(e6.bundle.header.meta.map === "city", "meta passthrough 2");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
