// test_iter_104.js — in-game radio: stations, playback, context.
const R = require("./radio.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

// Deterministic RNG for tests
function mkRng(seed) {
  let s = seed;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}

// 1. registerTrack
const radio = R.createRadio();
ok(radio.registerTrack({ id: "t1", duration: 100, genre: "rock" }).ok, "register t1");
ok(radio.registerTrack({}).ok === false, "missing id");
ok(radio.registerTrack({ id: "t1" }).ok === false, "duplicate");

for (const t of ["t2", "t3", "t4", "t5", "t6"]) {
  radio.registerTrack({ id: t, duration: 100, genre: "rock" });
}
ok(radio.listTracks().length === 6, "6 tracks");

// 2. createStation
ok(radio.createStation({ id: "rock_99", name: "Rock 99", genre: "rock", tags: ["city"] }).ok,
   "create station");
ok(radio.createStation({ id: "rock_99" }).ok === false, "duplicate");
ok(radio.createStation({}).ok === false, "missing id");

// 3. addTrackToStation
ok(radio.addTrackToStation("rock_99", "t1").ok, "add t1");
ok(radio.addTrackToStation("ghost", "t1").ok === false, "no station");
ok(radio.addTrackToStation("rock_99", "ghost_track").ok === false, "no track");
ok(radio.addTrackToStation("rock_99", "t1").ok === false, "already in");

for (const t of ["t2", "t3", "t4", "t5"]) radio.addTrackToStation("rock_99", t);
ok(radio.listStations()[0].tracks.length === 5, "5 tracks in station");

// 4. tuneTo + autoplay
const t0 = 1000;
const tune1 = radio.tuneTo("rock_99", { now: t0, rng: mkRng(42) });
ok(tune1.ok === true, "tune ok");
ok(radio.getNowPlaying() !== null, "now playing set");
ok(radio.getActiveStation().id === "rock_99", "active station");

// 5. tuneTo same station rejected
ok(radio.tuneTo("rock_99").ok === false, "already tuned");

// 6. play picks a track from the station
ok(radio.getNowPlaying().trackId !== null, "track playing");
ok(radio.getNowPlaying().station === "rock_99", "on rock_99");

// 7. tick — track progresses
const p1 = radio.tick(t0 + 50000);    // 50s elapsed
ok(p1 !== null, "still playing");
ok(p1.elapsed === 50, `elapsed = 50s (got ${p1.elapsed})`);
ok(p1.remaining === 50, `remaining = 50s`);

// 8. tick past duration → auto-advance
const p2 = radio.tick(t0 + 100000 + 1);    // past end
ok(p2 !== null, "still playing (auto-advance)");
ok(p2.elapsed === 0 || p2.elapsed < 1, "new track elapsed reset");

// 9. skip
const before = radio.getNowPlaying().trackId;
const skipped = radio.skip({ now: t0 + 5000 });
ok(skipped.ok === true, "skip ok");
const after = radio.getNowPlaying().trackId;
// Might pick the same track if no others eligible (but we have 5 tracks)
ok(radio.recentTracks().includes(before), "previous in recent");

// 10. no-repeat window
const radio2 = R.createRadio({ config: { noRepeatWindow: 3 } });
for (const t of ["a", "b", "c", "d"]) radio2.registerTrack({ id: t });
radio2.createStation({ id: "s", tracks: ["a", "b", "c", "d"] });
radio2.tuneTo("s", { now: 0 });
const played = new Set();
for (let i = 0; i < 10; i++) {
  played.add(radio2.getNowPlaying().trackId);
  radio2.skip();
}
ok(played.size === 4, `all 4 tracks played (got ${played.size})`);

// 11. Skip with no playback
const radio3 = R.createRadio();
ok(radio3.skip().ok === false, "skip when nothing playing");

// 12. play on empty station
const radio4 = R.createRadio();
radio4.createStation({ id: "empty" });
ok(radio4.tuneTo("empty").ok === false, "empty station fails");

// 13. tick when nothing playing
ok(radio3.tick() === null, "tick null when nothing");

// 14. autoAdvance off
const radio5 = R.createRadio({ config: { autoAdvance: false } });
radio5.registerTrack({ id: "x", duration: 10 });
radio5.createStation({ id: "s", tracks: ["x"] });
radio5.tuneTo("s", { now: 0 });
const p5 = radio5.tick(20 * 1000);   // 20s past 10s track
ok(p5 === null, "no auto-advance");
ok(radio5.getNowPlaying() === null, "playback ended");

// 15. suggestStationForContext
const radio6 = R.createRadio();
radio6.createStation({ id: "city_rock", genre: "rock", tags: ["city", "urban"] });
radio6.createStation({ id: "forest_amb", genre: "ambient", tags: ["forest", "calm"] });
radio6.createStation({ id: "war_metal", genre: "metal", tags: ["combat"] });

const sCity = radio6.suggestStationForContext({ locationTag: "city" });
ok(sCity === "city_rock", `city → city_rock (got ${sCity})`);

const sCombat = radio6.suggestStationForContext({ missionMood: "combat" });
ok(sCombat === "war_metal", `combat → war_metal (got ${sCombat})`);

// Mission mood beats location (weight 15 > 10)
const sBoth = radio6.suggestStationForContext({ locationTag: "city", missionMood: "combat" });
ok(sBoth === "war_metal", `combat beats city (got ${sBoth})`);

// 16. autoTuneByContext
radio6.registerTrack({ id: "tx", duration: 50 });
radio6.addTrackToStation("city_rock", "tx");
const at = radio6.autoTuneByContext({ locationTag: "city" }, { now: 0 });
ok(at.ok === true, "auto-tune ok");
ok(radio6.getActiveStation().id === "city_rock", "tuned to city_rock");

// Re-tune to same → kept
const at2 = radio6.autoTuneByContext({ locationTag: "city" });
ok(at2.ok && at2.kept === true, "kept when same");

// 17. No match
const radio7 = R.createRadio();
ok(radio7.autoTuneByContext({ locationTag: "anywhere" }).ok === false, "no station");

// 18. Recent events + tracks
ok(radio.recentEvents().length > 0, "events");
ok(radio.recentEvents().some(e => e.kind === "tune"), "tune event");

// 19. getConfig
const cfg = radio.getConfig();
ok(cfg.crossfadeMs > 0, "config exposed");

// 20. Crossfade marker on skip
const radio8 = R.createRadio();
radio8.registerTrack({ id: "a" });
radio8.registerTrack({ id: "b" });
radio8.createStation({ id: "s", tracks: ["a", "b"] });
radio8.tuneTo("s", { now: 0, rng: () => 0 });   // picks a
const beforeId = radio8.getNowPlaying().trackId;
radio8.skip({ rng: () => 0.6 });
const np = radio8.getNowPlaying();
ok(np.crossfadingFrom === beforeId, "crossfade marker set");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
