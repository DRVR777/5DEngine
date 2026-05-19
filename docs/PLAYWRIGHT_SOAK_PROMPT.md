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
