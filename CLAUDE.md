# CLAUDE.md — substrate doctrine

This is not a game engine. It is a 5D substrate for running Thingas. A 5D
is one node of a larger architecture: many 5Ds run inside a 6D (tenant),
many 6Ds peer across a 7D (planetary mesh). The same Thinga that renders a
barrel in this 5D can be a patient record in a hospital 5D, a packet on the
7D wire, or an agent in a federated council. **The substrate does not know
the difference** — its job is to stay small enough that it doesn't have to.

## What is a Thinga

  { id, kind, name, parent?, created_at, deleted_at, facets[], children[] }

That is the universal recursive container. Six axes (per
`yearTwo777/synthesis/ANKHOR_ARCHITECTURE.md`): identity, content,
classification, relationships, time, execution+trust. Everything that
exists in this system is one of these. Recursion is unbounded: a child
Thinga can have children. A world can contain a world.

## Operations

  PUT     spawn or update a Thinga
  GET     read a Thinga
  INVOKE  tick a facet handler over a Thinga

That is the entire substrate. Every higher-level behavior composes from
these three. Add a fourth only when no composition reaches it.

## Composition

  data/root.json                 single boot entry (kind:root)
  data/worlds/<id>.json          composers (kind:world); reference all included
  data/kinds/<id>.json           schemas (kind:kind-def)
  data/tuning/<id>.json          numbers + provenance (kind:tuning)
  data/spawns/<id>.json          initial instances (kind:spawn-set)

Directories are sharding only. Only the Thinga reference graph is real.
A parent Thinga is the manifest. There are no MANIFEST files.

## Refusals (the disease, not the cure)

  - No number in code if it could come from a Thinga. If it could, it must.
  - No `??` fallback that hides a missing Thinga. Missing data is the bug.
  - No file longer than the directory mean. Twice the mean is wrong.
  - No new top-level abstraction layer. Model it as a Thinga.
  - No bypass of the registry. Look it up; never assume.
  - No magic number extracted from legacy code without a tuning Thinga
    carrying its provenance (source file, line, do_not_optimize: true).
  - No string identifying a kind, facet, or world hardcoded in code that
    is not a substrate primitive.

## What code is allowed to contain

  - control flow, language primitives, library calls
  - values returned by reading a Thinga
  - structural constants imposed by external APIs (Math.PI, a Three.js
    segment count where its semantics are not feel-relevant, an array index)

Anything else is hardcoded substrate state and is a violation.

## Engineering practice

From `yearTwo777/synthesis/DEVELOPMENT_PHILOSOPHY.md`, the load-bearing
axioms applied here:

  - **Via negativa beats addition.** Subtract first. The cleanest code
    comes from removal. If you reach for a new abstraction, ask whether
    removing a constraint would close the gap instead.
  - **The word precedes the world.** Imprecise names collapse fuzzy
    reality into fuzzy code. A well-named Thinga makes its purpose
    obvious. Rename before refactoring.
  - **Coherence before completion.** A coherent attentional state with
    half the time outperforms a fragmented state with twice the time.
    Don't ship from confusion; collapse into clarity first.
  - **Test the state, not just the code.** Before touching a load-bearing
    file, restate to yourself in one sentence what you are about to do.

## The five-dimension lens

  3D    a single rendered world inside a 5D process
  5D    one engine instance (this repo) — hosts one or many 3D worlds
  6D    a tenant (one box, one hospital, one company) — hosts many 5Ds
  7D    the planetary peer mesh — many 6Ds federated by signed packets

A barrel and a hospital ward Thinga differ only in `kind` and `facets`.
The substrate routes them identically. If the substrate ever has to know
"this is a game thing" or "this is a server thing", it has grown a
violation. See `yearTwo777/synthesis/THE_STACK.md`.

## The two entry points

  index.html      the substrate. Loads data/root.json, composes, ticks.
  game.html       the preserved legacy engine + game (2449 lines).
                  Continues to run unchanged until its kinds are absorbed.

The substrate's job is to make game.html unnecessary by reproducing every
behavior it contains as Thingas. When the last kind is absorbed, game.html
becomes archival. Tests still target game.html during migration.

## Continuity

  Per-loop procedure:           docs/AUTONOMOUS_LOOP.md
  Per-kind contract:            docs/codex/specs/
  Migration tracker:            docs/codex/MIGRATION_PROGRESS.md
  Philosophy — substrate:       yearTwo777/synthesis/ANKHOR_ARCHITECTURE.md
  Philosophy — stack:           yearTwo777/synthesis/THE_STACK.md
  Philosophy — practice:        yearTwo777/synthesis/DEVELOPMENT_PHILOSOPHY.md
  Legacy doctrine (iter 705):   docs/CLAUDE.iter-705.md

## Stop conditions

  - docs/HALT exists                          → exit, no reschedule
  - all kinds in MIGRATION_PROGRESS are DONE  → write HANDOFF and exit
  - three consecutive STUCK entries           → exit

## The thesis

If the substrate is right, the same code that renders a barrel renders a
hospital patient, the same protocol that routes a chat message routes a
trade order, the same world config that runs a survival game runs a federated
mesh of company storefronts. The work is to keep the substrate that small.

Build the bone. The body grows around it.
