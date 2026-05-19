LOOP_PROMPT.md — iter 666+, big-block extraction phase

You are the same agent. Iter 665 just shipped. index.html is at 4086 lines.
The rate has decayed: last three iters extracted 3, 6, 11 lines respectively.
That's not extraction anymore — that's nibbling. This prompt corrects course.

═══════════════════════════════════════════════════════════════════════
THE HONEST DIAGNOSIS
═══════════════════════════════════════════════════════════════════════

You have been avoiding the big blocks. The "shrink every tick" rule
combined with the 20-minute cadence has trained you to take the
smallest safe extraction available. That worked for iters 540-650.
It does not work now.

What is left in index.html, in priority order:

  Lines  Range          Target                              Status
  ───────────────────────────────────────────────────────────────────
  519    3097-3615      src/entities/enemy_ai_tick.js       UNTOUCHED *
  283    2801-3083      src/systems/bullet_physics.js       UNTOUCHED *
  120    2079-2199      src/config/keydown_bindings.js      UNTOUCHED
  59     3783-3841      src/systems/save_wiring.js          UNTOUCHED
  50     1700-1750      src/systems/screen_interaction.js   UNTOUCHED

  * = the EXTRACT-PLAN inside index.html named these years ago and
      they were never tackled. They are tackled now.

Everything else in index.html is one of:
  - Mount calls (`const _x = mountX({get, set, actions})`) -- these
    do not extract; they collapse under a registry pattern, which is
    abstraction work, not your job right now.
  - HTML head, script tags, import map -- these stay.
  - The tick function shell -- this stays.
  - The big destructured import statement -- this stays until
    abstraction.

Floor for extraction-only work: ~3200 lines. You can get there.
Below that, abstraction takes over. That decision is not yours to
make -- the human will make it when the named targets above are done.

═══════════════════════════════════════════════════════════════════════
NEW SUCCESS CRITERION
═══════════════════════════════════════════════════════════════════════

Per-tick rule: each tick must either

  (a) Extract a sub-block of one of the FIVE NAMED TARGETS above, OR
  (b) Be the final wire-up commit for a target whose pieces are done,
      removing the now-empty placeholder from index.html, OR
  (c) Convert a BUG_LOG entry to a regression test + fix.

Small nibbles (extracting computeXxx pure functions of <15 lines from
already-extracted code) DO NOT COUNT. They are not bad, but they do
not satisfy the per-tick rule. Save them for cleanup phase.

A tick that cannot satisfy (a), (b), or (c) WRITES A NOTE to
docs/STUCK.md naming what it tried and why it failed, then exits
without committing. Do NOT manufacture small extractions to keep the
streak alive. The streak is the failure mode, not the goal.

═══════════════════════════════════════════════════════════════════════
HOW TO TACKLE A BIG BLOCK (the enemy AI loop, worked example)
═══════════════════════════════════════════════════════════════════════

The enemy AI loop (~519 lines) is the biggest target.
It is NOT one extraction -- it is ~12 extractions, done in sequence,
each one a self-contained per-type behavior sub-block. The wrapper
loop (`for (const en of enemies) { ... }`) stays in index.html until
the very last extraction, when it collapses to a single tick call.

Recommended sub-extraction order, from smallest/safest to largest:

  Iter A -- Robot EMP burst (~20 lines)
           -> src/systems/enemy_robot_emp_tick.js
  Iter B -- Heavy grenade throw (~22 lines)
           -> src/systems/enemy_heavy_grenade_tick.js
  Iter C -- Boss rock throw (~23 lines)
           -> src/systems/enemy_boss_rock_tick.js
  Iter D -- Poisoner acid spit (~23 lines)
           -> src/systems/enemy_poisoner_spit_tick.js
  Iter E -- Incendiary bomb (~23 lines)
           -> src/systems/enemy_incendiary_tick.js
  Iter F -- Boss ground slam (~30 lines)
           -> src/systems/enemy_boss_slam_tick.js
  Iter G -- Poisoner ranged spit (~16 lines)
           -> src/systems/enemy_poisoner_dart_tick.js
  Iter H -- Fast enemy charge (~19 lines)
           -> src/systems/enemy_fast_charge_tick.js
  Iter I -- Sniper aim+fire (~70 lines -- largest sub-block)
           -> src/systems/enemy_sniper_tick.js
  Iter J -- Strafe + melee (~70 lines)
           -> src/systems/enemy_melee_tick.js
  Iter K -- Robot plasma (~22 lines)
           -> src/systems/enemy_robot_plasma_tick.js
  Iter L -- Gunshot alert + panic + enrage + heard-shot + BT setup
           (the loop scaffolding, ~150 lines)
           -> src/systems/enemy_ai_scaffold_tick.js

After Iter L, the entire enemy loop body has been extracted and the
wrapper collapses to roughly:

  for (const en of enemies) {
    if (gameMode === "peaceful") continue;
    _enemyAiScaffold.tick(dt, en, /* shared state */);
    _enemyMeshTick.tickEntry(en, ...);
  }

Each iter saves ~20-30 lines. Total: ~450 lines saved across 12 ticks.
That is a real pace. Do not try to do the whole loop in one tick.

NOTE: Line numbers drift as extractions happen. Use grep to find the
actual current location of distinctive comments like
"Robot EMP burst" or "Boss rock throw".

═══════════════════════════════════════════════════════════════════════
TEST DISCIPLINE — MANDATORY, NO EXCEPTIONS
═══════════════════════════════════════════════════════════════════════

EVERY tick that touches code MUST add new tests. No extraction ships
without at least a smoke test + one behavioral test. This is not
optional even for "obvious" moves — if the code moved, prove it works.

For each big-block sub-extraction, write ALL THREE:

  1. SMOKE TEST -- import the new module, call its tick function
     with minimal real-shaped fake deps. Must not throw.

       it("does not throw with minimal deps", () => {
         const sys = mountEnemyRobotEmpTick({ actions: makeActions() });
         expect(() => sys.tick(0.016, makeEnemy(), makeCtx())).not.toThrow();
       });

  2. BEHAVIORAL TEST -- for any sub-block with an observable side
     effect (spawn bullet, deal damage, set cooldown, mutate state),
     assert that the effect happens under the right conditions AND
     does NOT happen under the wrong conditions. Both directions.

       it("EMP within 4m sets cooldown + fires sprint block", () => {
         const sprintBlock = vi.fn();
         const sys = mountEnemyRobotEmpTick({ actions: makeActions({ sprintBlock }) });
         sys.tick(0.016, makeEnemy({ _empT: 0 }), { heroU: 0, heroV: 0, nowSec: 10 });
         expect(sprintBlock).toHaveBeenCalled();
       });

       it("EMP beyond 4m does not fire", () => {
         const sprintBlock = vi.fn();
         const sys = mountEnemyRobotEmpTick({ actions: makeActions({ sprintBlock }) });
         sys.tick(0.016, makeEnemy({ _empT: 0 }), { heroU: 10, heroV: 10, nowSec: 10 });
         expect(sprintBlock).not.toHaveBeenCalled();
       });

  3. MAGIC NUMBER TEST -- for every numeric literal in the extracted
     code (ranges, cooldowns, damage multipliers, thresholds), write
     at least one test that directly exercises that boundary. Examples:

       it("EMP range threshold is exactly 4m", () => { ... });
       it("EMP cooldown is set to 8.0s", () => { ... });
       it("boss rock damage is 18", () => { ... });

     Magic numbers that are NOT tested are a silent regression risk.
     If a future refactor changes 4.0 to 4.5, only the test catches it.

  4. NO toContain TESTS as primary validation. Allowed only as
     supplementary string-match documentation.

MINIMUM TEST COUNT per extraction:
  - Small sub-block (<25 lines): at least 4 tests
  - Medium sub-block (25-50 lines): at least 6 tests
  - Large sub-block (>50 lines): at least 10 tests

If you cannot write behavioral tests because the sub-block has too
many entangled side effects, that is a signal to split it smaller,
not to skip tests.

═══════════════════════════════════════════════════════════════════════
PER-TICK WORKFLOW
═══════════════════════════════════════════════════════════════════════

  1. Read this file (docs/LOOP_PROMPT.md).
  2. Check docs/HALT -- if present, exit.
  3. Read docs/BUG_LOG.md -- if any "open" entry, that is the tick.
  4. Read docs/STATE.md -- what was the last sub-extraction done?
     Which sub-block in the recommended sequence is next?
  5. Identify the target sub-block in index.html using grep.
  6. Read the sub-block. List every dependency:
     - what state does it read? (heroPos, en.hp, now/1000)
     - what state does it mutate? (en._empT, hero.sprintBlocked)
     - what actions does it invoke? (spawnParticles, playSfx)
  7. Write the new module with mount({get, set, actions}) signature.
  8. Write the tests (smoke + behavioral).
  9. Run npm test -- confirm new tests pass.
  10. Replace the sub-block in index.html with the tick call.
  11. Run npm test -- confirm all tests still pass.
  12. wc -l index.html -- confirm shrink (>=20 lines).
  13. Commit. Format: `iter N: extract <subblock> from enemy AI loop`
  14. Push.
  15. Update docs/STATE.md with current progress.
  16. Append to docs/JOURNAL.md: what was done, lines saved, surprises.

═══════════════════════════════════════════════════════════════════════
HARD RULES
═══════════════════════════════════════════════════════════════════════

1. index.html must shrink by >=20 lines per tick (except BUG_LOG fix
   ticks). If you cannot find a >=20-line extraction, write to
   docs/STUCK.md and exit. DO NOT manufacture a small extraction.

2. Big-block extractions are tackled in the recommended sub-order.
   Skip a sub-block only with a documented reason in JOURNAL.md.

3. The wrapper loop of any big block stays in index.html until ALL
   of its sub-blocks are extracted.

4. Every commit includes the mandatory tests from TEST DISCIPLINE:
   smoke + behavioral (both directions) + magic number boundary tests.
   Minimum counts: 4 tests for small blocks, 6 for medium, 10 for large.
   toContain tests do not count toward these minimums.

5. If `npm test` fails after your changes, revert. Do not push
   broken tests.

6. Maximum 6 files touched per tick.
   (new module + tests + index.html + engine_modules.js + STATE.md
   + JOURNAL.md = 6.)

7. Do not refactor existing extracted modules.

8. PRESERVE ALL MAGIC NUMBERS EXACTLY. This is absolute.
   When moving code into a new module, every numeric literal moves
   with it unchanged: 4.0 stays 4.0, 8.0 stays 8.0, 0.55 stays 0.55.
   Do not round, do not "clean up", do not extract into a named const
   (that is abstraction, not your job). The only acceptable change to
   a number is adding a test that pins it.

   HOW TO VERIFY: after writing the new module, diff the numbers in
   your new file against the original index.html lines. If any number
   differs by even one digit, that is a bug. Fix it before committing.

   WHY: these numbers are the game's tuning. They were chosen by play-
   testing, not derivation. Changing 4.0 to 4 (integer) changes
   nothing in JS but sets a precedent that leads to 3.5 to "simplify".
   The numbers are sacred. The tests are their record.

9. The game must remain playable after every tick.

10. HALT FILE at docs/HALT -- if present, exit immediately.

11. STUCK FILE at docs/STUCK.md -- if you cannot satisfy the per-tick
    rule, write a stuck entry and exit:

      ## YYYY-MM-DD HH:MM -- iter N stuck
      Attempted: <sub-block name>
      Why blocked: <one-sentence reason>
      What I'd need to proceed: <what the human should do>

    After 3 consecutive STUCK exits, stop scheduling further ticks.

12. STOP CONDITIONS:
    - index.html < 3200 lines AND no items left in FIVE NAMED TARGETS
      -> write docs/HANDOFF.md, exit.
    - docs/HALT exists.
    - docs/STUCK.md has >=3 entries from consecutive ticks.

═══════════════════════════════════════════════════════════════════════
THE HANDOFF (when extraction is genuinely done)
═══════════════════════════════════════════════════════════════════════

When you reach a stop condition, write docs/HANDOFF.md with:

  - Final index.html line count
  - List of every module extracted in this phase
  - Names of any blocks you could not extract and why
  - Recommendation for next phase

═══════════════════════════════════════════════════════════════════════
THE THESIS
═══════════════════════════════════════════════════════════════════════

You did not lose your edge. You hit the boundary where the easy
extractions ran out and the hard ones were sitting there. This prompt
moves you onto the hard ones. They are bigger per iter, riskier per
iter, and worth ~50x the line count of what you have been doing.

Extraction is the first step of abstraction. You are still on the
first step. Finish it.

Begin.
