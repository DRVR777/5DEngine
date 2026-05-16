// test_iter_112.js — weather→music bridge: mapping, hysteresis, tune.
const Bridge = require("./weather_music_bridge.js");
const Weather = require("./weather_forecast.js");
const Radio = require("./radio.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

// Helpers: fake weatherSource that returns a fixed kind
function fakeWeatherSource(kindGetter) {
  return {
    weatherAt: (_fc, _now) => ({ kind: kindGetter(), intensity: 1.0 }),
  };
}

// Build a radio with required stations
function setupRadio() {
  const r = Radio.createRadio();
  for (const id of ["ambient_clear", "calm_rain", "energetic_storm"]) {
    r.registerTrack({ id: id + "_t1", duration: 100 });
    r.createStation({ id, tracks: [id + "_t1"] });
  }
  return r;
}

// 1. Validation
ok((() => { try { Bridge.createBridge({}); return false; } catch (e) { return true; } })(),
   "missing radio throws");
ok((() => { try { Bridge.createBridge({ radio: {} }); return false; } catch (e) { return true; } })(),
   "missing weatherSource throws");

// 2. Default mappings
const radio = setupRadio();
let kind = "clear";
const wsrc = fakeWeatherSource(() => kind);
const br = Bridge.createBridge({ radio, weatherSource: wsrc });
ok(br.getMapping("clear") === "ambient_clear", "default mapping clear");
ok(br.getMapping("rain") === "calm_rain", "default rain");
ok(br.getMapping("storm") === "energetic_storm", "default storm");
ok(br.getMapping("ghost") === null, "missing kind null");

// 3. Custom mapping
ok(br.setMapping("clear", "energetic_storm").ok, "remap clear");
ok(br.getMapping("clear") === "energetic_storm", "remap applied");
ok(br.setMapping("x", null).ok === false, "bad station rejected");

// 4. setMappings bulk
br.setMappings({ fog: "calm_rain" });
ok(br.getMapping("fog") === "calm_rain", "bulk mapping");

// 5. tick → first observation, no switch (hysteresis)
const r1 = br.tick({ now: 1000 });
ok(r1.ok === true, "tick ok");
ok(!r1.switched, "no switch on first tick (hysteresis)");
ok(r1.streak === 1, "streak 1");

// 6. tick again same kind → streak grows
const r2 = br.tick({ now: 1100 });
ok(r2.streak === 2, "streak 2");
ok(!r2.switched, "no switch yet");

// 7. tick again → reaches hysteresisTicks (3)
const r3 = br.tick({ now: 1200 });
ok(r3.switched === true, "switched after 3 ticks");
ok(r3.to === "clear", "to clear");
ok(r3.stationId === "energetic_storm", "stationId from remapping");
ok(br.getCurrentKind() === "clear", "current kind set");

// 8. Same kind → kept
const r4 = br.tick({ now: 1300 });
ok(r4.kept === true, "stays on same kind");
ok(!r4.switched, "no re-switch");

// 9. Different kind → restarts hysteresis
kind = "rain";
const r5 = br.tick({ now: 2000 });
ok(r5.candidate === "rain", "rain candidate");
ok(r5.streak === 1, "streak reset");
ok(br.getCurrentKind() === "clear", "still clear (waiting hysteresis)");

// Brief blip → switches back
kind = "clear";
const r6 = br.tick({ now: 2100 });
ok(r6.kept === true, "blip back to clear keeps clear");

// Sustained rain → switches
kind = "rain";
for (let i = 0; i < 3; i++) br.tick({ now: 3000 + i * 100 });
ok(br.getCurrentKind() === "rain", "rain after 3 ticks");

// 10. Hysteresis configurable
const br2 = Bridge.createBridge({ radio, weatherSource: wsrc,
                                  config: { hysteresisTicks: 1 } });
const r10 = br2.tick({ now: 100 });
ok(r10.switched === true, "switches immediately with hysteresis=1");

// 11. Missing mapping for kind
const br3 = Bridge.createBridge({ radio, weatherSource: fakeWeatherSource(() => "alien"),
                                  config: { hysteresisTicks: 1 } });
const r11 = br3.tick({ now: 100 });
ok(r11.ok === false && r11.reason === "no_mapping", "no mapping for alien");

// 12. Radio that throws
const badRadio = {
  tuneTo: () => { throw new Error("boom"); },
};
const br4 = Bridge.createBridge({ radio: badRadio, weatherSource: wsrc,
                                  config: { hysteresisTicks: 1 } });
kind = "clear";
const r12 = br4.tick();
ok(r12.ok === false && r12.reason === "tune_threw", "tune threw caught");

// 13. weatherSource returns no kind
const br5 = Bridge.createBridge({
  radio,
  weatherSource: { weatherAt: () => null },
});
const r13 = br5.tick({ now: 1 });
ok(r13.ok === false && r13.reason === "no_weather", "no_weather handled");

// 14. Reset
br.reset();
ok(br.getCurrentKind() === null, "reset clears");

// 15. Integration with real weather forecast
const fc = Weather.forecast({
  startTs: 100000, durationMs: 60 * 60 * 1000,
  seed: 42, climate: "temperate",
});
const realRadio = setupRadio();
// Add all needed stations (forecast may pick any of 7 kinds)
for (const id of ["snow_station"]) {
  realRadio.registerTrack({ id: id + "_t", duration: 100 });
  realRadio.createStation({ id, tracks: [id + "_t"] });
}
const realBr = Bridge.createBridge({
  radio: realRadio,
  weatherSource: {
    weatherAt: (_fc, now) => Weather.weatherAt(fc, now),
  },
  config: { hysteresisTicks: 2 },
});
realBr.setMapping("snow", "snow_station");

// Tick across the forecast at slot starts
for (let i = 0; i < 10; i++) {
  realBr.tick({ now: 100000 + i * 5 * 60 * 1000, forecast: fc });
}
// Should have set some current kind
ok(realBr.getCurrentKind() !== null, `current kind set from real forecast (${realBr.getCurrentKind()})`);

// 16. Events logged
const ev = br.recentEvents();
ok(ev.length > 0, "events");
ok(ev.some(e => e.kind === "switch"), "switch events");

// 17. getConfig
ok(br.getConfig().hysteresisTicks > 0, "config");

// 18. Re-init after reset works
kind = "storm";
for (let i = 0; i < 3; i++) br.tick({ now: 10000 + i * 100 });
ok(br.getCurrentKind() === "storm", "post-reset switches to storm");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
