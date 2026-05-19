import { it, expect, describe } from "vitest";
import { mountComboAnnouncer } from "../../src/systems/combo_announcer.js";

const DECAY = 4.0;

function makeCombo({ comboCount = 0, comboLastT = 0, comboAnnouncedMul = 0 } = {}) {
  const s = { comboCount, comboLastT, comboAnnouncedMul };
  const toastLog = [], sfxLog = [];
  const get = {
    comboCount:       () => s.comboCount,
    comboLastT:       () => s.comboLastT,
    comboAnnouncedMul:() => s.comboAnnouncedMul,
  };
  const set = {
    comboCount:       v => { s.comboCount = v; },
    comboAnnouncedMul:v => { s.comboAnnouncedMul = v; },
  };
  const actions = {
    showToast: (msg, type) => toastLog.push({ msg, type }),
    playSfx:   (t, v)     => sfxLog.push(t),
  };
  const { tick } = mountComboAnnouncer({ DECAY, get, set, actions });
  return { s, toastLog, sfxLog, tick };
}

describe("combo decay", () => {
  it("resets comboCount and announcedMul when gap > DECAY", () => {
    const { s, tick } = makeCombo({ comboCount: 3, comboLastT: 0, comboAnnouncedMul: 2 });
    tick(5.0); // gap = 5 > 4
    expect(s.comboCount).toBe(0);
    expect(s.comboAnnouncedMul).toBe(0);
  });

  it("does NOT reset when gap <= DECAY", () => {
    const { s, tick } = makeCombo({ comboCount: 3, comboLastT: 0 });
    tick(3.0); // gap = 3 < 4
    expect(s.comboCount).toBe(3);
  });

  it("does NOT reset when comboCount is 0", () => {
    const { s, tick } = makeCombo({ comboCount: 0, comboLastT: 0 });
    tick(100.0); // would trigger if count > 0
    expect(s.comboAnnouncedMul).toBe(0); // no reset attempted
  });
});

describe("milestone announcements", () => {
  it("fires DOUBLE KILL toast at comboCount === 2", () => {
    const { toastLog, tick } = makeCombo({ comboCount: 2, comboLastT: 0 });
    tick(1.0);
    expect(toastLog.some(t => t.msg.includes("DOUBLE KILL!"))).toBe(true);
  });

  it("fires QUAD KILL at comboCount === 4", () => {
    const { toastLog, tick } = makeCombo({ comboCount: 4, comboLastT: 0, comboAnnouncedMul: 2 });
    tick(1.0);
    expect(toastLog.some(t => t.msg.includes("QUAD KILL!"))).toBe(true);
  });

  it("fires RAMPAGE at comboCount === 6", () => {
    const { toastLog, tick } = makeCombo({ comboCount: 6, comboLastT: 0, comboAnnouncedMul: 4 });
    tick(1.0);
    expect(toastLog.some(t => t.msg.includes("RAMPAGE!"))).toBe(true);
  });

  it("fires GODLIKE at comboCount >= 8", () => {
    const { toastLog, tick } = makeCombo({ comboCount: 8, comboLastT: 0, comboAnnouncedMul: 6 });
    tick(1.0);
    expect(toastLog.some(t => t.msg.includes("GODLIKE!"))).toBe(true);
  });

  it("does not fire below 2 kills", () => {
    const { toastLog, sfxLog, tick } = makeCombo({ comboCount: 1, comboLastT: 0 });
    tick(1.0);
    expect(toastLog).toHaveLength(0);
    expect(sfxLog).toHaveLength(0);
  });

  it("does not re-announce an already-announced milestone", () => {
    const { toastLog, tick } = makeCombo({ comboCount: 2, comboLastT: 0, comboAnnouncedMul: 2 });
    tick(1.0);
    expect(toastLog).toHaveLength(0);
  });

  it("announces only the lowest not-yet-announced milestone on each tick", () => {
    // jump straight from 0 to 6 kills — should announce x2 first (lowest unannounced)
    const { s, toastLog, tick } = makeCombo({ comboCount: 6, comboLastT: 0, comboAnnouncedMul: 0 });
    tick(1.0);
    expect(toastLog).toHaveLength(1);
    expect(toastLog[0].msg).toContain("DOUBLE KILL!"); // x2 is lowest unannounced
    expect(s.comboAnnouncedMul).toBe(2);
  });

  it("plays two sfx tones per milestone", () => {
    const { sfxLog, tick } = makeCombo({ comboCount: 2, comboLastT: 0 });
    tick(1.0);
    expect(sfxLog).toHaveLength(2);
    expect(sfxLog[0]).toMatch(/^tone:660:/);
    expect(sfxLog[1]).toMatch(/^tone:990:/); // 660 * 1.5 = 990
  });
});
