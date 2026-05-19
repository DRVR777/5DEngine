import { it, expect, describe } from "vitest";
import { mountCrosshairTick } from "../../src/systems/crosshair_tick.js";

function makeEl() {
  return { style: { display: "", visibility: "", width: "", height: "", opacity: "", borderColor: "", boxShadow: "" } };
}

function makeTick() {
  const { tick } = mountCrosshairTick();
  return tick;
}

const BASE_CTX = { isSniperScope: false, aiming: false, moveSpread: 0, heroDead: false, heroApexMode: false };

describe("crosshair_tick — scope overlay", () => {
  it("hides scope overlay when not scoped", () => {
    const scope = makeEl();
    makeTick()(scope, null, { ...BASE_CTX, isSniperScope: false });
    expect(scope.style.display).toBe("none");
  });

  it("shows scope overlay when scoped", () => {
    const scope = makeEl();
    makeTick()(scope, null, { ...BASE_CTX, isSniperScope: true });
    expect(scope.style.display).toBe("block");
  });

  it("is null-safe when scopeEl is null", () => {
    expect(() => makeTick()(null, null, BASE_CTX)).not.toThrow();
  });
});

describe("crosshair_tick — crosshair visibility", () => {
  it("shows crosshair when not scoped", () => {
    const ch = makeEl();
    makeTick()(null, ch, { ...BASE_CTX, isSniperScope: false });
    expect(ch.style.visibility).toBe("visible");
  });

  it("hides crosshair when scoped", () => {
    const ch = makeEl();
    makeTick()(null, ch, { ...BASE_CTX, isSniperScope: true });
    expect(ch.style.visibility).toBe("hidden");
  });

  it("is null-safe when crosshairEl is null", () => {
    expect(() => makeTick()(null, null, { ...BASE_CTX })).not.toThrow();
  });
});

describe("crosshair_tick — bloom size", () => {
  it("base size is 16px when not aiming and moveSpread=0", () => {
    const ch = makeEl();
    makeTick()(null, ch, { ...BASE_CTX, aiming: false, moveSpread: 0 });
    expect(ch.style.width).toBe("16.0px");
    expect(ch.style.height).toBe("16.0px");
  });

  it("base size is 10px when aiming and moveSpread=0", () => {
    const ch = makeEl();
    makeTick()(null, ch, { ...BASE_CTX, aiming: true, moveSpread: 0 });
    expect(ch.style.width).toBe("10.0px");
  });

  it("adds moveSpread * 26 to base size", () => {
    const ch = makeEl();
    makeTick()(null, ch, { ...BASE_CTX, aiming: false, moveSpread: 1 });
    expect(ch.style.width).toBe("42.0px"); // 16 + 26
  });

  it("fuzz: bloom is always >= base size", () => {
    for (let i = 0; i < 20; i++) {
      const ch = makeEl();
      const spread = Math.random() * 2;
      const aiming = Math.random() > 0.5;
      makeTick()(null, ch, { ...BASE_CTX, aiming, moveSpread: spread });
      const px = parseFloat(ch.style.width);
      expect(px).toBeGreaterThanOrEqual(aiming ? 10 : 16);
    }
  });
});

describe("crosshair_tick — opacity", () => {
  it("opacity is 1 when alive", () => {
    const ch = makeEl();
    makeTick()(null, ch, { ...BASE_CTX, heroDead: false });
    expect(ch.style.opacity).toBe("1");
  });

  it("opacity is 0 when dead", () => {
    const ch = makeEl();
    makeTick()(null, ch, { ...BASE_CTX, heroDead: true });
    expect(ch.style.opacity).toBe("0");
  });
});

describe("crosshair_tick — apex mode colors", () => {
  it("uses base colors when not apex mode", () => {
    const ch = makeEl();
    makeTick()(null, ch, { ...BASE_CTX, heroApexMode: false });
    expect(ch.style.borderColor).toBe("rgba(0,200,255,0.7)");
    expect(ch.style.boxShadow).toBe("0 0 6px rgba(0,200,255,0.4)");
  });

  it("uses gold colors in apex mode", () => {
    const ch = makeEl();
    makeTick()(null, ch, { ...BASE_CTX, heroApexMode: true });
    expect(ch.style.borderColor).toBe("rgba(255,210,0,0.85)");
    expect(ch.style.boxShadow).toBe("0 0 8px rgba(255,200,0,0.5)");
  });
});
