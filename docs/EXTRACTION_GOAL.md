EXTRACTION_GOAL.md — honest floor analysis

Read this every iter alongside LOOP_PROMPT.md.

═══════════════════════════════════════════════════════════════════════
THE REAL FLOOR
═══════════════════════════════════════════════════════════════════════

What is genuinely unavoidable in index.html — lines that CANNOT be
extracted by any technique and must stay:

  ~80   HTML scaffold + script tags + import map
  ~70   Destructured import from engine_modules (collapses under
          abstraction, not extraction — needs registry/Thing pattern)
  ~30   tick() function shell + requestAnimationFrame driver
  ~40   Bootstrap: null guards, world/WorldState setup, heroInv
  ~5    </script></body></html>
  ───
  ~225  TRUE UNAVOIDABLE FLOOR

Everything above that floor IS extractable. The question is what
technique you use:

  Technique A — Individual tick extraction (what the loop has done
    through iter 665): extract one system into one mountXxx module.
    Effective for blocks >20 lines with clear boundaries.
    Ceiling: ~3200 lines. Below that, too many 1-5 line mount calls.

  Technique B — Factory/aggregator extraction (NEW, unlocked here):
    A `wireAllTicks(state, actions)` function bundles ALL the mount
    calls into one factory in src/systems/wire_all_ticks.js. This
    collapses ~700 lines of mount-call boilerplate into ~20 lines
    in index.html. This IS extraction, not abstraction. The mount
    calls still exist — they just live in the factory, not in
    index.html.

  Technique C — Config extraction: the giant keydown handler config
    object (~120 lines) is just data. Extract it to
    src/config/keydown_bindings.js, import the object, pass it in.
    Zero behavior change, ~100 lines removed.

  Technique D — Comment/doc stripping: once extracted code is gone,
    its EXTRACT-PLAN comments are dead. Strip them. ~100 lines.

═══════════════════════════════════════════════════════════════════════
THE REVISED TARGET
═══════════════════════════════════════════════════════════════════════

  ~500 lines  Achievable with Techniques A + B + C + D combined.
              This is the extraction-only floor.

  ~225 lines  True floor. Requires registry/Thing abstraction to
              reach. That is a separate phase with a separate prompt.
              Do not attempt abstraction during the extraction phase.

═══════════════════════════════════════════════════════════════════════
TECHNIQUE ORDER
═══════════════════════════════════════════════════════════════════════

Phase 1 — Technique A: extract the five named big blocks
  (enemy AI loop sub-blocks, bullet physics, keydown config,
  save wiring, screen interaction). See LOOP_PROMPT.md for the
  ordered list. Target: ~3200 lines.

Phase 2 — Technique B: write wireAllTicks factory
  Once all big blocks are extracted, bundle remaining mount calls
  into a factory. Target: ~2500 lines.

Phase 3 — Techniques C + D: config extraction + comment strip
  Target: ~500 lines.

Phase 4 — Abstraction (separate prompt, separate decision)
  Registry/Thing pattern collapses the remaining wiring.
  Target: ~225 lines.

═══════════════════════════════════════════════════════════════════════
LINE COUNT TRACKING — TWO NUMBERS, NOT ONE
═══════════════════════════════════════════════════════════════════════

Always track BOTH:

  Total lines   = wc -l index.html
                  Includes blanks, comments, section headers.
                  The >=20-lines-per-tick rule uses this number.

  Code lines    = node -e "
    const fs=require('fs');
    const l=fs.readFileSync('index.html','utf8').split('\n');
    const c=l.filter(x=>{const t=x.trim();return t.length>0&&
      !t.startsWith('//')&&!t.startsWith('/*')&&!t.startsWith('*')&&
      !t.startsWith('<!--')&&!t.startsWith('-->')&&t!='*/';});
    console.log('Total:',l.length,'Code:',c.length);
  "
                  Excludes comments and blanks.
                  The real extraction progress metric.
                  The floor targets below are in CODE lines.

Comments are documentation, not bloat. Write them freely.
They do NOT count against the per-tick shrink target.

═══════════════════════════════════════════════════════════════════════
FLOOR TARGETS (in CODE lines)
═══════════════════════════════════════════════════════════════════════

  Phase 1 complete: ~2600 code lines  (big blocks extracted)
  Phase 2 complete: ~1800 code lines  (factory/aggregator)
  Phase 3 complete: ~400  code lines  (config + comment strip)
  Phase 4 complete: ~225  code lines  (abstraction, separate phase)

═══════════════════════════════════════════════════════════════════════
CURRENT STATUS
═══════════════════════════════════════════════════════════════════════

As of iter 665: 4086 total lines. Phase 1 in progress.
Next: enemy AI loop sub-extractions (iter 666+).

The loop is in Phase 1 until all five named targets in LOOP_PROMPT.md
are done. Do not start Phase 2 early.
