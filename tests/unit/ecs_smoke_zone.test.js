import { describe, it, expect, beforeEach } from "vitest";
import {
  createSmokeZoneSystem,
  SMOKE_RADIUS, SMOKE_DURATION,
} from "../../src/systems/ecs_smoke_zone.js";
import Core from "../../src/core/core.js";

// ── Constants parity ──────────────────────────────────────────────────────────
describe("smoke zone constants — monolith line 2129 parity", () => {
  it("SMOKE_RADIUS = 3.5   (line 2129: radius: 3.5)",   () => expect(SMOKE_RADIUS).toBe(3.5));
  it("SMOKE_DURATION = 6.0 (line 2129: timeLeft: 6.0)", () => expect(SMOKE_DURATION).toBe(6.0));
});

// ── Zone creation ─────────────────────────────────────────────────────────────
describe("createSmokeZoneSystem — zone creation on grenade:smoke_explode", () => {
  beforeEach(() => Core._reset());

  it("adds a zone on grenade:smoke_explode", () => {
    const sys = createSmokeZoneSystem();
    sys.wireListeners(Core);

    Core.emit("grenade:smoke_explode", { u: 5, v: 3 });

    expect(sys.getZones().length).toBe(1);
    expect(sys.getZones()[0].u).toBe(5);
    expect(sys.getZones()[0].v).toBe(3);
  });

  it("emits smoke:zone_added with u, v, radius, duration", () => {
    const sys = createSmokeZoneSystem();
    sys.wireListeners(Core);

    const events = [];
    Core.on("smoke:zone_added", e => events.push(e));
    Core.emit("grenade:smoke_explode", { u: 2, v: -1 });

    expect(events.length).toBe(1);
    expect(events[0].u).toBe(2);
    expect(events[0].v).toBe(-1);
    expect(events[0].radius).toBe(SMOKE_RADIUS);
    expect(events[0].duration).toBe(SMOKE_DURATION);
  });

  it("multiple smoke grenades create multiple zones", () => {
    const sys = createSmokeZoneSystem();
    sys.wireListeners(Core);

    Core.emit("grenade:smoke_explode", { u: 0, v: 0 });
    Core.emit("grenade:smoke_explode", { u: 10, v: 10 });

    expect(sys.getZones().length).toBe(2);
  });
});

// ── isSmoked ──────────────────────────────────────────────────────────────────
describe("createSmokeZoneSystem — isSmoked()", () => {
  beforeEach(() => Core._reset());

  it("returns false when no zones exist", () => {
    const sys = createSmokeZoneSystem();
    expect(sys.isSmoked(0, 0, 5, 5)).toBe(false);
  });

  it("returns true when enemy position is inside smoke", () => {
    const sys = createSmokeZoneSystem();
    sys.wireListeners(Core);

    Core.emit("grenade:smoke_explode", { u: 0, v: 0 });
    // enemy at (1, 0) — within SMOKE_RADIUS=3.5
    expect(sys.isSmoked(1, 0, 20, 20)).toBe(true);
  });

  it("returns true when hero position is inside smoke", () => {
    const sys = createSmokeZoneSystem();
    sys.wireListeners(Core);

    Core.emit("grenade:smoke_explode", { u: 0, v: 0 });
    // hero at (1, 0), enemy far away
    expect(sys.isSmoked(20, 20, 1, 0)).toBe(true);
  });

  it("returns false when both positions are outside all zones", () => {
    const sys = createSmokeZoneSystem();
    sys.wireListeners(Core);

    Core.emit("grenade:smoke_explode", { u: 0, v: 0 });
    // both outside 3.5m radius
    expect(sys.isSmoked(10, 10, 20, 20)).toBe(false);
  });

  it("returns true when either of two zones covers a position", () => {
    const sys = createSmokeZoneSystem();
    sys.wireListeners(Core);

    Core.emit("grenade:smoke_explode", { u: 0, v: 0 });
    Core.emit("grenade:smoke_explode", { u: 15, v: 0 });
    // enemy at (14, 0) — within second zone
    expect(sys.isSmoked(14, 0, 50, 50)).toBe(true);
  });
});

// ── Expiry ────────────────────────────────────────────────────────────────────
describe("createSmokeZoneSystem — zone expiry", () => {
  beforeEach(() => Core._reset());

  it("decrements timeLeft each tick", () => {
    const sys = createSmokeZoneSystem();
    sys.wireListeners(Core);

    Core.emit("grenade:smoke_explode", { u: 0, v: 0 });
    sys(1.0, Core);

    expect(sys.getZones()[0].timeLeft).toBeCloseTo(5.0, 5);
  });

  it("removes zone after SMOKE_DURATION ticks", () => {
    const sys = createSmokeZoneSystem();
    sys.wireListeners(Core);

    Core.emit("grenade:smoke_explode", { u: 0, v: 0 });
    sys(SMOKE_DURATION + 0.01, Core);

    expect(sys.getZones().length).toBe(0);
  });

  it("emits smoke:zone_expired when zone is removed", () => {
    const sys = createSmokeZoneSystem();
    sys.wireListeners(Core);

    const events = [];
    Core.on("smoke:zone_expired", e => events.push(e));
    Core.emit("grenade:smoke_explode", { u: 3, v: -2 });
    sys(SMOKE_DURATION + 0.01, Core);

    expect(events.length).toBe(1);
    expect(events[0].u).toBe(3);
    expect(events[0].v).toBe(-2);
  });

  it("isSmoked returns false after zone expires", () => {
    const sys = createSmokeZoneSystem();
    sys.wireListeners(Core);

    Core.emit("grenade:smoke_explode", { u: 0, v: 0 });
    sys(SMOKE_DURATION + 0.01, Core);

    expect(sys.isSmoked(1, 0, 20, 20)).toBe(false);
  });

  it("does not crash with no zones", () => {
    const sys = createSmokeZoneSystem();
    expect(() => sys(1 / 60, Core)).not.toThrow();
  });
});
