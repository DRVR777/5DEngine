// test_iter_28.js — in-game computer entity.
const Comp = require("./computer.js");
const Entity = require("./entity.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

// 1. makeComputer + defaults
const pc = Comp.makeComputer();
ok(pc.screen.width === 1280 && pc.screen.height === 800, "default screen 1280x800");
ok(pc.screen.bezelPx === 24, "default bezel 24px");
ok(pc.occupiedBy === null, "starts unoccupied");
ok(pc.activeApp === null, "no app running");
ok(pc.installedApps.length === 0, "no apps installed");

// 2. Custom params
const pc2 = Comp.makeComputer({
  width: 1920, height: 1080, bezelPx: 12,
  installedApps: ["app_a"],
  sittingPos: { u: 5, v: 5, y: 0 },
});
ok(pc2.screen.width === 1920, "custom width");
ok(pc2.installedApps.includes("app_a"), "preinstalled apps preserved");
ok(pc2.sittingPos.u === 5, "sitting position preserved");

// 3. Install / uninstall
const i1 = Comp.installApp(pc, "app_chat");
ok(i1.ok === true, "install app_chat ok");
const i2 = Comp.installApp(pc, "app_chat");
ok(i2.ok === false && i2.reason === "already_installed", "duplicate install rejected");
ok(pc.installedApps.length === 1, "exactly 1 app installed");

const u1 = Comp.uninstallApp(pc, "app_chat");
ok(u1.ok === true, "uninstall ok");
ok(pc.installedApps.length === 0, "no apps after uninstall");
const u2 = Comp.uninstallApp(pc, "ghost");
ok(u2.ok === false && u2.reason === "not_installed", "uninstall unknown rejected");

// 4. Sit + stand
Comp.installApp(pc, "app_chat");
const s1 = Comp.sit(pc, "alice");
ok(s1.ok === true, "alice sits");
ok(s1.takeover.viewport.width === 1280, "takeover spec carries viewport");
ok(s1.takeover.bezelPx === 24, "takeover spec carries bezelPx");
ok(Comp.isOccupied(pc), "now occupied");
ok(Comp.isOccupiedBy(pc, "alice"), "occupied by alice");

const s2 = Comp.sit(pc, "bob");
ok(s2.ok === false && s2.reason === "occupied" && s2.by === "alice",
   "bob can't sit — occupied by alice");

const s3 = Comp.sit(pc, "alice");
ok(s3.ok === true, "alice sitting again is no-op success");

const st1 = Comp.stand(pc, "bob");
ok(st1.ok === false, "bob can't stand from a seat he doesn't have");

const st2 = Comp.stand(pc, "alice");
ok(st2.ok === true, "alice stands");
ok(!Comp.isOccupied(pc), "now unoccupied");

// 5. Launch / exit app
Comp.sit(pc, "alice");
const l1 = Comp.launch(pc, "app_chat", "alice");
ok(l1.ok === true, "alice launches app_chat");
ok(pc.activeApp === "app_chat", "activeApp set");

const l2 = Comp.launch(pc, "missing_app", "alice");
ok(l2.ok === false && l2.reason === "not_installed", "launch missing app rejected");

const l3 = Comp.launch(pc, "app_chat", "bob");
ok(l3.ok === false && l3.reason === "not_seated", "non-seated player can't launch");

const e1 = Comp.exitApp(pc, "alice");
ok(e1.ok === true && pc.activeApp === null, "alice exits app");

// Standing also clears activeApp
Comp.launch(pc, "app_chat", "alice");
Comp.stand(pc, "alice");
ok(pc.activeApp === null, "standing clears activeApp");

// 6. File system shared by apps on the same computer
Comp.fsWrite(pc, "config.json", '{"theme":"dark"}');
Comp.fsWrite(pc, "draft.txt", "hello world");
ok(Comp.fsRead(pc, "config.json") === '{"theme":"dark"}', "fsRead returns written value");
ok(Comp.fsList(pc).length === 2, "fsList shows 2 keys");
Comp.fsDelete(pc, "draft.txt");
ok(Comp.fsList(pc).length === 1, "fsDelete drops key");
ok(Comp.fsRead(pc, "missing") === null, "missing key returns null");

// 7. Proximity for "press E to sit" prompt
const pcEntity = Entity.createEntity("computer", {
  position: { u: 10, v: 10, y: 0 },
  computer: Comp.makeComputer(),
});
ok(Comp.distanceTo(pcEntity.computer, pcEntity, { u: 11, v: 11 }) < 2,
   "proximity computes correctly close");
ok(Comp.distanceTo(pcEntity.computer, pcEntity, { u: 100, v: 100 }) > 50,
   "proximity computes correctly far");
ok(Comp.distanceTo(pcEntity.computer, null, { u: 0, v: 0 }) === Infinity,
   "missing entity → Infinity");

// 8. Multiple computers maintain independent state
const pcA = Comp.makeComputer();
const pcB = Comp.makeComputer();
Comp.sit(pcA, "alice");
ok(!Comp.isOccupied(pcB), "sitting at A doesn't affect B");
Comp.installApp(pcA, "appA_only");
ok(!pcB.installedApps.includes("appA_only"), "install on A doesn't leak to B");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
