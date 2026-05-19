import { it, expect, describe } from "vitest";
import { hasLOS } from "../../src/systems/los_check.js";

function makeBlocker(u, v, w = 2, d = 2) {
  return { u, v, hitbox: { w, d } };
}

describe("hasLOS — no blockers", () => {
  it("empty blockers → always true", () => {
    expect(hasLOS(0, 0, 10, 10, [])).toBe(true);
  });
});

describe("hasLOS — boundary wall skip", () => {
  it("blocker at |u|=26 is skipped → true", () => {
    // blocker centered at u=26, squarely on the ray path
    const bl = makeBlocker(26, 0, 2, 100);
    expect(hasLOS(0, 0, 30, 0, [bl])).toBe(true);
  });

  it("blocker at |v|=26 is skipped → true", () => {
    const bl = makeBlocker(0, 26, 100, 2);
    expect(hasLOS(0, 0, 0, 30, [bl])).toBe(true);
  });

  it("blocker at |u|=25 is NOT skipped → false when in path", () => {
    const bl = makeBlocker(25, 0, 4, 4);
    expect(hasLOS(0, 0, 30, 0, [bl])).toBe(false);
  });
});

describe("hasLOS — horizontal ray", () => {
  it("ray hits blocker dead center → false", () => {
    const bl = makeBlocker(5, 0, 2, 2);
    expect(hasLOS(0, 0, 10, 0, [bl])).toBe(false);
  });

  it("ray misses blocker above → true", () => {
    const bl = makeBlocker(5, 3, 2, 2);
    expect(hasLOS(0, 0, 10, 0, [bl])).toBe(true);
  });
});

describe("hasLOS — vertical ray (parallel)", () => {
  it("vertical ray through blocker u-range → false", () => {
    const bl = makeBlocker(0, 5, 2, 2);
    expect(hasLOS(0, 0, 0, 10, [bl])).toBe(false);
  });

  it("vertical ray outside blocker u-range → true", () => {
    const bl = makeBlocker(5, 5, 2, 2);
    expect(hasLOS(0, 0, 0, 10, [bl])).toBe(true);
  });
});

describe("hasLOS — diagonal ray", () => {
  it("diagonal ray through corner blocker → false", () => {
    const bl = makeBlocker(5, 5, 2, 2);
    expect(hasLOS(0, 0, 10, 10, [bl])).toBe(false);
  });

  it("diagonal ray missing offset blocker → true", () => {
    const bl = makeBlocker(5, 9, 2, 2);
    expect(hasLOS(0, 0, 10, 10, [bl])).toBe(true);
  });
});

describe("hasLOS — tmax guard (blocker behind start)", () => {
  it("blocker behind start point (tmax <= 0.05) → true", () => {
    // ray goes from (10,0) to (20,0); blocker is at u=1 (behind start)
    const bl = makeBlocker(1, 0, 2, 4);
    expect(hasLOS(10, 0, 20, 0, [bl])).toBe(true);
  });
});

describe("hasLOS — tmin guard (blocker beyond end)", () => {
  it("blocker fully beyond endpoint (tmin >= 0.95) → true", () => {
    // ray goes from (0,0) to (5,0); blocker center at u=9 so tmin >> 0.95
    const bl = makeBlocker(9, 0, 2, 4);
    expect(hasLOS(0, 0, 5, 0, [bl])).toBe(true);
  });
});

describe("hasLOS — multiple blockers", () => {
  it("first blocker clear, second blocks → false", () => {
    const b1 = makeBlocker(2, 5, 2, 2); // off path
    const b2 = makeBlocker(5, 0, 2, 2); // in path
    expect(hasLOS(0, 0, 10, 0, [b1, b2])).toBe(false);
  });

  it("all blockers clear → true", () => {
    const b1 = makeBlocker(2, 5, 2, 2);
    const b2 = makeBlocker(7, -5, 2, 2);
    expect(hasLOS(0, 0, 10, 0, [b1, b2])).toBe(true);
  });
});
