import { it, expect, describe } from "vitest";
import { mountCombatHudTick } from "../../src/systems/combat_hud_tick.js";

function makeEl() {
  return { style: { display: "", transform: "", borderColor: "", background: "", boxShadow: "", opacity: "" }, setAttribute: () => {} };
}
function makeG() {
  const calls = [];
  return { setAttribute: (k, v) => calls.push([k, v]), calls };
}

const { tick } = mountCombatHudTick();
const BASE = { now: 1000, hitMarkerUntil: 0, killMarkerUntil: 0, killMarkerHs: false, moveSpread: 0, dmgDirAngle: 0, dmgDirUntil: 0, camYaw: 0, dmgDirG: null };

describe("combat_hud_tick — hit marker", () => {
  it("sets scale 1.0 when no hit and moveSpread=0", () => {
    const ch = makeEl();
    tick({ crosshair: ch, killMarker: null, dmgDirIndicator: null }, { ...BASE, hitMarkerUntil: 0, now: 1000 });
    expect(ch.style.transform).toBe("translate(-50%,-50%) scale(1.00)");
  });

  it("sets scale 1.5 during hit flash", () => {
    const ch = makeEl();
    tick({ crosshair: ch, killMarker: null, dmgDirIndicator: null }, { ...BASE, hitMarkerUntil: 2000, now: 1000 });
    expect(ch.style.transform).toBe("translate(-50%,-50%) scale(1.50)");
  });

  it("sets red border during hit flash", () => {
    const ch = makeEl();
    tick({ crosshair: ch, killMarker: null, dmgDirIndicator: null }, { ...BASE, hitMarkerUntil: 2000, now: 1000 });
    expect(ch.style.borderColor).toBe("var(--holo-red)");
  });

  it("sets cyan border when no hit", () => {
    const ch = makeEl();
    tick({ crosshair: ch, killMarker: null, dmgDirIndicator: null }, { ...BASE, moveSpread: 0 });
    expect(ch.style.borderColor).toBe("rgba(0,200,255,0.70)");
  });

  it("spread scale grows with moveSpread", () => {
    const ch = makeEl();
    tick({ crosshair: ch, killMarker: null, dmgDirIndicator: null }, { ...BASE, moveSpread: 1 });
    expect(ch.style.transform).toBe("translate(-50%,-50%) scale(1.60)");
  });

  it("is null-safe when crosshair is null", () => {
    expect(() => tick({ crosshair: null, killMarker: null, dmgDirIndicator: null }, BASE)).not.toThrow();
  });
});

describe("combat_hud_tick — kill marker", () => {
  it("hides kill marker when past deadline", () => {
    const km = makeEl();
    tick({ crosshair: null, killMarker: km, dmgDirIndicator: null }, { ...BASE, now: 1000, killMarkerUntil: 500 });
    expect(km.style.display).toBe("none");
  });

  it("shows kill marker within deadline", () => {
    const km = makeEl();
    tick({ crosshair: null, killMarker: km, dmgDirIndicator: null }, { ...BASE, now: 1000, killMarkerUntil: 1200 });
    expect(km.style.display).toBe("block");
  });

  it("uses gold color for headshot", () => {
    const km = makeEl();
    tick({ crosshair: null, killMarker: km, dmgDirIndicator: null }, { ...BASE, now: 1000, killMarkerUntil: 1200, killMarkerHs: true });
    expect(km.style.background).toBe("#ffd166");
  });

  it("uses red color for normal kill", () => {
    const km = makeEl();
    tick({ crosshair: null, killMarker: km, dmgDirIndicator: null }, { ...BASE, now: 1000, killMarkerUntil: 1200, killMarkerHs: false });
    expect(km.style.background).toBe("#ff2244");
  });

  it("fade is 1.0 at deadline start, 0 at deadline end", () => {
    const km1 = makeEl();
    tick({ crosshair: null, killMarker: km1, dmgDirIndicator: null }, { ...BASE, now: 900, killMarkerUntil: 1200 }); // 300ms left
    expect(parseFloat(km1.style.opacity)).toBeCloseTo(1.0, 1);

    const km2 = makeEl();
    tick({ crosshair: null, killMarker: km2, dmgDirIndicator: null }, { ...BASE, now: 1199, killMarkerUntil: 1200 }); // 1ms left
    expect(parseFloat(km2.style.opacity)).toBeCloseTo(0.003, 2);
  });
});

describe("combat_hud_tick — damage direction indicator", () => {
  it("hides indicator when past deadline", () => {
    const dd = makeEl();
    tick({ crosshair: null, killMarker: null, dmgDirIndicator: dd }, { ...BASE, now: 1000, dmgDirUntil: 500 });
    expect(dd.style.display).toBe("none");
  });

  it("shows indicator within deadline", () => {
    const dd = makeEl();
    tick({ crosshair: null, killMarker: null, dmgDirIndicator: dd }, { ...BASE, now: 1000, dmgDirUntil: 2000 });
    expect(dd.style.display).toBe("block");
  });

  it("opacity fades toward 0 as deadline approaches", () => {
    const dd = makeEl();
    tick({ crosshair: null, killMarker: null, dmgDirIndicator: dd }, { ...BASE, now: 2000, dmgDirUntil: 2000 + 1200 });
    expect(parseFloat(dd.style.opacity)).toBeCloseTo(0.85, 1); // full fade at start

    const dd2 = makeEl();
    tick({ crosshair: null, killMarker: null, dmgDirIndicator: dd2 }, { ...BASE, now: 2000 + 600, dmgDirUntil: 2000 + 1200 });
    expect(parseFloat(dd2.style.opacity)).toBeCloseTo(0.425, 1); // half fade
  });

  it("rotates dmgDirG to reflect relative angle", () => {
    const dd = makeEl();
    const g = makeG();
    tick({ crosshair: null, killMarker: null, dmgDirIndicator: dd }, { ...BASE, now: 1000, dmgDirUntil: 2000, dmgDirAngle: Math.PI / 2, camYaw: 0, dmgDirG: g });
    expect(g.calls[0][0]).toBe("transform");
    expect(g.calls[0][1]).toBe("rotate(90.0)");
  });

  it("is null-safe when dmgDirG is null", () => {
    const dd = makeEl();
    expect(() => tick({ crosshair: null, killMarker: null, dmgDirIndicator: dd }, { ...BASE, now: 1000, dmgDirUntil: 2000, dmgDirG: null })).not.toThrow();
  });
});
