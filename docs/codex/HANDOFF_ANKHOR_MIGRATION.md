# Handoff — Ankhor Migration (Main Sequence)

Iter 734 closes the main migration sequence defined in
`docs/codex/MIGRATION_PROGRESS.md`. The 20 rows are DONE. This doc
explains what shipped, what the substrate is now, what is still on
the side queue, and what the next phase (actor-model lift) needs.

## What shipped

All 20 main rows + 7 architectural / arch-extension iters across
iter 706 → 734:

- **Substrate** (iters 712, 714, 715, 716): Thinga-graph composition
  from `data/root.json`, mesh-spec replacing per-kind factory code,
  no `??` fallbacks anywhere in `src/ankhor`, doctrine in CLAUDE.md
  + AUTONOMOUS_LOOP.md + ACTOR_TRAJECTORY.md.

- **Game kinds** (iters 706–725): barrel, speed-orb, coin-drop,
  health-pickup, ammo-pickup, weapon-pickup, armor-shard, crate,
  grenade-crate, hazard-zone (fire+poison), bullet, hero, all 8
  enemy variants (grunt/heavy/fast/poisoner/incendiary/robot/boss/
  sniper), vehicle (car).

- **Bridge kinds** (iters 726, 729–734): bullet hit-detection via
  kinetic-hit, screen (monitor), server-process, docker-container,
  http-request, database, agent-message.

- **Facet handlers** (one file each under `src/ankhor/facets/`):
  position, bob, spin, emissive-pulse, opacity-pulse, magnet,
  pickup-radius, respawn-on-collect, damage-zone, status-zone,
  hero-broadcaster, kinetic-hit, ttl. Plus data-container stubs:
  health, destructible, process-observer, request-stream,
  db-connection, agent-message.

- **Doctrine**: CLAUDE.md (substrate doctrine), AUTONOMOUS_LOOP.md
  (per-wakeup procedure), ACTOR_TRAJECTORY.md (next phase),
  yearTwo777/synthesis/{ANKHOR_ARCHITECTURE,THE_STACK,
  DEVELOPMENT_PHILOSOPHY}.md (philosophy).

## What the substrate is, today

- `index.html` is 66 lines. It boots `src/ankhor/boot.js`, which
  composes the Thinga graph from `data/root.json` recursively
  resolving `{ref}` children.
- Three passes: registerKind from kind-def Thingas → spawn the rest
  → materialize spawn-set children with kind-def defaults injected.
- Render is generic: every visual is described by a `mesh-spec`
  facet on the kind's tuning Thinga; `src/ankhor/build_mesh.js`
  builds the Three.js object from that data.
- Tick loop walks facet handlers in priority order. Hero-broadcaster
  (priority 5) writes hero (x, z) into every facet that declares
  heroU/heroV slots — the substrate's only cross-Thing data flow today.
- No `??` fallback anywhere. World + boot params live in Thingas.
- Tests: 237 files, 3780 tests green through every iter.

## Side queue (not blocking, not done)

Picked up at any future wake; not blocking handoff:

1. **Live WebSocket adapter bridge** — wire the Python adapters
   (process / docker / nginx / db / agent-bus) into the in-browser
   registry as real spawn/despawn events. The kinds + facets are
   ready; this is just the transport.

2. **Screen-render facet** — paint canvas texture on each `screen`
   panel from a `screen-data-source` facet querying registry by kind
   (server-process / http-request / etc.). Likely written in
   lift-ready form OR triggers the actor lift.

3. **Router handler for `agent-message`** — the natural consumer
   that ACTOR_TRAJECTORY.md flagged. Look up recipient agent Thing
   by id, append to inbox. This is the canonical first user of the
   actor lift.

4. **AI facets for enemy variants** (8 variants exist as Things,
   each with stats; behavior absent): ai-fsm, drop-on-death,
   alert-bubble, health-display. `chase-target` shipped iter 737 —
   grunt+heavy now walk toward hero in sight range. Next slices:
   `attack-target` (melee+ranged decisions per variant tuning),
   `wander` (idle drift outside sight), `drop-on-death` (loot table
   already in tuning), `alert-bubble` (canvas sprite over enemy),
   `health-display` (HP-bar plane shrinks with hp).

5. **Vehicle drive controls** — input-controller + rigid-body
   facets. Drone, mech, sidecar variants of vehicle.

6. **Weapon-pickup per-variant tuning split** — the only kind still
   using a legacy factory file. Split rifle/smg/sniper into 3
   tunings; delete `src/ankhor/factories/weapon_pickup.js`. After
   that, `src/ankhor/factories/` can be deleted entirely.

7. **Smoke hazard-zone variant** — needs a `particle-emitter` facet.

8. **Multi-part instance spawn-with-rotation** — current mesh-spec
   doesn't carry per-part rotation. Hazard-zone circles, NPC ring,
   plane geometries should lie flat (rotation.x = -PI/2). Today
   they're position-only.

9. **Tag the substrate baseline** — `git tag substrate-iter-734` so
   the post-handoff history is navigable.

## Next phase — the actor lift

Per `docs/ACTOR_TRAJECTORY.md`:

The handler contract changes from
`(thing, data, dt, registry) → void`
to
`(thing, state, envelope) → { patch, emit }`.

The substrate already has the bones (registry is a scheduler, facet
handlers are step functions). Missing: per-Thinga inbox; patch/emit
return shape; scheduler that applies patches and routes emits;
cross-process transport.

The lift's natural first triggers:
- `agent-message` router (side-queue item 3 above) — literally
  routes messages.
- `screen` paint via `screen-data-source` (item 2) — screen
  subscribes to data; data emits snapshots.
- WebSocket bridge (item 1) — same shape but transport is the wire.

Estimated lift work: 1–2 iters of refactoring (handler signature +
inbox + scheduler), then 1 iter to wire the first consumer (most
likely agent-message router). Existing handlers convert mechanically
(`patch` is the locals we built before assignment; `emit` is the
`{to, message}` envelopes we already built in kinetic-hit and the
zone facets).

## Observations from the main sequence

- The actor-lift trigger never fired during the main sequence (strike
  count 0/3 throughout the 7D-bridge kinds). The mutate+reach pattern
  held shape because no kind this iter actually NEEDED routing —
  every kind we shipped is either a visible Thing or a data
  container. The moment a kind needs to deliver, the lift becomes
  necessary. **Post-handoff update:** strike 1/3 logged at iter 736
  (particle-emitter calls registry.spawn directly). Strike count
  held at 1/3 through iter 737 (chase-target's cross-Thing reach
  into variant tuning was clean — `byKind` lookup, no envelope
  awkwardness).

- Per-variant tuning via `mesh.tuning_ref` emerged organically and
  is now used by weapon-pickup, hazard-zone, bullet, all 8 enemy
  variants, vehicle, npc, screen, server-process, docker-container,
  http-request, database, agent-message. One pattern, twelve kinds.

- The largest source of friction in the loop was Edit-vs-linter race
  on `MIGRATION_PROGRESS.md` and `data/worlds/default.json`. Read
  before each Edit became the rule by iter 720.

- The file-shape race where an external agent rewrote
  `data/tuning/hero.json` into `{$type, $facets}` schema (iter 724)
  was a useful signal — another tool is producing higher-fidelity
  legacy data in a different shape. Future bridge work between
  schemas should reuse those values.

## Continuity

The autonomous loop continues with the side queue and (when
triggered) the actor lift. Stop conditions in CLAUDE.md unchanged:
docs/HALT, three consecutive STUCK entries, or — now newly possible
— side queue empty AND lift complete.

— end —
