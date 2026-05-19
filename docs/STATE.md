STATE.md - loop progress tracker (updated each iter)

Last completed iter: 683
index.html total lines: 3766  (was 3820 after iter 682, -54 this iter)
index.html code lines:  3017

LOOP_PROMPT five named targets — STATUS:
  1. src/entities/enemy_ai_tick.js     DONE (iters 666-677, all 12 sub-blocks)
  2. src/systems/bullet_physics.js     DONE (iters 678-681: world-hit, kill, hit-feedback, substep shell)
  3. src/config/keydown_bindings.js    DONE (already in keydown_handler.js; mount call is wiring-only)
  4. src/systems/save_wiring.js        DONE (iter 683: collect/apply callbacks, auto-save, Ctrl+S)
  5. src/systems/screen_interaction.js DONE (iter 682: tryClickWorldScreen, mouse-mode, exit)

All five named targets complete. Continuing extraction of remaining >20-line inline
blocks that are not pure mount-call wiring.

Next scan targets (largest remaining inline blocks in index.html):
  - Mouse-move handler for screen cursor-mode (~25 lines)
  - PointerLock / click-to-lock handlers (~20 lines)
  - WorldBuilder toggle + quest step wiring (~20 lines)

Stop condition check:
  index.html < 3200 lines? NO (currently 3766). Keep extracting.
