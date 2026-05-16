// test_iter_78.js — accessibility: colorblind sims + subtitles + UI scale.
const A = require("./accessibility.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

// 1. Modes registered
const expected = ["none", "protanopia", "deuteranopia", "tritanopia", "achromatopsia"];
for (const m of expected) ok(A.COLORBLIND_MODES.includes(m), "mode: " + m);

// 2. applyColorblind
const pic = new Uint8Array([255, 0, 0, 255]);
A.applyColorblind(pic, "achromatopsia");
ok(pic[0] === 76 && pic[1] === 76 && pic[2] === 76, `gray (got ${pic[0]})`);

// none = identity
const id = new Uint8Array([100, 150, 200, 255]);
A.applyColorblind(id, "none");
ok(id[0] === 100 && id[1] === 150 && id[2] === 200, "none = identity");

// Unknown throws
let threw = false;
try { A.applyColorblind(new Uint8Array(4), "ghost"); } catch (e) { threw = true; }
ok(threw, "unknown mode throws");

// Alpha preserved
const a = new Uint8Array([255, 100, 50, 128]);
A.applyColorblind(a, "protanopia");
ok(a[3] === 128, "alpha preserved");

// 3. createState defaults
const s = A.createState();
const def = s.getState();
ok(def.colorblindMode === "none", "default colorblind = none");
ok(def.uiScale === 1.0, "default uiScale = 1.0");
ok(def.motionScale === 1.0, "default motionScale = 1.0");
ok(def.highContrast === false, "default highContrast = false");
ok(def.subtitlesEnabled === true, "subtitles enabled by default");

// 4. setColorblindMode
ok(s.setColorblindMode("protanopia").ok === true, "set protanopia");
ok(s.getState().colorblindMode === "protanopia", "mode persisted");
ok(s.setColorblindMode("ghost").ok === false, "bad mode rejected");

// 5. setUIScale bounds
ok(s.setUIScale(1.5).ok === true, "set 1.5");
ok(s.getState().uiScale === 1.5, "uiScale = 1.5");
ok(s.setUIScale(3.0).ok === false, "3.0 out of range");
ok(s.setUIScale(0.4).ok === false, "0.4 out of range");
ok(s.setUIScale("big").ok === false, "non-number rejected");

// 6. fontSize / panelSize helpers
ok(s.fontSize(14) === 21, `14 * 1.5 = 21 (got ${s.fontSize(14)})`);
ok(s.panelSize(200) === 300, `200 * 1.5 = 300 (got ${s.panelSize(200)})`);

// 7. motionScale
ok(s.setMotionScale(0).ok === true, "motionScale 0");
ok(s.motion(100) === 0, "motion(100) at 0 = 0");
ok(s.setMotionScale(0.5).ok === true, "motionScale 0.5");
ok(s.motion(100) === 50, "motion(100) at 0.5 = 50");
ok(s.setMotionScale(2).ok === false, "motionScale 2 out of range");

// 8. highContrast + reduceFlashes
s.setHighContrast(true);
ok(s.getState().highContrast === true, "highContrast on");
s.setReduceFlashes(true);
ok(s.getState().reduceFlashes === true, "reduceFlashes on");

// 9. Subtitles
const ts0 = 10000;
const r1 = s.pushSubtitle({ text: "Hello world.", speaker: "Carl", ts: ts0 });
ok(r1.ok === true && r1.id === "sub_1", "push subtitle");
ok(r1.subtitle.duration === 3.5, "default duration 3.5");

const r2 = s.pushSubtitle({ text: "*explosion*", kind: "sfx", duration: 2, ts: ts0 + 500 });
ok(r2.ok && r2.subtitle.kind === "sfx", "kind = sfx");

ok(s.pushSubtitle({}).ok === false, "missing text rejected");

// 10. activeSubtitles
const active = s.activeSubtitles(ts0 + 100);
ok(active.length === 1, "1 active at ts+100");

const active2 = s.activeSubtitles(ts0 + 1000);
ok(active2.length === 2, "2 active at ts+1000");
ok(active2[0].id === "sub_1", "sorted asc by ts");

// 11. expireSubtitles
// sub_2 expires at ts0+500 + 2000 = ts0+2500; sub_1 at ts0+3500
const dropped1 = s.expireSubtitles(ts0 + 3000);
ok(dropped1 === 1, "1 expired (sub_2)");

const active3 = s.activeSubtitles(ts0 + 3000);
ok(active3.length === 1 && active3[0].id === "sub_1", "sub_1 still alive");

const dropped2 = s.expireSubtitles(ts0 + 4000);
ok(dropped2 === 1, "sub_1 expired");
ok(s.activeSubtitles(ts0 + 4000).length === 0, "all gone");

// 12. clearSubtitles
s.pushSubtitle({ text: "a", ts: ts0 });
s.pushSubtitle({ text: "b", ts: ts0 });
s.clearSubtitles();
ok(s.activeSubtitles(ts0).length === 0, "cleared");

// 13. Disable subtitles
s.setSubtitlesEnabled(false);
ok(s.pushSubtitle({ text: "off" }).ok === false, "push rejected when disabled");

s.setSubtitlesEnabled(true);
ok(s.pushSubtitle({ text: "back" }).ok === true, "re-enabled");

// 14. setSubtitleSize bounds
ok(s.setSubtitleSize(1.5).ok === true, "subtitleSize 1.5");
ok(s.setSubtitleSize(4.0).ok === false, "4.0 out of range");
ok(s.getState().subtitleSize === 1.5, "subtitleSize persisted");

// 15. toJSON / fromJSON
const j = s.toJSON();
ok(j.colorblindMode === "protanopia", "json has mode");
ok(j.uiScale === 1.5, "json has uiScale");

const s2 = A.createState();
ok(s2.fromJSON(j).ok === true, "fromJSON ok");
const loaded = s2.getState();
ok(loaded.colorblindMode === "protanopia", "loaded mode");
ok(loaded.uiScale === 1.5, "loaded uiScale");
ok(loaded.highContrast === true, "loaded highContrast");

ok(s2.fromJSON(null).ok === false, "null fromJSON fails");

// 16. recentEvents
const ev = s.recentEvents();
ok(ev.length > 0, "events logged");
ok(ev.some(e => e.kind === "colorblind"), "colorblind event");

// 17. Sanity: deuteranopia changes red
const red = new Uint8Array([255, 0, 0, 255]);
A.applyColorblind(red, "deuteranopia");
// deuteranopia[r] = [0.625, 0.375, 0] → 255*0.625 = 159
ok(red[0] === 159, `deuteranopia red→159 (got ${red[0]})`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
