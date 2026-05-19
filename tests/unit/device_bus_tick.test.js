import { it, expect, describe } from "vitest";
import { mountDeviceBusTick } from "../../src/systems/device_bus_tick.js";

function makeBus({ packets = [], devices = {}, peekLens = { spk1: 0, radioB: 0 } } = {}) {
  const sent = [];
  return {
    send(to, port, msg) { sent.push({ to, port, msg }); },
    drain(dev, port)    { return (dev === "spk1" && port === "audio_in") ? [...packets] : []; },
    peek(dev, port)     { return { length: (dev === "spk1" ? peekLens.spk1 : peekLens.radioB) }; },
    getDevice(id)       { return devices[id] || null; },
    _sent: sent,
  };
}

function makeActions({ bus = null, heroPos = { u: 0, v: 0 }, audioMixer = true, sfxLog = [], mon1Log = [] } = {}) {
  return {
    getDeviceBus:   () => bus,
    getHeroPos:     () => heroPos,
    hasAudioMixer:  () => audioMixer,
    playSfx:        (src, vol) => sfxLog.push({ src, vol }),
    pollMon1Bridge: () => mon1Log.push("poll"),
  };
}

const BASE = { nowMs: 1000, lastMs: 900, score: 5, pickupCount: 10 };

describe("device_bus_tick — no bus", () => {
  it("returns early without throwing when no deviceBus", () => {
    const sys = mountDeviceBusTick({ actions: makeActions() });
    expect(() => sys.tick(0.016, BASE)).not.toThrow();
  });

  it("pollMon1Bridge not called when bus is null", () => {
    const mon1Log = [];
    mountDeviceBusTick({ actions: makeActions({ mon1Log }) }).tick(0.016, BASE);
    expect(mon1Log).toHaveLength(0);
  });
});

describe("device_bus_tick — PC video broadcast", () => {
  it("500ms boundary crossed → bus.send called for pc1 video_out", () => {
    const bus = makeBus();
    const sys = mountDeviceBusTick({ actions: makeActions({ bus }) });
    // nowMs=1000 → floor(1000/500)=2; lastMs=400 → floor(400/500)=0 → different
    sys.tick(0.016, { ...BASE, nowMs: 1000, lastMs: 400 });
    expect(bus._sent.some(s => s.to === "pc1" && s.port === "video_out")).toBe(true);
  });

  it("boundary not crossed → no broadcast", () => {
    const bus = makeBus();
    mountDeviceBusTick({ actions: makeActions({ bus }) })
      .tick(0.016, { ...BASE, nowMs: 1100, lastMs: 1050 }); // both floor to 2
    expect(bus._sent.filter(s => s.to === "pc1")).toHaveLength(0);
  });

  it("broadcast payload includes score and pickupCount", () => {
    const bus = makeBus();
    mountDeviceBusTick({ actions: makeActions({ bus }) })
      .tick(0.016, { ...BASE, nowMs: 1000, lastMs: 400, score: 7, pickupCount: 12 });
    const frame = bus._sent[0].msg.payload.frame;
    expect(frame).toContain("7");
    expect(frame).toContain("12");
  });
});

describe("device_bus_tick — speaker drain", () => {
  it("empty packet list → no playSfx", () => {
    const sfxLog = [];
    const bus = makeBus({ packets: [] });
    mountDeviceBusTick({ actions: makeActions({ bus, sfxLog }) })
      .tick(0.016, { ...BASE, nowMs: 1100, lastMs: 1050 });
    expect(sfxLog).toHaveLength(0);
  });

  it("packet with src → playSfx called", () => {
    const sfxLog = [];
    const bus = makeBus({ packets: [{ payload: { src: "blip", volume: 0.5 } }] });
    mountDeviceBusTick({ actions: makeActions({ bus, sfxLog }) })
      .tick(0.016, { ...BASE, nowMs: 1100, lastMs: 1050 });
    expect(sfxLog[0].src).toBe("blip");
  });

  it("packet with explicit volume → that volume used (no speaker position)", () => {
    const sfxLog = [];
    const bus = makeBus({ packets: [{ payload: { src: "blip", volume: 0.8 } }] });
    mountDeviceBusTick({ actions: makeActions({ bus, sfxLog }) })
      .tick(0.016, { ...BASE, nowMs: 1100, lastMs: 1050 });
    expect(sfxLog[0].vol).toBeCloseTo(0.8);
  });

  it("null volume in packet → default 0.4 used", () => {
    const sfxLog = [];
    const bus = makeBus({ packets: [{ payload: { src: "blip" } }] });
    mountDeviceBusTick({ actions: makeActions({ bus, sfxLog }) })
      .tick(0.016, { ...BASE, nowMs: 1100, lastMs: 1050 });
    expect(sfxLog[0].vol).toBeCloseTo(0.4);
  });

  it("speaker at distance 15 → volume halved (15/30 = 0.5)", () => {
    const sfxLog = [];
    const bus = makeBus({
      packets: [{ payload: { src: "blip", volume: 1.0 } }],
      devices: { spk1: { position: { u: 15, v: 0 } } },
    });
    mountDeviceBusTick({ actions: makeActions({ bus, sfxLog, heroPos: { u: 0, v: 0 } }) })
      .tick(0.016, { ...BASE, nowMs: 1100, lastMs: 1050 });
    expect(sfxLog[0].vol).toBeCloseTo(0.5);
  });

  it("speaker beyond 30m → volume clamped to 0", () => {
    const sfxLog = [];
    const bus = makeBus({
      packets: [{ payload: { src: "blip", volume: 1.0 } }],
      devices: { spk1: { position: { u: 50, v: 0 } } },
    });
    mountDeviceBusTick({ actions: makeActions({ bus, sfxLog, heroPos: { u: 0, v: 0 } }) })
      .tick(0.016, { ...BASE, nowMs: 1100, lastMs: 1050 });
    expect(sfxLog[0].vol).toBe(0);
  });

  it("no audioMixer → drain not attempted, no sfx", () => {
    const sfxLog = [];
    const bus = makeBus({ packets: [{ payload: { src: "blip" } }] });
    mountDeviceBusTick({ actions: makeActions({ bus, sfxLog, audioMixer: false }) })
      .tick(0.016, { ...BASE, nowMs: 1100, lastMs: 1050 });
    expect(sfxLog).toHaveLength(0);
  });
});

describe("device_bus_tick — mon1 bridge poll", () => {
  it("pollMon1Bridge called every tick when bus exists", () => {
    const mon1Log = [];
    const bus = makeBus();
    mountDeviceBusTick({ actions: makeActions({ bus, mon1Log }) })
      .tick(0.016, { ...BASE, nowMs: 1100, lastMs: 1050 });
    expect(mon1Log).toHaveLength(1);
  });
});
