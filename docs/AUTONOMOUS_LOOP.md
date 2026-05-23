# Autonomous Loop

The wakeup prompt is: *"Continue the loop. Read CLAUDE.md and this file. Do
what they say."* Everything specific to the current state lives elsewhere —
read it on each wakeup.

## Audit-driven loop (the COMPATIBILITY KERNEL loop, iter 757+)

The `legacy-mount` facet IS the compatibility kernel — see
`docs/COMPATIBILITY_KERNEL.md` for the full corrected truth.

**Future agents should not invent new architecture.** Run this loop:

  1. `node tools/audit_migration.mjs` — see real coverage.
       HOSTED counts as substrate coverage (legacy bridge IS the path
       until a native facet supersedes it).
  2. Pick the highest-impact mount with status MISSING / DOC-only /
     FACET-only. Domain weight: combat > AI > HUD > vehicles > NPC > meta.
  3. Read its cloned source under `docs/codex/legacy/mount_calls/`
     and `docs/codex/legacy/source/src/...`.
  4. Add ONE entry to `data/spawns/legacy_systems.json` declaring a
     `legacy-system` Thinga with a `legacy-mount` facet whose bindings
     wire get/set/actions to substrate state (DSL listed in CLAUDE.md).
  5. Extend `tools/test_legacy_bridge.mjs` to prove the new mount
     binds + ticks. Where possible, prove it CHANGES STATE correctly
     (a semantic test, not just a bind test).
  6. Run `tools/test_compose_browser_like.mjs` to verify the substrate
     still composes from `data/root.json` cleanly.
  7. `node tools/audit_migration.mjs --update` to refresh the inventory
     coverage block.
  8. Commit. Push. ScheduleWakeup(+420s).

When a NATIVE Ankhor facet ships and proves equivalent behavior:
  - DELETE the matching legacy-system row in `data/spawns/legacy_systems.json`.
  - The audit will reclassify the mount from HOSTED → DONE.
  - Commit the deletion as the authority-flip.

Via-negativa target:
  **Substrate is done when `data/spawns/legacy_systems.json` is empty
  AND every legacy behavior has a proven native facet.**

## Per-wakeup procedure

This procedure is the 10-step migration loop from
`docs/SECOND_ABSTRACTION_PHASE.md`, specialized for our substrate.

  1. Read CLAUDE.md.                         (doctrine)
  2. Read docs/HALT.                         (exit if it exists)
  3. Read docs/codex/MIGRATION_PROGRESS.md.  (state)
  4. Pick the next row marked pending. If none, consult the side
     queue in `docs/codex/HANDOFF_ANKHOR_MIGRATION.md`, then the gap
     list in `docs/SECOND_ABSTRACTION_PHASE.md` ("Missing for true 5D",
     "Missing for true 7D", "Missing for true Ankhor"). If all empty,
     write a final HANDOFF entry and exit clean.
  5. Read the legacy sources listed in that kind's `absorbs` field.
     This is step 2 of the migration loop (preserve current behavior).
  6. Produce only Thingas. Never code that hardcodes substrate state.
     Per the doctrine, that means:
       - a kind-def Thinga                       (data/kinds/<id>.json)
         — this IS the migration contract; record `absorbs`.
       - a tuning Thinga with provenance         (data/tuning/<id>.json)
       - a spawn-set Thinga, children inline     (data/spawns/<id>.json)
       - {ref} entries on the active world       (data/worlds/<id>.json)
       - new facet handlers, one per file, only when novel
         (src/ankhor/facets/<name>.js, registered in facets/index.js)
     NEW spatial facets carry `u, v` from inception (5D-truth rule).
     NEW operational facets present a Vec7 (7D-truth rule). Legacy
     3D-only facets stay 3D until their migration iter adds `u, v`.
  7. Verify: parse every JSON; node --check every JS; npm test passes.
     If it fails, fix or revert. Never push broken state.
  8. Mark the row DONE in MIGRATION_PROGRESS.md with iter number + date.
  9. Commit. One concern per commit. Push.
  10. Shadow-run / authority-flip discipline: do not delete the legacy
      file listed in `absorbs` until the new Thing path proves
      identical behavior. The migration loop's last two steps (flip
      authority; delete legacy) are real steps, not metaphors.
  11. If you completed an iter cleanly, ScheduleWakeup(+420s) with the
      same prompt to continue. If you got stuck, write docs/STUCK.md
      and DO NOT reschedule — exit.

## What counts as stuck

  - The next kind requires a primitive the substrate does not yet have
    (e.g. physics integration, hero state, sound) AND no clean way exists
    to write that primitive as a Thinga in under three new files.
  - npm test fails after a fix attempt and the cause is not obvious.
  - A magic number in the legacy source has no clear provenance.

A stuck entry is honest. A manufactured small iter to keep the streak
alive is a failure mode.

## Stuck format

```
## YYYY-MM-DD HH:MM — iter N stuck on <kind>
Attempted: <one sentence>
Why blocked: <one sentence>
What is needed: <what the human or a fresh session must do>
```

After 3 consecutive STUCK entries, exit and do not reschedule.

## What this loop will NOT do

  - architectural change touching >20 files (CLAUDE.md "Refusals")
  - introduce new top-level abstraction (Thinga it instead)
  - hardcode numbers as fallbacks (the disease, not the cure)
  - shrink the directory mean by extracting comments from Thingas
  - skip writing provenance for extracted numbers
  - bypass the registry, the world, or the kind enum

## Vision anchor

The shape of the work is fixed by `docs/SECOND_ABSTRACTION_PHASE.md`.
That doc names the second abstraction phase, the 5D-truth definition,
the 7D-truth Vec7, the proposal-envelope rule, the adapter rule, the
server-room-as-dashboard convergence, and the gap lists. Each iter
should resolve at least one entry from a gap list or absorb at least
one legacy kind. If neither, it's a STUCK candidate.

## Tactical rule for new facet handlers (per docs/ACTOR_TRAJECTORY.md)

Every NEW handler should be lift-ready for the actor model:

  - Compute the new value as a local; assign last.
  - Cross-Thinga effects: build a `{to, message}` object first, then
    deliver via registry.updateFacet/byKind/etc. That object becomes a
    real `emit` when the lift lands; no design work then, just grep.

If a kind's behavior feels structurally wrong under the current
mutate+reach shape, NOTE it in the iter's commit message. Three such
notes in a row means it's time to pause the kind queue and run the
actor-shape refactor (per the trajectory doc's trigger condition).

## 5D-truth + 7D-truth checklist (per-iter)

Each iter, before commit, ask:

  - Does the new kind have any spatial coordinate? If yes, does the
    facet carry `u, v` (even as `0.0` defaults)? If not, why?
  - Is the new kind operational (process, request, db, agent, backup,
    proposal)? If yes, does it have a `coordinates` Vec7 facet? If not,
    note it and queue the addition.
  - Does any new handler use `u, v` to filter (render, collide, hit,
    replicate)? If yes, the substrate moved one step closer to 5D-truth.
    Note it in the commit; it counts as forward progress on the gap list.
  - Did this iter touch any destructive operation (despawn, write, send)
    that should eventually become a proposal envelope? If yes, the
    handler should already be lift-ready (build `{to, message}` first).

## Continuity beyond this loop

When the migration sequence is exhausted, the next loop runs on a different
docket. The doctrine in CLAUDE.md does not change; only the docket does.
The same substrate that absorbed game.html can absorb:

  - a network protocol      (kinds: packet, peer, route; facets: signed, ttl)
  - an agent council        (kinds: agent, inbox, phase; facets: directive)
  - a hospital ward         (kinds: patient, bed, alert; facets: vitals)
  - a business storefront   (kinds: product, customer, order; facets: price)

Each is the same loop with a different MIGRATION_PROGRESS.md.

## Why this file exists

So the scheduled wakeup prompt can be tiny and stable. If a rule changes,
this file is edited; the schedule keeps firing the same prompt.
