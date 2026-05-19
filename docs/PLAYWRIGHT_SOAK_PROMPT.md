PLAYWRIGHT_SOAK_PROMPT.md — instructions for the agent

═══════════════════════════════════════════════════════════════════════
THE TARGET BUG
═══════════════════════════════════════════════════════════════════════

The game freezes after 1-2 minutes of real play. The freeze ships with
an error in the console. Existing unit tests (3340+ of them, all
passing) do not catch it because none of them actually load the game
in a browser and play it. This prompt fixes that.

The deliverable is a Playwright test suite that:

  1. Loads the game in real Chromium with WebGL.
  2. Plays the wave mode by locking onto enemies and killing them.
  3. Runs continuously for at least 3 minutes of game time.
  4. Captures the freeze when it happens, with enough state dumped
     that the cause can be diagnosed without re-running.
  5. Runs in CI mode (headless, on a schedule) and as `npm run soak`
     (headed, so the human can watch).

═══════════════════════════════════════════════════════════════════════
PHASE 1 -- EXTEND THE TEST BRIDGE (do this first, do not skip)
═══════════════════════════════════════════════════════════════════════

The existing `window._5DTest` in index.html (gated behind ?_5dtest=1)
exposes shoot(), setWeapon(), setAiming(). That is not enough to drive
gameplay from outside. Extend it. The new bridge must expose, on the
window._5DTest object:

  state() returns:
    {
      hero: { u, v, y, hp, maxHp, ammo, dead, weaponId },
      enemies: [{ id, type, u, v, hp, maxHp, dead, distance, hasLOS }],
      wave: { number, phase, aliveCount, totalEnemies, countdown },
      camera: { yaw, pitch, dist, mode },  // mode: "fp" | "tp" | "build"
      perf: { fps, frameTimeMs, lastFrameMs },
      counts: {
        particles: number,
        bullets: number,
        enemyBullets: number,
        listeners: number,   // optional but valuable
        intervals: number,   // count of active setInterval IDs
      },
    }

  lockOnNearestEnemy() returns:
    The enemy id locked onto, or null. Sets camYaw/camPitch so the
    crosshair is on the enemy. Computes the angle from hero to enemy
    and writes it directly to camYaw + camPitch.

  killEnemy(id) returns:
    boolean -- sets enemy.hp = 0 (test-only kill, bypasses bullets).
    Useful for soak tests that want to skip ahead through waves
    without grinding every shot.

  startWave(n) returns:
    boolean -- calls WaveManager.startFromWave(n) if available, so the
    soak test can jump to wave 5 without playing through 1-4.

  setGodMode(on) returns:
    boolean -- toggles Engine.debug.godMode so the test hero doesn't
    die accidentally during long runs.

  fastForward(seconds) returns:
    boolean -- runs N synchronous tick() calls to advance game time
    without waiting for real frames. The test uses this to compress
    the 90-second-per-wave countdown into milliseconds.

These additions go in the existing _5DTest block in index.html. They
are GATED behind the ?_5dtest=1 query param so production builds
never expose them. Add a smoke test in tests/unit/ confirming they
exist and return the expected shape when the bridge is active.

Read the existing _5DTest implementation in index.html before
designing the new functions. Match its conventions: every method
returns either a structured object or { ok: false, error: message }.

═══════════════════════════════════════════════════════════════════════
PHASE 2 -- INSTALL PLAYWRIGHT IF NOT ALREADY INSTALLED
═══════════════════════════════════════════════════════════════════════

Check package.json for @playwright/test. If absent:

  npm install --save-dev @playwright/test
  npx playwright install chromium

Create playwright.config.js with:
  - testDir: 'tests/playwright'
  - timeout: 300_000  (5 minutes, soak tests are long)
  - workers: 1  (do not parallelize, WebGL contexts are heavy)
  - use: {
      baseURL: 'http://localhost:8080',
      headless: process.env.HEADED ? false : true,
      viewport: { width: 1280, height: 720 },
      video: 'retain-on-failure',
      trace: 'retain-on-failure',
      launchOptions: {
        args: ['--use-gl=swiftshader', '--enable-webgl'],
      },
    }

Add to package.json scripts:
  "test:soak": "playwright test tests/playwright/soak.spec.js",
  "test:soak:headed": "HEADED=1 playwright test tests/playwright/soak.spec.js",
  "test:playwright": "playwright test"

Use playwright's webServer config to launch game_server.js automatically
so the human does not need to manually run `npm start` before the tests:

  webServer: {
    command: 'node game_server.js 8080',
    port: 8080,
    reuseExistingServer: !process.env.CI,
    timeout: 10_000,
  }

═══════════════════════════════════════════════════════════════════════
PHASE 3 -- THE TEST SHAPES
═══════════════════════════════════════════════════════════════════════

Write these files under tests/playwright/. Each file is one test
shape. Do not mix shapes within a file.

──────────────────────────────────────────────────────────────────────
tests/playwright/boot.spec.js -- does the game load at all?
──────────────────────────────────────────────────────────────────────

  Test 1: load with ?_5dtest=1, wait for window._5DTest to exist,
    confirm no console.error fired during boot. Capture the first
    console.error if any and include it in the assertion failure message.

  Test 2: load, wait for state().hero to exist, confirm hero.hp > 0,
    confirm wave.number >= 1, confirm camera.mode is set.

  Test 3: load, run for 60 frames (1 second at 60fps), confirm
    perf.fps > 20 (CI containers run slower than 60fps) and no
    console.error fired.

These three tests catch boot-time errors. They take ~5 seconds total.

──────────────────────────────────────────────────────────────────────
tests/playwright/gameplay.spec.js -- does combat work?
──────────────────────────────────────────────────────────────────────

  Test 1 -- kill one enemy by locking on and shooting:
    Wait for first enemy to spawn. Call lockOnNearestEnemy(). Get
    enemy id from the return value. Call shoot() in a loop with 100ms
    gaps until enemy.dead is true or 30 seconds pass. Assert the enemy
    died before the timeout.

  Test 2 -- complete wave 1 by killing all enemies:
    For each alive enemy, lockOnNearestEnemy + shoot until dead.
    Confirm wave.aliveCount reaches 0. Confirm wave.phase advances
    from "spawning" to the next phase.

  Test 3 -- survive wave 2 with god mode on:
    setGodMode(true). startWave(2). Lock+shoot loop. Run until
    wave 3 starts or 90 seconds pass. Assert wave 3 was reached.

──────────────────────────────────────────────────────────────────────
tests/playwright/soak.spec.js -- the freeze-catcher (THE BIG ONE)
──────────────────────────────────────────────────────────────────────

This test plays the game for 3+ minutes and catches the freeze.

  test("3-minute survival run with leak detection", async ({ page }) => {
    const errors = [];
    const frameTimeSpikes = [];
    const stateSamples = [];   // snapshot every 5 seconds

    page.on("console", msg => {
      if (msg.type() === "error") {
        errors.push({ t: Date.now(), text: msg.text() });
      }
    });
    page.on("pageerror", err => {
      errors.push({ t: Date.now(), text: err.message, stack: err.stack });
    });

    await page.goto("/?_5dtest=1");
    await page.waitForFunction(() => window._5DTest && window._5DTest.state);

    await page.evaluate(() => window._5DTest.setGodMode(true));

    const startMs = Date.now();
    const DURATION_MS = 180_000;  // 3 minutes
    const POLL_MS = 250;
    let lockedId = null;

    while (Date.now() - startMs < DURATION_MS) {
      const s = await page.evaluate(() => window._5DTest.state());

      // Detect freeze: frameTimeMs > 1000 means the game stalled
      if (s.perf.frameTimeMs > 1000) {
        frameTimeSpikes.push({
          elapsedMs: Date.now() - startMs,
          frameTimeMs: s.perf.frameTimeMs,
          state: s,
        });
      }

      // Sample state every 5s for leak detection
      const lastSample = stateSamples[stateSamples.length - 1];
      if (!lastSample || Date.now() - lastSample.t > 5000) {
        stateSamples.push({
          t: Date.now(),
          elapsedMs: Date.now() - startMs,
          counts: s.counts,
          fps: s.perf.fps,
          aliveCount: s.wave.aliveCount,
        });
      }

      // If alive enemies exist, lock + shoot
      if (!s.hero.dead && s.wave.aliveCount > 0) {
        const deadNow = s.enemies.find(e => e.id === lockedId)?.dead;
        if (!lockedId || deadNow) {
          lockedId = await page.evaluate(
            () => window._5DTest.lockOnNearestEnemy()
          );
        }
        if (lockedId) {
          await page.evaluate(() => window._5DTest.shoot());
        }
      }

      await page.waitForTimeout(POLL_MS);
    }

    // Write diagnostic dump regardless of pass/fail
    const dump = {
      durationMs: Date.now() - startMs,
      errorsCount: errors.length,
      errors,
      frameTimeSpikes,
      stateSamples,
      leakAnalysis: analyzeLeaks(stateSamples),
    };
    require("fs").writeFileSync(
      "tests/playwright/last-soak-run.json",
      JSON.stringify(dump, null, 2)
    );
    writeSoakSummaryMd(dump);

    // Hard assertions
    expect(errors, "console errors during run").toEqual([]);
    expect(frameTimeSpikes, "frame time spikes > 1s").toEqual([]);
    expect(analyzeLeaks(stateSamples).leaking, "memory leak detected").toBe(false);
  });

The analyzeLeaks helper compares first vs. last sample. A key that
grows >5x AND is monotonically increasing in >70% of samples is flagged:

  function analyzeLeaks(samples) {
    if (samples.length < 3) return { leaking: false, reason: "too few samples" };
    const first = samples[0].counts;
    const last  = samples[samples.length - 1].counts;
    const suspects = [];
    for (const key of Object.keys(first)) {
      const growth = last[key] / Math.max(1, first[key]);
      if (growth > 5) {
        let increasing = 0;
        for (let i = 1; i < samples.length; i++) {
          if (samples[i].counts[key] > samples[i-1].counts[key]) increasing++;
        }
        if (increasing / samples.length > 0.7) {
          suspects.push({ key, first: first[key], last: last[key], growth });
        }
      }
    }
    return { leaking: suspects.length > 0, suspects };
  }

──────────────────────────────────────────────────────────────────────
tests/playwright/regression.spec.js -- known bugs that must not return
──────────────────────────────────────────────────────────────────────

For each bug ever logged in docs/BUG_LOG.md, add a test here that
reproduces the original failing scenario and confirms it now passes.
This file grows over time as a permanent guard against regressions.

Format every test:

  test("BUG #N -- <short description>", async ({ page }) => {
    // setup that triggered the original bug
    // assert the symptom does not occur
  });

When BUG_LOG.md gets a new entry, a regression test gets added here
BEFORE the bug is marked fixed. Red first, then green.

═══════════════════════════════════════════════════════════════════════
PHASE 4 -- DIAGNOSTIC OUTPUT
═══════════════════════════════════════════════════════════════════════

When the soak test catches a freeze or error, write enough state that
the cause can be diagnosed without re-running. On every soak run
(pass or fail), write:

  tests/playwright/last-soak-run.json  -- full structured dump
  tests/playwright/last-soak-run.md   -- human-readable summary

The .md format:

  # Soak run YYYY-MM-DD HH:MM:SS
  ## Result: FAILED / PASSED
  ## Duration: 3m 0s
  ## Errors caught: N
    - 0:12 (12s in): TypeError: Cannot read property 'u' of undefined
      Stack: <first 5 lines>
  ## Frame time spikes: M
    - 1:47 (107s in): 4523ms freeze
      Particles at freeze: 12847  <- suspect
      Bullets at freeze: 0
  ## Leak suspects:
    - particles: grew from 50 to 12847 (256x, monotonic)

Also capture:
  - Playwright video (already retained on failure via config)
  - Playwright trace (already retained on failure via config)
  - The final state() snapshot appended to the JSON dump

═══════════════════════════════════════════════════════════════════════
PHASE 5 -- CI INTEGRATION
═══════════════════════════════════════════════════════════════════════

After phases 1-4 work locally:

  - Add .github/workflows/soak.yml that runs npm run test:soak on
    every push to main AND on a nightly cron (0 3 * * *).
  - Upload last-soak-run.json and last-soak-run.md as artifacts.
  - Do NOT block merges on soak failure yet. Mark informational.
    Let it run for two weeks first to establish what is real failure
    vs. environmental flake, then flip it to required.

═══════════════════════════════════════════════════════════════════════
ORDER OF OPERATIONS -- DO NOT SKIP AHEAD
═══════════════════════════════════════════════════════════════════════

  1. Phase 1: extend window._5DTest. Unit-test the new methods.
  2. Phase 2: install Playwright, write playwright.config.js, confirm
     `npx playwright test` runs against an empty test file.
  3. boot.spec.js: confirm the game loads cleanly.
  4. gameplay.spec.js: confirm combat works.
  5. soak.spec.js: THIS IS WHERE THE FREEZE IS CAUGHT.
  6. regression.spec.js: starts empty, grows over time.
  7. Diagnostic dumps.
  8. CI integration.

Each phase is its own commit. Do not combine phases.

═══════════════════════════════════════════════════════════════════════
WHAT TO DO WHEN THE SOAK TEST CATCHES THE FREEZE
═══════════════════════════════════════════════════════════════════════

The diagnostic dump will point at one of:

  - A count that grew unbounded (particles, bullets, listeners)
    -> look in the relevant system for missing pool cleanup
  - An error fired before the freeze
    -> look at the stack, fix the throw
  - Frame time ramping slowly from 16ms to 80ms to stall
    -> CPU-bound; profile the tick function with DevTools
  - Sudden freeze with no count growth
    -> likely a setInterval with no clearInterval, or a Promise
       that never resolves; search src/ for unguarded setInterval

When the cause is identified:
  1. Append an entry to docs/BUG_LOG.md.
  2. Write the regression test in regression.spec.js (RED).
  3. Write the fix.
  4. Confirm the regression test passes (GREEN).
  5. Commit.

This turns "happens sometimes, hard to catch" into
"happened once, has a test, never happens again."

═══════════════════════════════════════════════════════════════════════
FAILURE MODES TO AVOID
═══════════════════════════════════════════════════════════════════════

  - Writing the soak test before extending _5DTest. It will be a
    blind keypress-spammer. Phase 1 first.

  - Writing tests that pass on first run. The soak test SHOULD fail
    on current code if the freeze is real. If it passes immediately,
    verify by playing manually -- the test may not be testing what
    it claims to test.

  - Catching errors without dumping state. "Caught console.error"
    with no context is useless. Always dump state() at the moment.

  - Mocking WebGL. Use real Chromium with swiftshader. The freeze
    likely involves WebGL state and cannot be caught with a mock.

  - Asserting fps > 60. CI containers are slower. Assert > 20.
    The freeze you want drops to 0, not to 45.

  - Running the soak test for more than 5 minutes by default. Start
    at 3 minutes. Longer runs go behind test:soak:long.

═══════════════════════════════════════════════════════════════════════
THE THESIS
═══════════════════════════════════════════════════════════════════════

The game has 3340 unit tests and freezes in 2 minutes anyway. That
gap is what this prompt closes. A test that opens the actual game
in an actual browser and plays it for actual minutes will catch
what unit tests cannot. Build it carefully -- extend the bridge,
install Playwright, get one test green, then write the soak test.
The freeze will be there in 3 minutes when you are ready to catch it.

Begin.


═══════════════════════════════════════════════════════════════════════
ADDENDUM: REAL-WORLD RESILIENCE
═══════════════════════════════════════════════════════════════════════

The previous sections assumed "page loads, game plays, test catches
bug." That is not the world the test runs in. The game has menus,
dialogs, perk popups between waves, accidental keypresses, network
blips, lost WebGL contexts, and a thousand small ways the test can
get stuck without the bug actually being absent. This addendum is
the survival manual. Read it before writing a single line of test code.

═══════════════════════════════════════════════════════════════════════
EXTEND THE TEST BRIDGE FURTHER (additions to Phase 1)
═══════════════════════════════════════════════════════════════════════

The window._5DTest bridge needs these additional methods before any
soak test can be reliable. Add them in the same _5DTest block:

  dismissAllDialogs() returns: { dismissed: ["firstLaunch", "perk"], remaining: [] }
    Closes every blocking overlay it can find:
      - First-launch tutorial
      - Difficulty select
      - Game-mode select
      - Perk picker
      - Death screen (re-spawn via _resetSys if needed)
      - NPC dialog, Shop, Settings panel, Inventory
      - Build mode (toggle off if on)
      - Computer screen (call closeComputer())
      - Pause menu
    Returns the list of dialogs found and dismissed. Idempotent --
    safe to call every poll.

  startWaveMode() returns: boolean
    Selects "wave" game mode and starts from a clean state. Calls
    whatever wave-mode-init does internally, bypassing the main menu.
    Returns false if it cannot (e.g. menu not present).

  pickFirstPerk() returns: { picked: "rapid_fire" } | { picked: null, reason: "..." }
    When the perk picker is open, picks the first available perk
    programmatically. Test soak runs do not care which perk; any
    pick is fine -- just unblock the game.

  isBlocked() returns: { blocked: true, by: "perk_picker" } | { blocked: false }
    Single source of truth for "is the game waiting on the human
    to do something?" Checks every modal/overlay/menu state.
    The soak loop polls this every tick and calls dismissAllDialogs()
    if blocked.

  ensureGodModeAndInfiniteAmmo() returns: boolean
    Sets Engine.debug.godMode = true. Also sets a flag the weapon
    code respects to never decrement ammo, never trigger reload.
    The soak test wants to run for 3 minutes without interruption --
    death and reload are interruptions.

  healthState() returns: { hp, maxHp, godMode, infiniteAmmoOn, ammo }
    Verifies god mode actually stuck. The soak test calls this
    every poll and re-applies if it's somehow off.

  hardReset() returns: boolean
    Reloads the game to a clean state WITHOUT a browser reload.
    Calls _resetSys.resetGame() + clears all dialogs + restarts
    wave 1. Used when the test detects unrecoverable state and
    wants to retry without losing the test harness process.

  getLastError() returns: { message, stack, t } | null
    Returns the most recent error caught by the game's own error
    handler. The game must install window.onerror +
    unhandledrejection handlers that buffer errors internally.
    The soak test polls this every second.

  installCrashHandler() returns: boolean
    Idempotent. Installs window.onerror + unhandledrejection
    handlers that push errors into an internal buffer. Call this
    FIRST, before anything else can throw.

  perfSnapshot() returns:
    { now, frameTimeMs, framesSinceLastReport, memUsedMB, memTotalMB,
      lastTickMs }
    More detailed than state().perf -- includes heap memory when
    performance.memory is available (Chrome only, gated). The soak
    test uses memUsedMB growth as a secondary leak signal.

═══════════════════════════════════════════════════════════════════════
THE RESILIENT SOAK TEST -- ARCHITECTURE
═══════════════════════════════════════════════════════════════════════

The soak test from the previous section was happy-path. Replace it
with this three-phase design:

  PHASE A: Setup (with retries)
    For attempt = 1 to 5:
      - page.goto with 30s timeout
      - waitForFunction window._5DTest with 15s timeout
      - installCrashHandler()
      - dismissAllDialogs() loop until isBlocked() = false (max 20x)
      - startWaveMode()
      - ensureGodModeAndInfiniteAmmo()
      - if all succeeded, break
      - on failure: log reason, page.reload(), retry
    If 5 attempts fail: fail with "could not start the game" (not a
    generic timeout).

  PHASE B: The soak loop
    Every 250ms for DURATION_MS:
      a. safeEval(state). If throws -> recovery path.
      b. safeEval(isBlocked). If blocked -> dismissAllDialogs()
         + pickFirstPerk() + log the unblock.
      c. Verify god mode still on. If not -> re-apply + log.
      d. Sample state for diagnostics.
      e. If hero alive + enemies exist -> lockOnNearestEnemy() +
         shoot(). If lockOn returns null for 10 consecutive polls ->
         killEnemy(nearest) to break the stall.
      f. If wave.phase unchanged for 60s AND aliveCount === 0 ->
         call WaveManager.forceNextWave() (add to bridge if absent).
      g. If page.isClosed() -> recovery path.
      h. If hero position (u,v) unchanged for 30s with enemies alive
         -> hero is stuck, hardReset(), log, restart loop phase.

  PHASE C: Tiered recovery
    Tier 1 -- Soft: dismissAllDialogs(), re-apply god mode, wait 1s,
              retry the failed operation.
    Tier 2 -- Hard reset: hardReset(), wait for state() to return
              clean values, continue from current elapsed time.
    Tier 3 -- Page reload: page.reload(), re-run Phase A. Diagnostic
              records this as a reload event.
    Tier 4 -- Bail: write diagnostic dump, fail the test.
              5 reloads = unrecoverable = a real finding.

═══════════════════════════════════════════════════════════════════════
THE DEFENSIVE CODING RULES
═══════════════════════════════════════════════════════════════════════

Every page.evaluate() wraps in try-catch. Never let an eval error
crash the test -- treat it as recoverable:

  async function safeEval(page, fn, fallback = null) {
    try {
      return await page.evaluate(fn);
    } catch (e) {
      diagnostic.evalErrors.push({ t: Date.now(), error: e.message });
      return fallback;
    }
  }

Every state() read tolerates missing fields:

  const s = await safeEval(page, () => window._5DTest?.state?.());
  const aliveCount = s?.wave?.aliveCount ?? 0;
  const heroDead = s?.hero?.dead ?? true;

Every wait has a timeout AND fallback action. Never use bare
waitForFunction without a timeout argument.

WebGL context loss handler -- install in page after navigation:

  await page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    if (canvas) {
      canvas.addEventListener("webglcontextlost", e => {
        e.preventDefault(); window._5DTest._contextLost = true;
      });
      canvas.addEventListener("webglcontextrestored", () => {
        window._5DTest._contextLost = false;
      });
    }
  });

Check _contextLost every poll. If set, force a reload.

Tab-backgrounded false-freeze prevention. rAF throttles to 1fps
when the tab is hidden:

  await page.evaluate(() => {
    document.addEventListener("visibilitychange", () => {
      window._5DTest._lastVisibilityChange = Date.now();
    });
  });

If a frame-time spike occurs within 2 seconds of a visibility change,
skip it -- it is not a freeze.

Pointer lock stub. Playwright cannot grant pointer lock the way a
user click does. Stub it so the game thinks it has lock:

  await page.evaluate(() => {
    document.body.requestPointerLock = () => Promise.resolve();
    Object.defineProperty(document, 'pointerLockElement', {
      get: () => document.body, configurable: true,
    });
  });

Do NOT use page.keyboard for the soak loop. All input goes through
_5DTest bridge methods. This prevents accidentally pressing Tab, B,
Esc, or any key that opens a menu or changes game mode.
The only exception: Escape to exit an accidental fullscreen.

═══════════════════════════════════════════════════════════════════════
STARTUP CEREMONY -- HANDLE EVERY MENU IN ORDER
═══════════════════════════════════════════════════════════════════════

The startup sequence the test must navigate:

  1. Navigate to /?_5dtest=1
  2. Loading screen appears, fades after first tick
  3. waitForFunction: window._5DTest exists
  4. installCrashHandler() -- FIRST, before anything else throws
  5. First-launch tutorial may appear -- dismiss
  6. Difficulty select may appear -- pick "normal"
  7. Game-mode select may appear -- pick wave mode
  8. Wave 1 countdown starts (or call WaveManager.skipCountdown)
  9. ensureGodModeAndInfiniteAmmo()
  10. Verify state.wave.phase advances from "idle" -> "spawning"
      within 10 seconds. If not: hardReset(), retry from step 5.

Code this as an explicit state machine with per-step check + action
+ verify. If verify fails, retry up to 3 times before falling back.

═══════════════════════════════════════════════════════════════════════
PERK PICKER -- THE MOST COMMON BLOCKER
═══════════════════════════════════════════════════════════════════════

Between every wave, the perk picker appears and pauses the game.
The soak loop must handle it every poll:

  if (state.wave.phase === "pausing" || isBlocked.blocked) {
    const result = await safeEval(page, () => window._5DTest.pickFirstPerk());
    diagnostic.perksPicked.push({ t: now, perk: result?.picked });
  }

If pickFirstPerk consistently returns null when the game is paused,
the perk picker is broken -- log this loudly. That failure mode
is itself a finding worth reporting.

═══════════════════════════════════════════════════════════════════════
RELOAD STRATEGY -- PRESERVE HEAP PRESSURE
═══════════════════════════════════════════════════════════════════════

Track soak state across reloads in the test harness (not the page):

  const soakState = {
    startMs: Date.now(), reloadCount: 0,
    totalActiveSeconds: 0, errorsThisRun: 0, diagnostics: [],
  };

A reload consumes elapsed time -- it is not a fresh start. After
reload, continue toward DURATION_MS budget.

Hard reset (in-page, no browser reload) is PREFERRED because it
keeps the heap state. A leak that has been building survives the
reset, which is what you want -- keep applying pressure to whatever
is leaking.

Browser reload is the last resort. Use only when:
  - hardReset() fails
  - WebGL context lost and not restored within 5 seconds
  - state() throws for 10 consecutive polls
  - page.isClosed() === true

Hard limit: 5 browser reloads per run. After 5: fail with
"unrecoverable after 5 reloads" -- that IS the finding.

═══════════════════════════════════════════════════════════════════════
WHAT COUNTS AS A REAL FREEZE VS BENIGN SPIKE
═══════════════════════════════════════════════════════════════════════

Real freezes the test should catch:
  - frameTimeMs > 1000 sustained for 3+ consecutive polls
  - state() returns null for 3+ consecutive polls
  - hero position unchanged for 30+ seconds with enemies alive
  - aliveCount > 0 unchanged for 60+ seconds in same wave phase
  - WebGL context lost, not restored within 5 seconds

Benign spikes to ignore:
  - First 3 seconds (shader compile spike)
  - GC pauses (100-500ms is GC, not a freeze; require > 1000ms)
  - Spikes within 2 seconds of a visibility change
  - Spikes during hardReset() or wave-clear animation

  function isRealFreeze(recentSamples, contextLost, mssinceReset) {
    const allSpike = recentSamples.every(s => s.frameTimeMs > 1000);
    return allSpike && !contextLost && mssinceReset > 5000;
  }

═══════════════════════════════════════════════════════════════════════
THE DETECTION COVERAGE MATRIX
═══════════════════════════════════════════════════════════════════════

Every diagnostic dump must include a coverage matrix showing which
defensive paths actually fired during the run. This is how you verify
the test isn't silently passing because it never hit the edge cases:

  ## Detection coverage:
    [ok] First-launch dialog dismissed
    [ok] Difficulty select dismissed
    [ok] Mode select navigated
    [ok] Perk picker dismissed (2 times)
    [  ] WebGL context loss (did not occur)
    [  ] Hero stuck detection (did not trigger)
    [ok] Hard reset (1 time at 0:22)
    [  ] Page reload (did not occur)
    [ok] God mode re-applied (3 times)  <- something is resetting it
    [  ] Visibility change skip (did not occur)

"God mode re-applied 3 times" is itself a finding -- something in
the game is overriding god mode mid-run. The soak test surfaces it.

═══════════════════════════════════════════════════════════════════════
EDGE CASES THE TEST MUST HANDLE
═══════════════════════════════════════════════════════════════════════

  - No enemies spawn within 30s -> hardReset (WaveManager bug)
  - Enemy positions return NaN -> filter from lockOn candidates
  - Hero teleports >50 units in one tick -> log as anomaly
  - Two perk dialogs at once -> pickFirstPerk picks both in sequence
  - page.on('framenavigated') fires -> treat as unexpected navigation,
    trigger reload path
  - window.alert() fires -> Playwright dismisses it, log it
  - localStorage full -> clear it on test start
  - Accidental fullscreen -> send Escape (one of the few justified
    keyboard uses in the soak loop)

═══════════════════════════════════════════════════════════════════════
SAMPLE DIAGNOSTIC DUMP (.md format, richer version)
═══════════════════════════════════════════════════════════════════════

  # Soak run 2026-05-19 14:32:00
  ## Result: FAILED (freeze at 1m 47s)
  ## Duration: planned 3m, ran 1m 49s
  ## Reloads: 0  |  Hard resets: 1 (at 0:22)
  ## Total active seconds: 107 / 180
  ## Errors caught: 3
    - 0:12  console error: "TypeError: Cannot read property 'u' of undefined"
    - 0:43  unhandled rejection: "Failed to fetch shader"
    - 1:47  onerror: "Maximum call stack size exceeded"  <- likely cause
  ## Freeze detection: TRIGGERED at 1m 47s
    - frameTimeMs sequence: [16, 17, 16, 850, 4521, 8932, ...]
    - State at freeze:
        wave 4, phase "spawning", aliveCount 8
        particles 12847  <- grew from 50, suspect
        bullets 0, enemyBullets 2
    - Last console messages before freeze:
        [warn] "Particle pool near capacity"   <- ignored warning
        [warn] "Particle pool at capacity, dropping"
        [error] "Maximum call stack size exceeded"
  ## Dialogs dismissed: firstLaunch, difficultySelect, modeSelect,
    perk x2 (rapid_fire, extra_grenades)
  ## Suspect leaks:
    - particles: 50 -> 12847 (256x, monotonic)
  ## Recommended: check src/render/vfx.js particle pool return path
  ## Video: tests/playwright/videos/soak-failed.webm
  ## Trace: tests/playwright/traces/soak-failed.zip

═══════════════════════════════════════════════════════════════════════
THE THESIS (ADDENDUM)
═══════════════════════════════════════════════════════════════════════

A test that says "page.click; press W; expect no errors" will fail
in 30 different ways before catching the freeze. A test that handles
every dialog, every modal, every recovery path, and every edge case
above will catch the freeze AND tell you exactly what was on screen,
what the heap looked like, what warnings preceded it, and what the
recovery system tried.

That is about 400-600 lines of Playwright code when done. That is
normal for a real soak test. Do not try to make it shorter by
skipping the recovery code -- the recovery code is what separates
a useful soak test from one that fails on the first network blip
and tells you nothing.

Build it carefully:
  1. Bridge extensions (Phase 1 in the main prompt, plus the
     additions in this addendum)
  2. Minimal 30-second soak -- just Phase A + Phase B with no
     recovery paths yet. Get it green.
  3. Add one recovery path at a time, verifying each fires when
     its trigger is induced.
  4. Crank duration to 3 minutes and let it find the real bug.

Begin.
