STATE.md - loop progress tracker

Last completed iter: 692 in progress

Current index.html:
  total lines:        3126
  code lines:         2348
  blank lines:        239
  comment-only lines: 539

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
  3. world builder hotbar/creative/sync     NEXT
  4. in-world screens/build console         pending
  5. device graph + mon1 screen             pending
  6. asset loading bootstrap                pending
  7. app + multiplayer wiring               pending
  8. runtime error reporter                 pending
  9. grouped mount factories                pending

Notes:
  - src/systems/perk_system.js has an unrelated dirty change in the worktree.
    Do not overwrite it accidentally.
  - Use npm run count:index for line counts.
  - Use npm test for every extraction.
  - Use npm run browser-check for browser/runtime-affecting extraction.
