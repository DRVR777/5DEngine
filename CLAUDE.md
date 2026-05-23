# CLAUDE.md — substrate doctrine

This is not a game engine. It is a **5D substrate** for running Thingas.
A 5D is one node of a larger architecture: many 5Ds run inside a 6D
(tenant), many 6Ds peer across a 7D (planetary mesh). The same Thinga
that renders a barrel in this 5D can be a patient record in a hospital 5D,
a packet on the 7D wire, or an agent in a federated council. **The
substrate does not know the difference** — its job is to stay small
enough that it doesn't have to.

We are in the **second abstraction phase**: every legacy hardcoded
system is being absorbed into Things + facets + tuning + spawns +
handlers. The first phase (collapsing `index.html` to 66 lines) is
done. The second phase is what each iter advances. The destination
isn't a smaller file; it's one substrate. See
`docs/SECOND_ABSTRACTION_PHASE.md` for the full vision and the gap
list ("Missing for true 5D", "Missing for true 7D", "Missing for true
Ankhor"). Read it; the gap list IS the long-form side queue.

## What is a Thinga

  { id, kind, name, parent?, created_at, deleted_at, facets[], children[] }

That is the universal recursive container. Six axes (per
`yearTwo777/synthesis/ANKHOR_ARCHITECTURE.md`): identity, content,
classification, relationships, time, execution+trust. Everything that
exists in this system is one of these. Recursion is unbounded: a child
Thinga can have children. A world can contain a world.

The shape extends, never branches: a Thinga can grow a `coordinates`
field (Vec7 below) without becoming a different Thinga. New axes are
data, not classes.

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

A kind file is not metadata — it is a **migration contract**. It says:
"this old hardcoded behavior is now represented by data + facets," and
the `absorbs` field records which legacy files it replaces. Migration
is complete for a kind when its `absorbs` files can be deleted with no
behavior loss.

## The 5D-truth requirement

The substrate is named 5D, but most spatial Thingas still carry only
`{x, y, z}`. That is **5D in name only**. The real definition (from
`docs/SECOND_ABSTRACTION_PHASE.md`) is:

  > Discrete stacking ≠ higher geometric dimension.
  > Continuous orthogonal freedom = higher dimension.

A true 5D engine means every spatial Thinga lives at `(x, y, z, u, v)`
with `u, v` continuous and orthogonal to `x, y, z`. Then:

  - **render** filters the visible set by `|cam.u − obj.u| < U_BAND`
    and `|cam.v − obj.v| < V_BAND`
  - **collision** is 3D broadphase + `u, v` filter + narrow 3D
  - **combat** requires phase alignment unless the weapon is phase/keyed
  - **netcode** packets carry `u, v` and `velocity_uv`
  - **interest management** scopes replication by `u, v` band

These are not separate systems. They are the same `u, v` test reused
in every place that decides what is real to whom.

The `position5d` facet (replacing `position` over time, additively —
keep `x, y, z` semantics intact) is the canonical first carrier. New
spatial facets carry `u, v` from day one. Existing spatial facets get
`u, v` added as defaults of `0.0` (legacy slice) before any handler
uses them to filter, so nothing breaks during the transition.

## The 7D-truth requirement

Every **operational** Thinga (process, request, database, repo, agent,
backup, proposal) carries a `Vec7`:

  { x, y, z, u, v, w, t }

Default axis meanings (configurable, not hardcoded):

  x = identity / local position
  y = dependency
  z = runtime_depth
  u = world_membership
  v = machine_membership
  w = network_replication
  t = time / version

7D is one address system for game Things, worlds, servers, processes,
services, databases, repos, agents, network peers, backups, logs,
proposals, and deployment manifests. The 5D engine is the visual
control surface for that 7D graph; the in-world computer room screens
are **real terminals into the operational graph**, not props.

Cross-axis rule: a Thinga can present a Vec7 even when only some axes
are meaningful for it. A barrel's `w` and `t` are real but trivial. A
proposal's `x, y, z` are real but rendered as a glyph on a screen.

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
  - No "this is a game thing" or "this is a server thing" branch in the
    substrate. The substrate routes both identically.
  - No spatial coordinate that is `{x, y, z}` only in a NEW facet —
    new spatial facets are 5D from inception. Legacy 3D facets stay
    3D until their migration iter adds `u, v`.

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

## The migration loop (one kind at a time)

From `docs/SECOND_ABSTRACTION_PHASE.md`:

  1. Pick one legacy system.
  2. Preserve current behavior with tests/snapshot.
  3. Move constants into `data/tuning/<id>.json` with provenance.
  4. Define the kind in `data/kinds/<id>.json` (the migration contract).
  5. Define instances in `data/spawns/<id>.json`.
  6. Move behavior into a facet handler (one file per facet).
  7. Move rendering into a mesh factory (mesh-spec preferred).
  8. Shadow-run against legacy.
  9. Flip authority.
  10. Delete or archive the legacy file only when proof passes.

Do not delete legacy authority until the new Thing path proves
identical behavior. The `absorbs` list is the proof contract.

## The five-dimension lens (extended)

  3D    a single rendered slice of a 5D world
  5D    one engine instance (this repo) — Things in (x,y,z,u,v)
  6D    a tenant (one box, one hospital, one company) — many 5Ds
  7D    the planetary peer mesh — Things in Vec7 = (x,y,z,u,v,w,t)

A barrel and a hospital ward Thinga differ only in `kind` and `facets`.
The substrate routes them identically. If the substrate ever has to
know "this is a game thing" or "this is a server thing", it has grown
a violation. See `yearTwo777/synthesis/THE_STACK.md`.

But stop thinking of it as a ladder. It's **one recursive graph** with
different projection modes:

  5D view: render playable world
  6D view: render customer/server control surface
  7D view: render global operator mesh

Same Things. Different clearance. Different slice.

## Adapters and proposals (7D rules)

  - **Every external system becomes an adapter.** The engine does not
    directly know Linux, Docker, Postgres, Nginx, GitHub, dwrld. It
    knows: "adapter emits Things." Process adapter emits process
    Things; nginx adapter emits http-request Things; database adapter
    emits database/table Things.
  - **Every destructive action becomes a proposal.** No operator click
    mutates production directly. The click creates an `ActionProposal`
    Thing with risk, approvers, verification plan, rollback plan, and
    signature hash. Execution waits on approval. The dashboard observes
    and proposes; it does not blindly mutate.

These are 7D substrate rules. The 5D game does not need them — but
the moment the in-world screen becomes a real terminal into the
operational graph (the convergence point), the proposal envelope is
how a player triggers anything destructive.

## The two entry points

  index.html      the substrate. Loads data/root.json, composes, ticks.
  game.html       the preserved legacy engine + game (2449 lines).
                  Continues to run unchanged until its kinds are absorbed.

## The legacy bridge (the base layer, iter 757)

The substrate HOSTS legacy `mount*` subsystems instead of reimplementing
them up-front. Every legacy module has the uniform shape

    export function mountX({ get, set, actions }) { return { tick }; }

The `legacy-system` kind + `legacy-mount` facet wrap that contract.
A spec declares `module_url`, `export`, `tick_args`, and `bindings`
written in a tiny DSL:

    $kind:<kind>[<i>]/<facet>/<field>     Nth Thing of kind
    $tuning:<name>/<facet>/<field>        tuning Thinga by name
    $thing:<id>/<facet>/<field>           exact id
    $const:<jsonValue>                    literal
    $noop                                 do-nothing function
    $log:<prefix>                         console.log with prefix
    $global:<expr>                        document/window/performance

Tick-arg atoms (`@dt`, `@nowSec`, `@perfMs`, `@hero`, `@scene`,
`@THREE`, `@camera`) are resolved each frame.

Every cloned mount under `docs/codex/legacy/mount_calls/` can be
brought into the substrate as one entry in
`data/spawns/legacy_systems.json` — no new facet code per mount.
Native facets still ship over time; each native facet that proves
equivalent behavior earns the **deletion** of its legacy-system
row (authority-flip). Substrate is "done" when that file is empty.

The substrate's job is to make game.html unnecessary by reproducing
every behavior it contains as Thingas. When the last kind is absorbed,
game.html becomes archival. Tests still target game.html during
migration.

## Trajectory (actor model)

What we run today is a **degenerate actor model**. The registry IS a
scheduler. Facet handlers ARE step functions. But handlers mutate facet
data in place and reach other Thingas through the registry directly —
there is no message envelope, no inbox per Thinga, no separation
between "compute new state" and "deliver effects."

The next abstraction up is the explicit one:

  **Every Thinga is a process. State is private. Behavior is one
  `step(state, envelope) → { patch, emit }` function. The substrate
  is a scheduler over a message graph.**

That shape subsumes worlds, agents, network packets, hospital wards,
federated councils — same runtime, different mailboxes. A 5D/6D/7D
peer is the same Thinga with a different transport. See
`docs/ACTOR_TRAJECTORY.md`.

We don't refactor to it yet. We don't yet have enough breadth of kinds
to know what messages recur or what the scheduler needs to expose. The
network/server kinds (server-process, http-request, agent-message)
will force the shape. Until then:

  **Tactical handler rule (starting iter 725):** new facet handlers
  prefer the return-shape over pure mutation. Compute the patch as a
  local; assign; later, the assignment becomes an `emit`. This makes
  the eventual actor-model lift mechanical, not a rewrite.

  **Strike-3 rule:** when 3 handlers feel structurally wrong under
  mutate+reach (the envelope wants to be a return, not an inline
  apply), do the lift.

## Continuity

  Vision (long-form):           docs/SECOND_ABSTRACTION_PHASE.md
  Per-loop procedure:           docs/AUTONOMOUS_LOOP.md
  Per-kind contract:            docs/codex/specs/
  Migration tracker:            docs/codex/MIGRATION_PROGRESS.md
  Handoff (main sequence):      docs/codex/HANDOFF_ANKHOR_MIGRATION.md
  Trajectory (actor model):     docs/ACTOR_TRAJECTORY.md
  Philosophy — substrate:       yearTwo777/synthesis/ANKHOR_ARCHITECTURE.md
  Philosophy — stack:           yearTwo777/synthesis/THE_STACK.md
  Philosophy — practice:        yearTwo777/synthesis/DEVELOPMENT_PHILOSOPHY.md
  Legacy doctrine (iter 705):   docs/CLAUDE.iter-705.md
  Pre-5D-truth doctrine (737):  docs/CLAUDE.iter-737.md

## Stop conditions

  - docs/HALT exists                          → exit, no reschedule
  - all kinds in MIGRATION_PROGRESS are DONE  → write HANDOFF and exit
  - three consecutive STUCK entries           → exit

## The thesis

If the substrate is right, the same code that renders a barrel renders
a hospital patient, the same protocol that routes a chat message routes
a trade order, the same world config that runs a survival game runs a
federated mesh of company storefronts.

You are done when the old engine can be reconstructed from data, and
when the in-world screen is a real view over the 7D operational graph.

The target is not a smaller file. **The target is one substrate.**

Build the bone. The body grows around it.
