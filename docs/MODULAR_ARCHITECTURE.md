# Modular Architecture — Target Pattern

## The core idea: one entity, many facets

Instead of `Enemy`, `NPC`, `Vehicle`, `Player` as parallel class hierarchies
that each reimplement health, inventory, movement, AI — we have ONE core
`entity` type and N facets that attach optional aspects to it.

```
entity                 ← id, name, type, owner, parent, transform
entity.health          ← hp, maxHp, regen, faction
entity.physics         ← rigidbody, collider, velocity
entity.ai              ← behavior tree, perception, navtarget
entity.inventory       ← items, weight, slots
entity.script          ← attached behavior code
entity.dialog          ← lines, choices, state
entity.economy         ← price, sell_value, owner
entity.render          ← mesh, material, animation
```

A bullet     = entity + physics + render
A coin       = entity + render + economy
An NPC       = entity + health + ai + dialog + render
An enemy     = entity + health + ai + physics + render + inventory
A vehicle    = entity + physics + render + inventory (trunk)
A player     = entity + health + physics + inventory + render + script

## The four engineering wins

1. **New entity types = zero new infrastructure.** Add an entity with the right
   facet composition. Save/load, search, collision, debug-draw all work for free.

2. **New capabilities = one facet.** Want "stamina"? One facet, attachable to
   any entity. Players have it, enemies have it, vehicles can have it as fuel.

3. **Queries are uniform.** "Find all entities with health and faction=enemy"
   becomes one filter call. No type-switch.

4. **Save/load is uniform.** Serialize the core entity + each facet. No bespoke
   serializers per type.

## When to apply this pattern in 5DEngine
- The component system priority (priority #5 in docs/PRIORITIES.md)
- Replacing `mesh.userData.script` with `entity.components.script`
- Replacing `enemies.js` / `vehicles.js` / `npcs.js` parallel hierarchies
- Any new "type of thing in the world" — pause and ask: facets, not class

## Migration path (NOT to be done in one shot)
1. Introduce `Engine.entities` registry as the canonical entity store
2. Wrap existing meshes with a thin entity record (just id + reference)
3. One subsystem at a time, refactor to read facets instead of mesh.userData
4. Old subsystems keep working in parallel — compatibility layer first
5. New entity types created after this point MUST use facets
6. Old types stay until they're cheaper to migrate than to maintain

## Anti-patterns
- One giant entity object with every field optional (lose structure)
- Class inheritance trying to do this (rigid, brittle, see "Vehicle extends Entity")
- EAV-style "every field is a row" (death by joins / map lookups)

The faceted approach lives between extremes: a small fixed core, plus
opt-in typed facets that you join only when you need them.
