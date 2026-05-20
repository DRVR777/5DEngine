STATE.md - loop progress tracker

Last completed iter: 697

Current index.html:
  total lines:        2523
  code lines:         1851
  blank lines:        204
  comment-only lines: 468

Original LOOP_PROMPT five named targets:
  1. enemy AI loop       DONE
  2. bullet physics      DONE
  3. keydown handler     DONE
  4. save wiring         DONE
  5. screen interaction  DONE

Current loop prompt:
  docs/LOOP_PROMPT_NEW.md

Grouped extraction queue:
  0. canvas_primary_action cleanup          DONE (before codex)
  1. builder UI refresh                     DONE (iter 691)
  2. world builder controls                 DONE (iter 692)
  3. world builder hotbar/creative/sync     DONE (iter 693)
  4. in-world screens/build console         DONE (iter 694)
  5. device graph + mon1 screen             DONE (iter 695)
  6. asset loading bootstrap                DONE (iter 696)
  7. app + multiplayer wiring               DONE (iter 697)
  8. runtime error reporter                 NEXT
  9. grouped mount factories                pending

Notes:
  - src/systems/perk_system.js has an unrelated dirty change in the worktree.
    Do not overwrite it accidentally.
  - Use npm run count:index for line counts.
  - Use npm test for every extraction.
  - Use npm run browser-check for browser/runtime-affecting extraction.
