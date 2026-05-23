# Autonomous Loop

The wakeup prompt is: *"Continue the loop. Read CLAUDE.md and this file. Do
what they say."* Everything specific to the current state lives elsewhere —
read it on each wakeup.

## Per-wakeup procedure

  1. Read CLAUDE.md.                         (doctrine)
  2. Read docs/HALT.                         (exit if it exists)
  3. Read docs/codex/MIGRATION_PROGRESS.md.  (state)
  4. Pick the next row marked pending. If none, write
     docs/codex/HANDOFF_ANKHOR_MIGRATION.md and exit clean.
  5. Read the legacy sources listed in that kind's `absorbs` field.
  6. Produce only Thingas. Never code that hardcodes substrate state.
     Per the doctrine, that means:
       - a kind-def Thinga                       (data/kinds/<id>.json)
       - a tuning Thinga with provenance         (data/tuning/<id>.json)
       - a spawn-set Thinga, children inline     (data/spawns/<id>.json)
       - {ref} entries on the active world       (data/worlds/<id>.json)
       - new facet handlers, one per file, only when novel
         (src/ankhor/facets/<name>.js, registered in facets/index.js)
  7. Verify: parse every JSON; node --check every JS; npm test passes.
     If it fails, fix or revert. Never push broken state.
  8. Mark the row DONE in MIGRATION_PROGRESS.md with iter number + date.
  9. Commit. One concern per commit. Push.
  10. If you completed an iter cleanly, ScheduleWakeup(+900s) with the
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
