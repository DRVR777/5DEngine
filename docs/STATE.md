STATE.md - loop progress tracker (updated each iter)

Last completed iter: 679
index.html total lines: 3950  (was 4060 after iter 678, -110 this iter)
index.html code lines:  3176

Current target: bullet physics loop sub-extractions (Phase 1, Technique A)
Next sub-block: remaining bullet movement/substep shell

Enemy AI sub-extraction status:
  A: Robot EMP burst          done (iter 666)
  B: Heavy grenade throw      done (iter 667)
  C: Boss rock throw          done (iter 668)
  D: Poisoner acid spit       done (iter 669)
  E: Incendiary fire bomb     done (iter 670)
  F: Boss ground slam         done (iter 671)
  G: Poisoner ranged spit     done (iter 672)
  H: Fast enemy charge        done (iter 673)
  I: Sniper aim+fire          done (iter 674)
  J: Strafe + melee           done (iter 675)
  K: Robot plasma             done (iter 676)
  L: AI scaffold (~150 lines) done (iter 677)

10-step extraction/autonomy plan:
  1. Bullet world-hit tail (peers, barrels, crates, buildings) done (iter 678)
  2. Bullet enemy damage/kill path done (iter 679; death/reward branch)
  3. Remaining bullet movement/substep shell
  4. Save wiring cleanup
  5. Screen interaction cleanup
  6. Keydown config/wiring cleanup
  7. Enemy AI wrapper cleanup
  8. Mount-call factory prep
  9. Wiring aggregation
  10. Dead extraction comments + handoff toward abstraction
