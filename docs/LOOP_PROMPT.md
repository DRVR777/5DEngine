# 5DEngine Holographic Refactor Loop

You wake every 20 minutes. You read this entire prompt. You check current
state. You do one tick of work. You document everything. You schedule the
next wake. You exit. You keep doing this until the refactor is complete.

---

## THE ONE RULE

**Everything is an atom. Atoms have the same shape. Only their facets differ.**

All elements are made of atoms. All atoms are the same. But elements aren't
the same. The difference is which facets the atom carries and what's in them.

A hero is an atom. An enemy is an atom. A weapon is an atom. A prefab is an
atom. A network packet is an atom. A perk is an atom. A game mode is an atom.
A behavior is an atom. A test is an atom. A system is an atom. A component
is an atom. Every JSON file in `/data/` is an atom. Every JS file in `/src/`
follows the same module shape. The part is in the whole. The whole is in
the part. Holographic.

This is not a metaphor. This is the file format.

---

## THE UNIVERSAL ATOM FORMAT

Every atom — every prefab, every component, every system, every behavior,
every weapon, every level, every packet, every test, every config — is
serialized as:

```json
{
  "$version": 1,
  "$type": "<facet_type>",
  "$id": "<unique_id_within_type>",
  "$facets": { },
  "$refs": { },
  "$meta": { }
}
```

- `$version` — schema version. Bump when the registry changes.
- `$type` — which facet type this atom is. Determines which parser handles it.
- `$id` — unique identifier within its type.
- `$facets` — the actual data. Key is facet name, value is facet payload.
- `$refs` — references to other atoms by `{ type, id }`. Never inline another atom.
- `$meta` — author, timestamp, source line in monolith, tags. Optional.

The registry (`/src/core/registry.js`) is the F=ma of this codebase. One
parser per facet type. Adding a new game concept = one new registry entry.
Never a new file shape. Never a new API. Never a new validation path.

---

## THE LOOP RULES

You don't have memory between ticks. The repo is your brain. Specifically:

- `docs/ARCHITECTURE.md` — the spec. Holographic atom format. The constitution.
- `docs/STATE.md` — current phase, current task, last tick. Read at start, rewritten at end.
- `docs/JOURNAL.md` — append-only log. One entry per tick.
- `docs/LOOP_PROMPT.md` — this prompt. Saved on tick 0. Read at start of every tick.
- `git log` — source of truth for what shipped.

You are editing the **fresh repo** at the path your shell is currently in.
The old monolith is at `../5DEngineMassive/` (sibling directory), **read-only**.
You never write to it.

---

## TICK 0 — Setup (run only if `docs/STATE.md` doesn't exist)

Do all of this. Don't ask permission. Don't stop halfway.

```bash
# 1. Rename old repo on GitHub
gh repo rename 5DEngineMassive -R DRVR777/5DEngine

# 2. Clone it as sibling reference (read-only from here on)
cd .. && git clone https://github.com/DRVR777/5DEngineMassive.git

# 3. Create fresh repo for the refactor
mkdir 5DEngine && cd 5DEngine && git init -b main
gh repo create DRVR777/5DEngine --public --source=. --remote=origin

# 4. Skeleton
mkdir -p src/{core,components,systems,behaviors,render,net} \
         data/{prefabs,components,systems,behaviors,weapons,enemies,perks,levels,game_modes,network,tuning} \
         tests/{unit,integration,smoke,golden} \
         docs

# 5. Write docs/ARCHITECTURE.md, docs/STATE.md, docs/JOURNAL.md
#    and SAVE THIS PROMPT to docs/LOOP_PROMPT.md
#    Use the templates at the bottom of this file VERBATIM.

# 6. Write package.json with vitest. npm install.

# 7. Initial commit + push
git add -A && git commit -m "tick 0: scaffolding + holographic spec" && git push -u origin main
```

Then schedule the next tick:

```bash
nohup bash -c "sleep 1200 && claude -p \"\$(cat $(pwd)/docs/LOOP_PROMPT.md)\" --dangerously-skip-permissions" > /tmp/5dengine_tick.log 2>&1 &
```

Verify it's queued: `ps aux | grep sleep | grep -v grep`. Then exit.

---

## EVERY TICK

Wall time: 18 minutes max.

### 1. Re-orient (≤2 min)

```bash
cat docs/ARCHITECTURE.md      # full spec, read it all
cat docs/STATE.md             # current state
tail -50 docs/JOURNAL.md      # recent ticks
git log --oneline -10
git status
ls ../5DEngineMassive/        # confirm monolith reference exists
```

- If line 1 of `STATE.md` is `STOP` — exit, don't schedule.
- If working tree is dirty — `git stash`, log it to JOURNAL.md, continue.
- If `../5DEngineMassive/` doesn't exist — clone it first, then continue.

### 2. Status check (≤1 min)

Run these sanity checks. Append the output to your scratch context:

```bash
# How holographic are we?
echo "=== /src/ line count ==="
find src/ -name "*.js" | xargs wc -l | tail -1

echo "=== /data/ atom count ==="
find data/ -name "*.json" | wc -l

echo "=== Files violating holographic format ==="
find data/ -name "*.json" -exec sh -c 'python3 -c "import json,sys; d=json.load(open(sys.argv[1])); exit(0 if all(k in d for k in [\"\\$version\",\"\\$type\",\"\\$id\",\"\\$facets\"]) else 1)" "$1" >/dev/null 2>&1 || echo "BAD: $1"' _ {} \;

echo "=== Tests ==="
find tests/ -name "*.test.js" | wc -l
```

If you see `BAD:` lines — that's a format violation. Fix those first.

### 3. Pick the smallest next task (≤1 min)

Read `## Current task` in `STATE.md`. If ≤10 min of work, do it. If bigger,
decompose: take the smallest slice, rewrite STATE.md so the slice becomes
the current task, queue the rest in `## Queued`.

If `STATE.md` has no current task, pick from this priority list:
1. Holographic format violations (BAD lines from status check).
2. New source file without a test file.
3. New monolith feature not yet ported.
4. Bug from `## Bug backlog` in STATE.md.

### 4. Do the work (≤10 min)

Constraints, no exceptions:

- **Max 5 files per tick.** If you need more, decompose.
- **Every new file is an atom.** Source file = exports something with a
  registered `$type`. Data file = has `$version/$type/$id/$facets` at top.
- **Every facet type has exactly one parser** in `/src/core/registry.js`.
  If you're adding a new facet type, add the parser in the same commit.
- **Read `../5DEngineMassive/` to learn behavior. Never write to it.**
- **No inventing.** The monolith is the spec for behavior. Port, don't redesign.
- **Every new source file gets a test file.**
- **The same atom shape applies recursively.** A behavior tree node is an
  atom. A facet definition is an atom. A test case is an atom. The format
  doesn't bottom out — it's the same all the way down.

### 5. Test (≤2 min)

```bash
npm test
```

- Green: continue.
- Red: `git checkout -- . && git clean -fd`, append `## tick N FAILED`
  block to JOURNAL.md with full test output, skip to step 7. Don't ship
  broken code.

### 6. Commit + push (≤1 min)

```bash
git add -A
git commit -m "tick N: <one line, what shipped, what facet type changed>"
git push
```

N = count from `git log --oneline | wc -l` or iter number from last commit.

### 7. Update STATE.md (≤2 min)

Rewrite it. Every section from the template stays present. You update values.

### 8. Append to JOURNAL.md (≤1 min)

```markdown
## tick N — <UTC timestamp>

**Did:** <what you did, one paragraph>
**Atom types touched:** <facet types added/modified>
**Files:** <paths>
**Tests:** <passed/failed counts>
**Holographic violations:** <count from status check, ideally 0>
**Commit:** <hash> "<message>"
**Next:** <what tick N+1 picks up>
**Notes:** <anything weird>
```

Append only. Never edit past entries.

### 9. Schedule next tick (≤30 sec)

Use ScheduleWakeup with:
- `delaySeconds: 1200` (20 minutes)
- `prompt: "/loop ECS refactor tick"`
- `reason: "continuing holographic ECS refactor tick N+1"`

### 10. Exit

---

## HARD RULES (violating any = failed tick)

1. Tests red = revert. Never commit broken code.
2. Every data file has `$version`, `$type`, `$id`, `$facets`. No exceptions.
3. Every source module exports atoms or operates on atoms. No exceptions.
4. One parser per facet type, in `/src/core/registry.js`.
5. Never modify `../5DEngineMassive/`. Read only.
6. Never touch >5 files per tick.
7. Never disable tests to ship a commit.
8. Never invent functionality the monolith doesn't have.
9. Never modify `ARCHITECTURE.md` unless STATE.md explicitly says to.
10. Always update STATE.md, append JOURNAL.md, schedule next tick before exiting.
11. Same task fails 3 ticks in a row → mark BLOCKED in STATE.md, pick different work.
12. If you find yourself wanting to add a new file shape, you've failed. Add a new `$type` to the existing shape instead.

---

## STOPPING

When the refactor is done, write `STOP` on line 1 of STATE.md, write a
final JOURNAL.md entry, push, exit without scheduling.

---

## FEEL PRESERVATION

The architecture migration only succeeds if the game feels exactly the same
after as before. Otherwise you haven't refactored — you've made a different
game with cleaner code, and you've lost something real in the process.

### What "feel" actually is, technically

Feel isn't vibes. Feel is a finite set of measurable things:

1. **Numeric constants** — gravity, sprint speed, jump height, friction, damage
   values, HP pools, fire rate, reload time, projectile speed, recoil, FOV,
   camera distance, mouse sensitivity. Every tunable. All load-bearing.

2. **Timing and frame ordering** — the exact sequence of subsystem updates inside
   `tick()`. If physics ran before AI in the monolith and you flip them, enemies
   react to old positions and the game feels "off" in ways nobody can name.

3. **Curves and easings** — not just "the camera lerps," but specifically `dt * 10`
   vs `dt * 8`. Not just "recoil decays," but the actual decay function.

4. **RNG behavior** — which seed, which distribution, which range. Bullet spread
   of ±0.04 vs ±0.05 is visible in feel even though both sound like "small."

5. **Edge case handling** — every `if (cp) return;`, every `Math.max(0, x)`,
   every clamp. These are undocumented bug fixes that became part of the feel.

6. **Order-of-operations in expressions** — `(a + b) * c` vs `a + b * c` matters.

7. **Frame-rate behavior** — fixed-timestep preserves this if the same operations
   are on the fixed clock that the monolith effectively had there.

### Step 1: Inventory pass — every constant → `/data/tuning/`

Before writing any new system code, extract all named constants from the monolith:

```bash
cd ../5DEngineMassive
grep -nE 'const\s+[A-Z_]+\s*=\s*[-0-9.]+' index.html | head -100
```

Every load-bearing number goes into a tuning atom. Example:

```json
{
  "$version": 1,
  "$type": "tuning",
  "$id": "physics",
  "$facets": {
    "gravity": -25,
    "fixedDt": 0.01666,
    "maxFrameDt": 0.05,
    "jumpVelocity": 13
  },
  "$refs": {},
  "$meta": {
    "source": "../5DEngineMassive/index.html",
    "extracted_from_lines": "line numbers here",
    "note": "Copied verbatim. -25 gravity is intentional, not -9.8."
  }
}
```

The `$meta.note` is load-bearing. Future ticks must not "fix" these numbers.

### Step 2: Every system reads tuning data, never inlines constants

```javascript
// /src/systems/movement_system.js
import { Registry } from "../core/registry.js";

const physics = Registry.get("tuning").parse(await Core.loadData("data/tuning/physics.json"));

export const MovementSystem = {
  $version: 1, $type: "system", $id: "movement",
  $facets: {
    system: {
      fixed: true, priority: 30, query: ["Transform", "Velocity"],
      tick: (dt, ids, ctx) => {
        for (const id of ids) {
          const v = ctx.getComponent(id, "Velocity");
          v.vy += physics.$facets.gravity * dt;
        }
      }
    }
  }
};
```

### Step 3: Golden snapshot from the monolith

Before porting any system, capture baseline behavior from the monolith:

```javascript
// Run once inside 5DEngineMassive browser console:
window.__captureGolden = async () => {
  const scenarios = [
    { name: "hero_falls_from_height", setup: () => { hero.y = 50; hero.vy = 0; }, frames: 120 },
    { name: "hero_sprint_distance",   setup: () => { keys.w = true; keys.shift = true; }, frames: 300 },
    { name: "hero_jump_apex",         setup: () => { keys.space = true; }, frames: 60 },
    { name: "shotgun_8m_kill",        setup: () => { spawnEnemy("grunt", 8, 0); setWeapon("shotgun"); shoot(); }, frames: 120 },
  ];
  const results = {};
  for (const s of scenarios) {
    resetGameState(); s.setup();
    const trace = [];
    for (let f = 0; f < s.frames; f++) {
      tick(1/60);
      trace.push({ frame: f, heroY: hero.y.toFixed(4), heroHp, heroU: hero.u.toFixed(4) });
    }
    results[s.name] = trace;
  }
  return JSON.stringify(results, null, 2);
};
```

Save output to `/tests/golden/monolith_baseline.json`. Every system port gets
a golden test that runs the same scenario and checks frame-by-frame.

### Step 4: Port in dependency order

```
1. Tuning data extraction  → /data/tuning/
2. Component schemas       → /src/components/
3. Fixed-timestep core     (same clock as monolith)
4. Movement system         → golden: hero_falls, hero_sprint
5. Physics/collision       → golden: jump apex, ground detection
6. Hero state machine      → golden: stand→walk→sprint transitions
7. Camera follow           → golden: tracking lag
8. Weapons system          → golden: fire rate, recoil, reload timing
9. Projectiles             → golden: travel speed, arc
10. Combat                 → golden: shotgun 8m kill, sniper headshot
11. Enemy AI (per archetype) → golden: chase, attack, retreat
12. Pickups                → golden: collection radius, effect
13. Particles + effects    → golden: emit count, lifetime
14. UI / HUD               → golden: HP bar, ammo counter
15. Networking             → golden: packet round-trip
```

### Step 5: Shadow mode — never go dark

Port one system. Run it in parallel with the monolith. Compare per-frame.
Only flip authority when the watcher logs zero feel violations across an hour.

The game never feels different. At no point does "the game now uses ECS but
feels different" happen. The migration is invisible to the player.

### Constants you'll forget to extract

1. Numeric literals inside formulas: `vel.x *= 0.95` — the 0.95 is tunable.
2. Magic strings: `if (state === "crouching")` — valid states are data.
3. Array lengths: `for (let i = 0; i < 8; i++)` for pellets — 8 is a constant.
4. Conditional thresholds: `if (hero.hp < 20)` — the 20 is a tunable.
5. Sequence ordering: "physics before AI" — encode as system priority numbers.
6. The names of things: kill-feed strings, enemy labels, SFX keys — all data.

---

## TEMPLATES (use verbatim on tick 0)

### docs/ARCHITECTURE.md → See current file (already written)

### docs/STATE.md → See current file (already written)

### docs/JOURNAL.md

```markdown
# JOURNAL.md

Append-only. Newest at bottom.

## tick 0 — <UTC>

**Did:** Renamed monolith to 5DEngineMassive. Cloned as read-only sibling.
Created fresh 5DEngine repo with holographic directory skeleton. Wrote
ARCHITECTURE/STATE/JOURNAL/LOOP_PROMPT. vitest installed.
**Atom types touched:** (none yet — infrastructure only)
**Files:** docs/*.md package.json .gitignore skeleton dirs
**Tests:** 0/0
**Holographic violations:** 0
**Commit:** <hash> "tick 0: scaffolding + holographic spec"
**Next:** Build /src/core/registry.js — the universal atom parser.
**Notes:** Loop scheduled. Refactor begins next tick.
```

---

End of prompt. Read it next tick. Don't lose it.
