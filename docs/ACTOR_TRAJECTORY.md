# Actor Trajectory

The substrate's destination is the actor / process model. This doc
explains why, what changes, and when we make the lift. The doctrine in
CLAUDE.md ("Trajectory" section) summarizes; this is the depth.

## Where we are

A Thinga today is **data + an implicit interpretation**. The interpretation
lives in `src/ankhor/facets/<name>.js` and is looked up by facet name. The
registry's `tick(dt)` walks every Thing carrying each facet and invokes
the handler, which mutates the facet's data and may reach into other
Thingas through `registry.facetData(...)` and `registry.updateFacet(...)`.

This is an imperative actor model — the bones are right but everything
is in-process and mutation-based:

  - The registry IS a scheduler.
  - Facet handlers ARE step functions.
  - Thingas ARE processes, with `facets` as their state shards.
  - There is NO message envelope.
  - There is NO per-Thinga inbox.
  - Cross-Thinga effects are reached for, not sent.

## Where we are going

  **Every Thinga is a process. State is private. Behavior is one
  `step(state, envelope) → { patch, emit }` function. The substrate
  is a scheduler over a message graph.**

That single shape subsumes:

  | run target            | actor form |
  |-----------------------|------------|
  | a barrel              | process with {hp, pos} state; reacts to bullet-hit |
  | an AI agent           | process with mailbox; step is its policy |
  | a network packet      | message in flight between two processes |
  | a 5D world            | process whose state is its child-process ids |
  | a 7D peer             | process whose mailbox is a network socket |
  | a hospital ward       | process whose state is patient sub-processes |
  | a federated council   | graph of processes addressed by Ed25519 id |

Worlds, agents, networks, decentralized topologies all become the same
runtime concern: who steps when, who routes which messages where.

This is the actor model / π-calculus / Erlang BEAM / what `dworld` is
independently converging on with CWP. It is also what the DREAMWORLD
Packet protocol implies. We have been building toward it without
naming it.

## The lift, when it lands

  1. Handler signature changes:
       `(thing, data, dt, registry) → void`     (today)
       `(thing, state, envelope) → {patch, emit}` (after)
       - `state` is the Thinga's private state (today: facet data).
       - `envelope` carries `{ dt, env, messages }`.
       - `patch` is the new state (replaces mutation).
       - `emit` is a list of `{to, message}` outbound messages.
  2. Per-Thinga inbox added to the registry: `Map<thingId, Queue<message>>`.
  3. Scheduler:
       - drains inboxes, calls each Thinga's step,
       - applies patches,
       - routes emits.
  4. Cross-process boundaries become a transport choice — same handler,
     different mailbox backend (local map, WebSocket, CWP wire).
  5. The kind enum stays; mesh-spec stays; tuning Thingas stay; spawn-sets
     stay. Only the handler contract changes.

## What does NOT change

  - The Thinga shape itself: `{id, kind, name, parent?, created_at,
    deleted_at, facets[], children[]}`.
  - Composition by `{ref}` from root.
  - mesh-spec for declarative visuals.
  - The kind-def → tuning → spawn-set → world chain.
  - The doctrine in CLAUDE.md (Refusals, naming, no hardcode).

The actor lift is a **contract change**, not a substrate change.

## When we lift

Trigger condition: the kind queue produces a kind where mutation +
direct registry reach is *uglier* than message passing would be. The
likely triggers:

  - **agent-message** (kind in the sequence). The kind is literally
    "a message." Its handler should route, not mutate. Forcing it into
    today's facet shape will be obviously wrong.
  - **server-process** + **http-request**. These cross the wewon/
    quandaleServer/local boundary. Mutation across a network is a code
    smell; messages cross naturally.
  - **bullet** hit-detection. Once a bullet detects a hit on an enemy,
    the cleanest emit is `{to: enemy.id, message: {kind: "hit", damage}}`.
    The current pattern would have the bullet handler reach into the
    enemy's health facet directly. The actor pattern would emit and let
    the enemy decide how to respond.

The first kind where the actor shape is obviously cleaner triggers the
refactor. Expected window: iter 730–740.

## Tactical rule starting now

Every NEW facet handler should be written in a form that's convertible
to actor shape. Concretely:

  - Compute the new value as a local first; assign last.
  - When emitting an effect on another Thing, write the effect as a
    `{to, message}` object first, then deliver via `registry.updateFacet`.
    The object can be promoted to a real emit later with grep.

```js
// before: pure mutation, hard to lift
tick(thing, data, dt, registry) {
  data.x += data.velocity * dt;
  registry.facetData(targetId, "health").hp -= 10;
}

// transitional: same runtime, lift-ready
tick(thing, data, dt, registry) {
  const newX = data.x + data.velocity * dt;
  data.x = newX;
  const damage = { to: targetId, message: { kind: "damage", amount: 10 } };
  const target = registry.facetData(damage.to, "health");
  if (target) target.hp -= damage.message.amount;
}
```

Same behavior today. When the lift lands, the second block becomes:

```js
step(thing, state, envelope) {
  return {
    patch: { x: state.x + state.velocity * envelope.dt },
    emit:  [{ to: state.targetId, message: { kind: "damage", amount: 10 } }],
  };
}
```

Mechanical conversion. No design work.

## Why not lift now

We have 11 kinds and 12 facets. That is too few to know:

  - What recurring message shapes exist (so we can type the envelope).
  - What scheduling priorities the actor scheduler needs to expose.
  - What backpressure / dead-letter semantics matter.
  - How rendering attaches (probably as a process subscribed to scene
    snapshots, but unclear without screen + ui kinds in).
  - How time itself attaches (deterministic per-tick? per-message?).

Refactoring now hardens guesses. Another ~10 kinds — especially the
server/network ones — will surface the shape. Then the lift is
informed, not speculative.

## Why this is the right order

We built the wrong abstraction first (mutate + reach) on purpose. It
showed us:

  - Which facets recur (position, mesh, ttl, bob/spin, magnet,
    pickup-radius, damage/status-zone, respawn-on-collect, hero-broadcaster).
  - That hero-broadcaster is the *first* actor in disguise — it walks
    other Thingas' facets and pushes data into them. That's an emit.
  - That damage-zone/status-zone push into `pending_hits` / `pending_statuses`
    arrays — those arrays ARE inboxes. The fact that no consumer reads
    them is what tells us the substrate wants the next abstraction.

The dead capability we noticed in the self-assessment (iter 724) was the
signal: handlers know how to *speak* but the substrate doesn't yet know
how to *route*. Routing is what actors add.

## What this doc is for

Future-me on a wakeup reads CLAUDE.md → sees "Trajectory" → reads this
doc → knows two things:

  1. New handlers should be lift-ready (return-shape).
  2. When a kind feels structurally wrong under the current shape,
     don't paper over — that may be the lift trigger. Note it; if it
     persists across three kinds, pause and lift.

— end —
