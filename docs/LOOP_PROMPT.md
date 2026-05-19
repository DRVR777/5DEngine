# LOOP_PROMPT.md — extraction + real-tests

Read this prompt fully before any action. Re-read it at the top of every tick.

## THE PRIMARY DIRECTIVE

Extraction is the first step of abstraction. Reduce index.html toward zero by
moving discrete responsibilities into /src/ files. The smaller index.html gets,
the more visible the abstraction patterns become. Keep going.

Target: index.html below 1000 lines. Currently ~5833. The work remaining is
large but mechanical. Do not stop. Do not philosophize. Extract.

## TEST DISCIPLINE — THIS IS THE THING THAT HAS BEEN FAILING

2291+ tests passing. Bugs still surface during play. The gap is not a coverage
problem. It is a test-shape problem. Most existing tests check "does the file
contain this string." Real bugs crash at runtime.

NEW RULE — every extraction commit must include AT LEAST ONE of:

  (a) A smoke test that actually imports the new module and calls one
      of its exported functions with realistic arguments. The test must
      execute the function, not grep the source.

  (b) An integration test that mounts the new module alongside its
      real dependencies (or minimal mocks) and ticks at least 5 frames,
      asserting no error fires on the console error channel.

  (c) A state-invariant test that runs the new module through a fuzz
      of inputs (10+ random scenarios) and asserts properties hold:
      no NaN positions, no negative health, no null derefs, no
      undefined component reads, no quiet console.error.

  (d) A regression test for a bug listed in /docs/BUG_LOG.md.
      If BUG_LOG is non-empty, this case takes priority until empty.

`toContain` tests are still allowed but DO NOT COUNT toward the per-extraction
test requirement. They are documentation. You may write them in addition to a
real test; you may not write them instead of a real test.

## THE BUG LOG — /docs/BUG_LOG.md

On every tick:
  1. Read /docs/BUG_LOG.md
  2. For every entry with status "open":
     - Write the regression test FIRST, before any other work
     - Run it; confirm it fails on the current code
     - Fix the bug
     - Confirm the test now passes
     - Update the entry status to "fixed"
     - Commit as "iter N: regression test for <description>"

Only after BUG_LOG has zero "open" entries proceed with extraction.

## WHAT A REAL TEST LOOKS LIKE

--- Smoke test (catches TDZ, ReferenceError, syntax errors) ---

  import { mountBarrelSystem } from "../../src/systems/barrel_system.js";
  import * as THREE from "three";
  it("mountBarrelSystem instantiates without throwing", () => {
    const scene = new THREE.Scene();
    const sys = mountBarrelSystem({
      THREE, scene, enemies: [], world: { players: new Map() },
      coinByType: {}, weaponDropMap: {},
      get: { heroDead: () => false, heroHp: () => 100, ... },
      set: { heroHp: () => {}, ... },
      actions: { playSfx: () => {}, spawnParticles: () => {}, ... },
    });
    expect(sys.makeBarrel).toBeTypeOf("function");
    expect(Array.isArray(sys.barrels)).toBe(true);
  });

--- Error-channel test (catches the entire crash class) ---

  it("five frames of tick produce no console errors", async () => {
    const errors = [];
    const orig = console.error;
    console.error = (...a) => { errors.push(a.join(" ")); };
    try {
      const game = await bootMinimalGame();
      for (let i = 0; i < 5; i++) game.tick(1/60);
      expect(errors).toEqual([]);
    } finally { console.error = orig; }
  });

--- State-invariant fuzz ---

  it("hero never NaN or negative HP across 100 random damage events", () => {
    const hero = bootHero();
    for (let i = 0; i < 100; i++) {
      applyDamageToHero(hero, Math.floor(Math.random() * 50));
      expect(Number.isFinite(hero.hp)).toBe(true);
      expect(hero.hp).toBeGreaterThanOrEqual(0);
    }
  });

## PER-TICK WORKFLOW

  1. Read this prompt.
  2. Read /docs/BUG_LOG.md. If any "open" entry exists, write its regression
     test first. Only then proceed to extraction.
  3. Pick the smallest logically-coherent block remaining in index.html.
  4. Do the work:
     - Read target code
     - Write the new module file
     - Write at least one REAL test (smoke/behavioral/invariant/error-channel)
     - Wire the call into index.html
     - Run `npm test` — must be green
     - Confirm index.html is smaller
  5. Commit: `iter N: <action>` (single concern)
  6. Push.
  7. Schedule next tick.

## HARD RULES

1. index.html must shrink every tick.
2. Every commit includes AT LEAST one real test. toContain tests do not count.
3. BUG_LOG.md takes priority over extraction.
4. Never delete an existing test in the same tick you add a new one.
5. If `npm test` fails, revert and pick a different target.
6. Maximum 5 files touched per tick.
7. Do not refactor code outside the file being extracted.
8. Do not optimize or tune numbers — you move code, not behavior.
9. Check for /docs/HALT at start of every tick. If it exists, exit cleanly.
10. Stop when index.html < 1000 lines — then switch to abstraction.

## NOTE TO THE HUMAN — how to add bugs

When you encounter a bug during play:
  1. Open /docs/BUG_LOG.md
  2. Append: ## YYYY-MM-DD HH:MM — short description
  3. Fill in: Symptom / Root cause (if known) / Why tests missed it
  4. Set Status: open
  The loop picks it up on its next tick automatically.
