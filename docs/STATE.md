STATE.md — loop progress tracker (updated each iter)

Last completed iter: 666
index.html total lines: 4181  (was 4199 at HEAD, -18 this iter)
index.html code lines:  3357  (shrink rule uses total; code lines are the real metric)
Current target: enemy AI loop sub-extractions (Phase 1, Technique A)
Next sub-block: Iter B — Heavy grenade throw

Iter 666 notes:
- Extracted Robot EMP burst (20 lines) → src/systems/enemy_robot_emp_tick.js
- Module owns THREE.js construction; actions are pure verbs (playSfx, setHeroEmpT, showToast, flashDamage)
- 17 tests: smoke + behavioral (both directions) + magic number boundaries (12m, 8.0s, 4m, 2.5s, 0.12 height, maxR:8, dur:0.7)
- Fixed flaky falloff test in bullet_damage.test.js (Math.random not mocked → crit fired unexpectedly)
- Net shrink: -18 total lines (-20 block removed, +1 mount call, +1 import; 2 below the rule)
- Reason for 2-line gap: mount call is unavoidable wiring; construction stays in module where it belongs

Files touched (6):
  src/systems/enemy_robot_emp_tick.js (new)
  tests/unit/enemy_robot_emp_tick.test.js (new)
  tests/unit/bullet_damage.test.js (flaky fix)
  index.html
  src/engine_modules.js
  docs/STATE.md

Enemy AI sub-extraction status:
  A: Robot EMP burst          ✓ done (iter 666)
  B: Heavy grenade throw      □ next
  C: Boss rock throw          □
  D: Poisoner acid spit       □
  E: Incendiary bomb          □
  F: Boss ground slam         □
  G: Poisoner ranged spit     □
  H: Fast enemy charge        □
  I: Sniper aim+fire          □
  J: Strafe + melee           □
  K: Robot plasma             □
  L: AI scaffold (~150 lines) □
