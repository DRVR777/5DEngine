STATE.md - loop progress tracker

Last completed iter: 691 in progress

Current index.html:
  total lines:        3260
  code lines:         2471
  blank lines:        244
  comment-only lines: 545

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
  2. world builder setup/hotbar/creative    NEXT
  3. in-world screens/build console         pending
  4. device graph + mon1 screen             pending
  5. asset loading bootstrap                pending
  6. app + multiplayer wiring               pending
  7. runtime error reporter                 pending
  8. grouped mount factories                pending

Notes:
  - src/systems/perk_system.js has an unrelated dirty change in the worktree.
    Do not overwrite it accidentally.
  - Use npm run count:index for line counts.
  - Use npm test for every extraction.
  - Use npm run browser-check for browser/runtime-affecting extraction.
