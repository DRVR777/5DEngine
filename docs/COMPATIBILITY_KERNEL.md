# COMPATIBILITY KERNEL — the corrected truth

_Recorded 2026-05-23, iter 763.5, from the user's framing._

The `legacy-mount` facet (iter 757) is **the compatibility kernel**.

It lets old systems shaped like

```js
mountSomething({ get, set, actions }) {
  return { tick }
}
```

run inside the new Thing registry. That means you do **not** need to
rewrite all 165 systems blindly. You can wrap them first, prove they
run, then gradually replace them.

## What is happening now

```text
Legacy playable game
  ↓
game.html + 165 mount* systems
  ↓
mechanical audit + source snapshot
  ↓
legacy-mount bridge
  ↓
Ankhor Thing/facet substrate
  ↓
native migration one mount at a time
```

The key realization:

```text
The game plays because game.html works.
The substrate becomes real only when it can host or reproduce game.html behavior.
```

So the plan is no longer vague abstraction. It is now measurable:

```text
Substrate complete = data/spawns/legacy_systems.json becomes empty
```

Meaning every legacy mount has either:

1. been hosted through the legacy-mount bridge, or
2. been replaced by a proven native Ankhor facet (and its legacy row deleted)

## The architecture shift

Before this iter, the framing was:

```text
New substrate = elegant but not fully playable
Legacy game   = playable but hardcoded
```

After:

```text
Legacy game behavior can be imported into the substrate.
```

That creates the migration loop:

```text
clone legacy → audit legacy → host legacy → test legacy →
  replace legacy → delete bridge row
```

## The DSL is the real control layer

The bridge DSL now covers:

```text
$kind / $tuning / $thing      read state from Things
$write / $set facet field     write state into Things
$input / $inputAny / $pointer read controls
$emit                         actions spawn substrate Things
$write / $add                 actions write or accumulate
$kindPos                      translate substrate {x,y,z} to legacy {u,y,v}
$log / $noop / $const         deterministic stubs
$global                       limited DOM/window
```

A legacy system can now: read hero HP, read input, write stamina,
spawn particles, damage hero, emit effects — without custom per-
system adapter code.

## What this means for 5D / 7D

### 5D engine path

Make every playable object a Thing first:

```text
hero · vehicle · barrel · bullet · pickup · enemy ·
particle · portal · world-screen
```

Then every spatial Thing eventually gets `position5d = x,y,z,u,v`
per `docs/SECOND_ABSTRACTION_PHASE.md`. The bridge gets you
playability first; the native migration gets you real 5D after.

### 7D engine path

The same bridge pattern becomes the server pattern:

```text
legacy mount system → legacy-mount facet
Linux process       → process adapter facet
Postgres database   → database adapter facet
Nginx log           → request adapter facet
dwrld peer          → peer adapter facet
agent message       → agent adapter facet
proposal            → proposal facet
```

The real principle:

```text
Every outside system becomes a Thing through an adapter.
Every old game system becomes a Thing through legacy-mount.
Every future system becomes native facets.
```

## What should happen next (the loop)

Future agents should not invent new architecture. Run this loop:

```text
1. Run tools/audit_migration.mjs
2. Count: native DONE / hosted-through-legacy / missing
3. Pick the highest-impact missing mount
4. Add one legacy-system spec
5. Prove it binds (tools/test_legacy_bridge.mjs)
6. Prove it changes state correctly
7. Commit
8. Repeat
```

Then later, when a native facet ships:

```text
hosted legacy mount
  ↓
native Ankhor facet
  ↓
delete legacy-system row
```

## The real status

```text
Old truth:
  "The substrate is the new game."

Corrected truth:
  "The substrate is the new operating layer that must first host the
   old game."

Final truth:
  "The old game disappears only when every legacy behavior has become
   a Thing/facet behavior."
```

This is how you actually get there.

— recorded 2026-05-23
