// test_iter_130.js — device-graph (computers, monitors, speakers, radios,
// CDs, USBs, antennas, wires).
const D = require("./devices.js");
const W = require("./wires.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

// =====================================================================
// 1. Bus + registerDevice
// =====================================================================
const bus = D.createBus();
ok(bus.stats().deviceCount === 0, "empty bus");
ok(Array.isArray(bus.PORT_KINDS) && bus.PORT_KINDS.indexOf("rf") >= 0, "PORT_KINDS exported");

const r1 = bus.registerDevice({
  kind: "test",
  ports: [
    { name: "in1", kind: "data", direction: "in" },
    { name: "out1", kind: "data", direction: "out" },
  ],
});
ok(r1.ok && r1.id, "register basic device");

// Bad regs
ok(bus.registerDevice({}).ok === false, "no kind");
ok(bus.registerDevice({ kind: "x", ports: [{ name: "p" }] }).ok === false, "bad port");
ok(bus.registerDevice({ kind: "x", ports: [{ name: "p", kind: "moo", direction: "in" }] }).ok === false, "unknown kind");
ok(bus.registerDevice({ kind: "x", ports: [{ name: "p", kind: "data", direction: "weird" }] }).ok === false, "bad direction");

// =====================================================================
// 2. Computer + Monitor + wire
// =====================================================================
const pc  = bus.makeComputer({ id: "pc1", position: { u: 0, v: 0 } }).device;
const mon = bus.makeMonitor({ id: "mon1", position: { u: 1, v: 0 } }).device;
ok(pc.kind === "computer", "computer made");
ok(mon.kind === "monitor", "monitor made");
ok(pc.ports.video_out.direction === "out", "video_out is out");
ok(mon.ports.video_in.direction === "in", "video_in is in");

const cw = bus.connect("pc1", "video_out", "mon1", "video_in", "video");
ok(cw.ok, "video wire connects");

// Mismatched kinds rejected
const bad = bus.connect("pc1", "video_out", "mon1", "power_in", "video");
ok(bad.ok === false && bad.reason === "kind_mismatch", "kind mismatch rejected");

// Both-in rejected
const speak = bus.makeSpeaker({ id: "spk1" }).device;
const bothIn = bus.connect("mon1", "video_in", "spk1", "audio_in", "audio");
ok(bothIn.ok === false, "both-in rejected (also kind mismatch)");

// =====================================================================
// 3. Packet send → inbox
// =====================================================================
bus.send("pc1", "video_out", { kind: "video", payload: { frame: "HELLO MONITOR" } });
const inbox = bus.peek("mon1", "video_in");
ok(inbox.length === 1 && inbox[0].payload.frame === "HELLO MONITOR", "packet delivered");

const drained = bus.drain("mon1", "video_in");
ok(drained.length === 1, "drain works");
ok(bus.peek("mon1", "video_in").length === 0, "inbox empty after drain");

// =====================================================================
// 4. Speaker + audio
// =====================================================================
const aw = bus.connect("pc1", "audio_out", "spk1", "audio_in", "audio");
ok(aw.ok, "audio wire");
bus.send("pc1", "audio_out", { kind: "audio", payload: { samples: [0.1, 0.2, 0.3] } });
ok(bus.drain("spk1", "audio_in").length === 1, "speaker received audio");

// =====================================================================
// 5. CD insertion (slottedMedia + auto-wire + mount packet)
// =====================================================================
const cd = bus.makeStorageMedia({
  id: "cd1", mediaKind: "cd",
  files: { "/music/song.wav": "BYTES_PLACEHOLDER", "/readme.txt": "hello world" },
  label: "DEMO_DISC",
}).device;
ok(cd.kind === "cd", "CD made");
ok(cd.state.writable === false, "CD is read-only");

const ins = bus.insertMedia("pc1", "cd_slot", "cd1");
ok(ins.ok, "CD inserted");
ok(pc.state.slottedMedia.mediaId === "cd1", "slottedMedia tracked");

// The mount packet should have arrived at pc1's cd_slot
const mountPackets = bus.drain("pc1", "cd_slot");
ok(mountPackets.length === 1, "mount packet delivered");
ok(mountPackets[0].payload.op === "media_inserted", "mount op");
ok(mountPackets[0].payload.label === "DEMO_DISC", "mount label");
ok(mountPackets[0].payload.files["/readme.txt"] === "hello world", "mount files");

// Can't double-insert
ok(bus.insertMedia("pc1", "cd_slot", "cd1").ok === false, "no double insert");

// Eject
const ej = bus.ejectMedia("pc1");
ok(ej.ok, "ejected");
ok(pc.state.slottedMedia === null, "slot cleared");
ok(bus.wireFor("pc1", "cd_slot") === null, "wire removed");

// =====================================================================
// 6. USB writable
// =====================================================================
const usb = bus.makeStorageMedia({
  id: "usb1", mediaKind: "usb", files: { "/notes.txt": "user notes" }, label: "MY_USB",
}).device;
ok(usb.kind === "usb", "USB kind");
ok(usb.state.writable === true, "USB writable");

// =====================================================================
// 7. Radio frequency pairing
// =====================================================================
const r2bus = D.createBus({ config: { rfDefaultRange: 100 } });
const radioA = r2bus.makeRadio({ id: "rA", position: { u: 0, v: 0 }, frequency: 100.5, txRange: 50, rxRange: 50 }).device;
const radioB = r2bus.makeRadio({ id: "rB", position: { u: 30, v: 0 }, frequency: 100.5, txRange: 50, rxRange: 50 }).device;
const radioC = r2bus.makeRadio({ id: "rC", position: { u: 30, v: 0 }, frequency: 99.0,  txRange: 50, rxRange: 50 }).device;  // wrong freq
const radioD = r2bus.makeRadio({ id: "rD", position: { u: 999, v: 0 }, frequency: 100.5, txRange: 50, rxRange: 50 }).device; // out of range

const rfRes = r2bus.send("rA", "rf", { kind: "audio", payload: { msg: "breaker breaker" } });
ok(rfRes.ok, "rf send ok");
ok(rfRes.delivered === 1, `rf delivered to 1 (got ${rfRes.delivered})`);
ok(r2bus.drain("rB", "rf").length === 1, "rB heard it");
ok(r2bus.drain("rC", "rf").length === 0, "rC wrong freq, silent");
ok(r2bus.drain("rD", "rf").length === 0, "rD out of range, silent");

// =====================================================================
// 8. Device removal + cascade wire cleanup
// =====================================================================
const w3 = bus.connect("pc1", "usb_a", "usb1", "data_io", "data");
ok(w3.ok, "usb wire");
const before = bus.listWires().length;
bus.removeDevice("usb1");
const after = bus.listWires().length;
ok(after === before - 1, `wire cascade-removed (${before}→${after})`);

// =====================================================================
// 9. Wire visualization (pure-data)
// =====================================================================
const pts = W.wirePoints({ x: 0, y: 2, z: 0 }, { x: 4, y: 2, z: 0 });
ok(pts.length === 17, `segments default 16 = 17 pts (got ${pts.length})`);
ok(pts[0].x === 0 && pts[pts.length - 1].x === 4, "endpoints match");
// Sag dips midpoint y below straight line
const mid = pts[Math.floor(pts.length / 2)];
ok(mid.y < 2, `midpoint sags below endpoints (y=${mid.y.toFixed(2)})`);

ok(W.colorForKind("video") === 0x4488cc, "video cable blue");
ok(W.colorForKind("audio") === 0xff5533, "audio cable orange");
ok(W.colorForKind("data")  === 0x66cc66, "data cable green");
ok(W.colorForKind("unknown") === 0x222222, "unknown cable default");

// =====================================================================
// 10. Unpowered device rejects sends
// =====================================================================
const dev = bus.registerDevice({
  id: "off1", kind: "test", powered: false,
  ports: [{ name: "p", kind: "data", direction: "out" }],
}).device;
ok(dev.powered === false, "device unpowered");
const offSend = bus.send("off1", "p", { kind: "data" });
ok(offSend.ok === false, "unpowered send refused");

// =====================================================================
// 11. Events log
// =====================================================================
const evs = bus.recentEvents();
ok(evs.length > 0, "events logged");
ok(evs.some(e => e.kind === "wire_connected"), "wire_connected event present");
ok(evs.some(e => e.kind === "media_inserted"), "media_inserted event present");

// =====================================================================
// 12. Stats
// =====================================================================
const s = bus.stats();
ok(typeof s.deviceCount === "number", "stats deviceCount");
ok(typeof s.wireCount === "number", "stats wireCount");
ok(typeof s.kinds === "object", "stats kinds");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
