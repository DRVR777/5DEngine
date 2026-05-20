LOOP_PROMPT_NEW.md - iter 690+, grouped extraction phase

You are working in 5DEngine. Continue the extraction loop, but do not use
the old five-target plan as if it is current. That phase is complete.

Current measured index.html size:

  total lines:        3321
  code lines:         2520
  comment-only lines: 553
  blank lines:        248

Measure with:

  npm run count:index

The original LOOP_PROMPT.md five named extraction targets are done:

  enemy AI loop:       DONE
  bullet physics:      DONE
  keydown handler:     DONE
  save wiring:         DONE
  screen interaction:  DONE

We are now past the original big-block phase. The next phase is grouped
behavior-preserving extraction: move large wiring/runtime blocks into modules
without changing behavior, then later collapse factories/bootstrap wiring.

========================================================================
CORE THESIS
========================================================================

Extraction is not architecture polish. It is behavior-preserving movement.

Move code. Do not redesign code.

The module may still have:

  - legacy naming
  - imperfect mount signatures
  - explicit get/set/action dependency bags
  - copied constants
  - old state assumptions

That is acceptable if all of these remain true:

  1. Behavior is preserved.
  2. Tests prove the behavior.
  3. index.html gets smaller.
  4. No constants, timings, formulas, expression order, or user-facing behavior
     changes unless the tick is explicitly a bug fix.
  5. The game remains playable.

Do not demand final ECS/registry cleanliness from extraction modules. That is
the next phase, after index.html reaches the extraction floor.

========================================================================
CURRENT EXTRACTION MAP
========================================================================

Remaining largest extractable areas:

  1. world builder setup + hotbar + creative inventory + sync
     current region: lines roughly 1273-1680
     target module:  src/builder/world_builder_wiring.js
     likely savings: 250-350 code lines

  2. builder UI refresh
     current target: function _refreshBuilderUI
     target module:  src/builder/builder_ui_refresh.js
     likely savings: 70-100 code lines

  3. in-world screens + build console
     current region: lines roughly 1778-2012
     target module:  src/devices/world_screens.js
     likely savings: 180-220 code lines

  4. device graph + mon1 screen
     current region: lines roughly 1118-1258
     target module:  src/devices/device_graph_wiring.js
     likely savings: 100-130 code lines

  5. asset loading bootstrap
     current region: lines roughly 3021-3045
     target module:  src/systems/asset_bootstrap.js
     likely savings: 20-30 code lines

  6. app + multiplayer wiring
     current region: lines roughly 3047-3126
     target module:  src/bridges/app_wiring.js and/or
                     src/social/multiplayer_wiring.js
     likely savings: 70-110 code lines

  7. global runtime error reporter
     current target: footer error handler
     target module:  src/bridges/runtime_error_reporter.js
     likely savings: small, but removes runtime diagnostics from index.html

  8. tick shell/runtime sequence
     current region: function tick()
     status: partly extractable, partly final shell
     target modules: grouped tick factories, not one giant rewrite

  9. grouped mount factories
     targets:
       wireInputSystems(...)
       wireTickSystems(...)
       wirePickupSystems(...)
       wireCombatSystems(...)
     status: extraction, not full abstraction
     likely savings: 500-800 code lines

Estimated line-count floor:

  current:                       ~2520 code lines
  more normal/group extraction:  -700 to -1000
  factory/aggregator extraction: -500 to -800

Likely extraction-only floor:    ~700-1000 code lines
Architecture/abstractify floor:  ~225-500 code lines

When index.html is mostly imports, state declarations, grouped factory calls,
tick order, and final bootstrap/footer, normal extraction stops being worth it.
At that point switch to bootGame(), Engine, system registry, service container,
and manifest-driven wiring.

========================================================================
ORDERED LOOP QUEUE
========================================================================

Do these in order unless a browser/test failure or BUG_LOG item becomes
higher priority.

  Step 0 - Clean pending extraction state
    Ensure canvas_primary_action is committed and tests pass.
    Do not start another major extraction with dirty untracked modules.

  Step 1 - Extract world builder setup
    Move builder creation, primitive buttons, inspector input wiring, named
    scene UI, hotbar, creative inventory, texture panel, group selected, and
    build sync setup into src/builder/world_builder_wiring.js.
    Keep behavior identical. Return handles needed by index.html:
      worldBuilder getter/setter or mounted value
      refreshBuilderUI callback
      hotbar hooks currently exposed on window
      mp build sync hooks

  Step 2 - Extract builder UI refresh
    Move _refreshBuilderUI into src/builder/builder_ui_refresh.js unless Step 1
    already owns it. Keep per-frame refresh behavior identical.

  Step 3 - Extract in-world screens + build console
    Move jumbotron, sky screen, build console screen, hit regions, paint
    callbacks, window._buildConsoleScreen, and window._buildConsoleMesh wiring.
    Prefer src/devices/world_screens.js because these are device/screen surfaces.

  Step 4 - Extract device graph + mon1 physical monitor
    Move deviceBus creation, device positions, wire mesh rebuild, mon1 bridge,
    and proxy device meshes into src/devices/device_graph_wiring.js.

  Step 5 - Extract asset loading bootstrap
    Move the AssetLoader timeout/load/replacePlaceholder block into
    src/systems/asset_bootstrap.js.

  Step 6 - Extract app + multiplayer wiring
    Move buildComputerApps/addDynamicIcons/mountComputerUI/createLanSession/
    mountDuelMode/position send/kill relay/mp badge wiring into bridge/social
    modules.

  Step 7 - Extract runtime error reporter
    Move global error and unhandledrejection reporter to
    src/bridges/runtime_error_reporter.js.

  Step 8 - Group mount-call factories
    Once the large inline blocks are gone, bundle remaining long mount calls
    into factory modules. This is still extraction. It does not introduce the
    final Engine registry.

  Step 9 - Handoff to abstraction
    Write docs/HANDOFF_EXTRACTION.md when index.html is mostly shell/wiring and
    further extraction only moves one-line declarations around.

========================================================================
PER-TICK WORKFLOW
========================================================================

For every tick:

  1. Read this file.
  2. Check docs/HALT. If present, exit immediately.
  3. Check git status. If dirty from a previous extraction, finish or document
     that exact state before starting a new block.
  4. Run npm run count:index and record current total/code lines.
  5. Pick the next ordered queue item.
  6. Read the exact current index.html block. Line numbers drift.
  7. List dependencies:
       - state read
       - state mutated
       - DOM read/written
       - window globals read/written
       - actions invoked
       - timers/listeners registered
  8. Search for existing modules before creating a new file.
  9. Move the block into an ES module with a mount function.
  10. Write focused unit tests:
       - smoke import/mount test
       - behavioral positive path
       - behavioral negative/blocked path
       - important numeric boundary or timing preservation test when applicable
  11. Wire index.html to the new module.
  12. Run npm test.
  13. Run npm run count:index and confirm shrink.
  14. Run npm run browser-check when the change affects browser runtime,
      pointer lock, UI, startup, tick order, combat, wave flow, or diagnostics.
      Use no-render defaults. Do not run heavy visual/soak tests unless asked.
  15. Commit one concern only.
  16. Push if the commit is intended to trigger autograde.
  17. Update docs/STATE.md and docs/JOURNAL.md when doing extraction-loop work.

========================================================================
TEST DISCIPLINE
========================================================================

Every extraction that moves code needs tests. Do not rely on "it is just
moved code".

Minimum useful tests:

  - Small extraction (<25 moved code lines): 4 tests
  - Medium extraction (25-80 moved code lines): 6 tests
  - Large extraction (>80 moved code lines): 10 tests or split smaller

Tests should validate behavior, not just strings. toContain tests may document
code shape but do not count as primary validation.

If a block is too entangled to test, split it smaller. Do not skip testing.

========================================================================
BROWSER CHECK RULE
========================================================================

Static analysis is not enough. Unit tests are not enough for browser/runtime
changes.

Available checks:

  npm test
  npm run browser-check
  npm run test:campaign:text
  npm run test:campaign:full

Default local browser rule:

  - Use npm run browser-check for browser-affecting extraction.
  - Do not run full 10-wave campaign locally unless explicitly asked, because
    previous heavy Playwright runs crashed the user's computer.
  - The pushed autograde runs the lightweight campaign in CI.

If browser-check fails, read tests/browser-artifacts/browser-check.json and fix
the runtime error before continuing extraction.

========================================================================
HARD RULES
========================================================================

1. One concern per commit.

2. index.html should shrink by at least 20 total lines per extraction tick
   unless the tick is a bug fix, cleanup checkpoint, or prompt/doc update.

3. Preserve magic numbers exactly. Do not round or "clean up" tuning values.

4. Do not introduce new root files.

5. Do not add new script tags to index.html.

6. Do not introduce new window globals unless preserving an existing public
   bridge. If a window global already exists and index.html relied on it, keep
   it compatible during extraction.

7. Do not refactor unrelated extracted modules while moving a block.

8. If npm test fails, do not push.

9. If a browser runtime check fails, fix that before the next extraction.

10. Stop extraction and write docs/HANDOFF_EXTRACTION.md when index.html is
    mostly:
      - imports
      - state declarations
      - mount/factory calls
      - tick order
      - final bootstrap/footer

========================================================================
WHAT NOT TO DO YET
========================================================================

Do not jump directly to:

  - final ECS rewrite
  - bootGame registry rewrite
  - service container migration
  - manifest-driven system loading
  - deleting legacy window bridges

Those are the abstractify phase. They come after grouped extraction reaches
its floor.

Begin with Step 0, then Step 1.
