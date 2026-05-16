// test_iter_70.js — music selector: palettes, context, crossfade.
const M = require("./music_selector.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

// Mock audio
function makeAudio() {
  const calls = { play: [], stop: [], setVolume: [] };
  let h = 1;
  return {
    calls,
    play: (spec) => { calls.play.push(spec); return { handle: h++ }; },
    stop: (handle) => calls.stop.push(handle),
    setVolume: (handle, v) => calls.setVolume.push({ handle, v }),
  };
}

const a = makeAudio();
const sel = M.createSelector({ audio: a, crossfadeMs: 100 });

// 1. CONTEXTS
ok(M.CONTEXTS.length === 6, "6 contexts");

// 2. Palette CRUD
sel.setPalette("city", {
  day: ["city_day_1.ogg", "city_day_2.ogg"],
  night: ["city_night.ogg"],
  rain: ["rain_city.ogg"],
  combat: ["combat_intense.ogg"],
});
sel.setPalette("forest", {
  day: ["forest_day.ogg"],
  night: ["forest_night.ogg"],
});
ok(sel.listWorlds().length === 2, "2 worlds");
ok(sel.getPalette("city").day.length === 2, "palette day");
ok(sel.getPalette("ghost") === null, "missing palette → null");

// 3. decideContext
ok(sel.decideContext({ hour: 12 }) === "day", "noon = day");
ok(sel.decideContext({ hour: 22 }) === "night", "10pm = night");
ok(sel.decideContext({ hour: 12, weather: "storm" }) === "storm", "storm overrides hour");
ok(sel.decideContext({ hour: 12, weather: "heavy_rain" }) === "rain", "heavy_rain → rain");
ok(sel.decideContext({ hour: 12, weather: "light_rain" }) === "rain", "light_rain → rain");
ok(sel.decideContext({ hour: 12, combat: true }) === "combat", "combat overrides");
ok(sel.decideContext({ hour: 12, menu: true }) === "menu", "menu overrides");
ok(sel.decideContext({}) === "day", "no opts → day default");

// 4. pickTrack
const t1 = sel.pickTrack("city", "day", () => 0);
ok(t1 === "city_day_1.ogg", "rng 0 → first track");
const t2 = sel.pickTrack("city", "day", () => 0.99);
ok(t2 === "city_day_2.ogg", "rng 0.99 → second track");

// Fallback: combat → day
const t3 = sel.pickTrack("forest", "combat", () => 0);
ok(t3 === "forest_day.ogg", "combat fallback to day");

// Storm → rain → day
sel.setPalette("test1", { day: ["d.ogg"] });
const t4 = sel.pickTrack("test1", "storm", () => 0);
ok(t4 === "d.ogg", "storm falls all the way to day");

// No tracks at all
sel.setPalette("empty", {});
const t5 = sel.pickTrack("empty", "day", () => 0);
ok(t5 === null, "no tracks → null");

// Missing world
ok(sel.pickTrack("ghost", "day", () => 0) === null, "missing world → null");

// 5. update — first call starts a track
const u1 = sel.update("city", { hour: 12 });
ok(u1.changed === true, "first update changes");
ok(u1.newTrack !== null, "track selected");
ok(u1.context === "day", "context = day");
ok(a.calls.play.length === 1, "audio.play called");
ok(a.calls.play[0].src.startsWith("city_day"), "city day track played");
ok(a.calls.play[0].loop === true, "loops");

// 6. Same context → no change
const u2 = sel.update("city", { hour: 13 });
ok(u2.changed === false, "same context → no change");

// 7. Different context → crossfade
const u3 = sel.update("city", { hour: 22 });
ok(u3.changed === true, "context changed");
ok(u3.context === "night", "now night");
ok(u3.crossfade === true, "crossfade flag");
ok(sel.isMixing() === true, "isMixing");
ok(a.calls.play.length === 2, "second track played");

// 8. tickCrossfade → progresses
const tc1 = sel.tickCrossfade();
ok(tc1.mixing === true, "mid-crossfade");
ok(typeof tc1.progress === "number", "progress reported");

// Wait for crossfade to complete (crossfadeMs=100)
const wait = (ms) => new Promise(r => setTimeout(r, ms));
wait(150).then(() => {
  const tc2 = sel.tickCrossfade();
  ok(tc2.mixing === false && tc2.completed === true, "crossfade done");
  ok(sel.isMixing() === false, "no longer mixing");
  ok(sel.getCurrentTrack() === "city_night.ogg", "current track = night");

  // 9. World change → new track + crossfade
  const u4 = sel.update("forest", { hour: 12 });
  ok(u4.changed === true, "world changed → update");
  ok(u4.context === "day", "context day");
  ok(sel.getCurrentWorld() === "forest", "current world = forest");
  ok(sel.isMixing() === true, "crossfading to forest");

  // Complete crossfade
  wait(150).then(() => {
    sel.tickCrossfade();
    ok(!sel.isMixing(), "crossfade done");
    ok(sel.getCurrentTrack() === "forest_day.ogg", "playing forest_day");

    // 10. stop
    sel.stop();
    ok(sel.getCurrentTrack() === null, "stopped");
    ok(sel.getCurrentContext() === null, "context cleared");

    // 11. No-palette world → currentTrack = null
    const u5 = sel.update("nowhere", { hour: 12 });
    ok(u5.newTrack === null, "no palette → no track");
    ok(sel.getCurrentTrack() === null, "no current track");

    // 12. Multiple updates without audio
    const sel2 = M.createSelector({});  // no audio
    sel2.setPalette("a", { day: ["x.ogg"] });
    const ur = sel2.update("a", { hour: 12 });
    ok(ur.changed === true, "update works without audio adapter");
    ok(sel2.getCurrentTrack() === "x.ogg", "current track tracked");

    // 13. tickCrossfade with no nextTrack
    const tc3 = sel.tickCrossfade();
    ok(tc3.mixing === false, "no-mix tick safe");

    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail === 0 ? 0 : 1);
  });
});
