import { describe, it, expect, beforeEach } from "vitest";
import {
  createComboSystem,
  COMBO_DECAY, COMBO_MAX_MUL, COMBO_MILESTONES, COMBO_MILESTONE_LABELS,
} from "../../src/systems/ecs_combo.js";
import Core from "../../src/core/core.js";

// ── Constants parity ──────────────────────────────────────────────────────────
describe("combo constants — monolith lines 1264-1266 parity", () => {
  it("COMBO_DECAY = 3.5s (line 1266)",  () => expect(COMBO_DECAY).toBe(3.5));
  it("COMBO_MAX_MUL = 8 (line 8836)",  () => expect(COMBO_MAX_MUL).toBe(8));
  it("COMBO_MILESTONES = [2,4,6,8]",   () => expect(COMBO_MILESTONES).toEqual([2, 4, 6, 8]));
  it("DOUBLE KILL label at x2",         () => expect(COMBO_MILESTONE_LABELS[2]).toBe("DOUBLE KILL!"));
  it("GODLIKE label at x8",             () => expect(COMBO_MILESTONE_LABELS[8]).toBe("GODLIKE!"));
});

// ── Kill counting ─────────────────────────────────────────────────────────────
describe("createComboSystem — kill counting", () => {
  beforeEach(() => Core._reset());

  it("starts with count=0 and multiplier=0", () => {
    const sys = createComboSystem();
    expect(sys.getCount()).toBe(0);
    expect(sys.getMultiplier()).toBe(0);
  });

  it("increments count on enemy:killed", () => {
    const sys = createComboSystem();
    sys.wireListeners(Core);

    Core.emit("enemy:killed", { entityId: "e1" });
    expect(sys.getCount()).toBe(1);
  });

  it("emits combo:updated with count and multiplier on each kill", () => {
    const sys = createComboSystem();
    sys.wireListeners(Core);

    const updates = [];
    Core.on("combo:updated", e => updates.push(e));
    Core.emit("enemy:killed", { entityId: "e1" });
    Core.emit("enemy:killed", { entityId: "e2" });

    expect(updates.length).toBe(2);
    expect(updates[0].count).toBe(1);
    expect(updates[0].multiplier).toBe(1);
    expect(updates[1].count).toBe(2);
    expect(updates[1].multiplier).toBe(2);
  });

  it("multiplier is capped at COMBO_MAX_MUL=8", () => {
    const sys = createComboSystem();
    sys.wireListeners(Core);

    const updates = [];
    Core.on("combo:updated", e => updates.push(e));
    for (let i = 0; i < 12; i++) Core.emit("enemy:killed", { entityId: `e${i}` });

    expect(updates[11].multiplier).toBe(8);
    expect(sys.getMultiplier()).toBe(8);
  });
});

// ── Decay ─────────────────────────────────────────────────────────────────────
describe("createComboSystem — decay", () => {
  beforeEach(() => Core._reset());

  it("does NOT reset before 3.5s of no kills", () => {
    const sys = createComboSystem();
    sys.wireListeners(Core);
    Core.emit("enemy:killed", { entityId: "e1" });

    sys(3.4, Core); // 3.4s < 3.5s decay

    expect(sys.getCount()).toBe(1);
  });

  it("resets to 0 after 3.5s of no kills", () => {
    const sys = createComboSystem();
    sys.wireListeners(Core);

    sys(0.1, Core); // elapsed = 0.1
    Core.emit("enemy:killed", { entityId: "e1" }); // kill at elapsed=0.1

    sys(3.6, Core); // elapsed = 3.7; 3.7 - 0.1 = 3.6 > 3.5 → reset

    expect(sys.getCount()).toBe(0);
  });

  it("emits combo:reset with prevCount when decaying", () => {
    const sys = createComboSystem();
    sys.wireListeners(Core);

    sys(0.1, Core);
    Core.emit("enemy:killed", { entityId: "e1" });
    Core.emit("enemy:killed", { entityId: "e2" });

    const resets = [];
    Core.on("combo:reset", e => resets.push(e));
    sys(3.6, Core); // triggers reset

    expect(resets.length).toBe(1);
    expect(resets[0].prevCount).toBe(2);
  });

  it("new kill resets the decay timer", () => {
    const sys = createComboSystem();
    sys.wireListeners(Core);

    sys(0.1, Core);
    Core.emit("enemy:killed", { entityId: "e1" });
    sys(3.0, Core); // 3.0s elapsed since kill — under decay threshold
    Core.emit("enemy:killed", { entityId: "e2" }); // reset timer
    sys(3.4, Core); // 3.4s since e2 kill — still under threshold

    expect(sys.getCount()).toBe(2);
  });
});

// ── Milestones ────────────────────────────────────────────────────────────────
describe("createComboSystem — milestones", () => {
  beforeEach(() => Core._reset());

  it("emits combo:milestone at x2 (DOUBLE KILL)", () => {
    const sys = createComboSystem();
    sys.wireListeners(Core);

    const milestones = [];
    Core.on("combo:milestone", e => milestones.push(e));
    Core.emit("enemy:killed", { entityId: "e1" });
    Core.emit("enemy:killed", { entityId: "e2" });

    expect(milestones.length).toBe(1);
    expect(milestones[0].multiplier).toBe(2);
    expect(milestones[0].label).toBe("DOUBLE KILL!");
  });

  it("emits combo:milestone at x4 (QUAD KILL)", () => {
    const sys = createComboSystem();
    sys.wireListeners(Core);

    const milestones = [];
    Core.on("combo:milestone", e => milestones.push(e));
    for (let i = 0; i < 4; i++) Core.emit("enemy:killed", { entityId: `e${i}` });

    expect(milestones.some(m => m.multiplier === 4)).toBe(true);
    expect(milestones.find(m => m.multiplier === 4).label).toBe("QUAD KILL!");
  });

  it("does NOT re-announce the same milestone within a combo", () => {
    const sys = createComboSystem();
    sys.wireListeners(Core);

    const milestones = [];
    Core.on("combo:milestone", e => milestones.push(e));
    for (let i = 0; i < 6; i++) Core.emit("enemy:killed", { entityId: `e${i}` });

    const x2Count = milestones.filter(m => m.multiplier === 2).length;
    expect(x2Count).toBe(1); // only announced once
  });

  it("re-announces milestones after reset", () => {
    const sys = createComboSystem();
    sys.wireListeners(Core);

    const milestones = [];
    Core.on("combo:milestone", e => milestones.push(e));

    // First combo — reach x2
    sys(0.1, Core);
    Core.emit("enemy:killed", { entityId: "e1" });
    Core.emit("enemy:killed", { entityId: "e2" });
    const countAfterFirst = milestones.filter(m => m.multiplier === 2).length;

    // Decay to reset
    sys(4.0, Core);

    // Second combo — should announce x2 again
    Core.emit("enemy:killed", { entityId: "e3" });
    Core.emit("enemy:killed", { entityId: "e4" });

    expect(milestones.filter(m => m.multiplier === 2).length).toBe(countAfterFirst + 1);
  });
});
