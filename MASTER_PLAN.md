# 5DEngine — MASTER PLAN

The 3D interface as a game-engine node, one per user, of the interconnected
Planetary OS. Composes with the DWRLD sidecar, speaks the v1.0 CWP wire
protocol, organizes worlds as graph nodes (not coordinates in a parent space).

> **Read every wakeup.** The user is asleep. Before doing anything else,
> read this file + check `STATUS.md` to see what's done and what's next.

## Architectural pillars (non-negotiable)

1. **Registry-only core.** One entity table, one envelope shape
   `{ $header: {$type, $facets[]}, <facet>:{...} }`. Adding a type = one
   parser + one component + 3 registry entries. Never edit a central switch.
2. **Worlds are graph nodes.** Each has its own coordinate origin + physics
   profile. Crossing a portal = world-process handoff, not coordinate math.
   This is how interiors can be larger than exteriors (per `conviction.pdf`).
3. **Sidecar mediates everything external.** Engine never touches disk,
   peers, or AI directly — it calls a local DWRLD runtime sidecar through
   a capability-checked API.
4. **Domain-based authority for multiplayer.** Each spatial region has one
   owner node. Client sends intent, owner ticks, replicas serve reads.
   Three-tier interest: foreground 80m / 60Hz, midground 300m / 5Hz,
   background 1Hz. HINT → PREPARE → COMMIT handoff replaces loading screens.
5. **CWP v1.0 envelope frozen.** `{cwp:"1.0", type, session, vclock,
   sig:Ed25519, payload}`. Extend by adding fields, never break old ones.
   WS today, QUIC later.
6. **Modular per `How to Be Modular.txt`.** Registry over switch. Bridges
   at every persistence boundary. Pointer types are protocol-prefixed strings.

## Loop discipline

For every iteration:
1. **PLAN** — append to `PLAN.md` what this iter delivers + how to verify
2. **CODE** — smallest change that delivers it
3. **TEST** — `test_iter_NN.js` headless unit test
4. **REVISE** — if test red, fix before commit
5. **COMMIT** — small, reversible, descriptive
6. **PUSH** — to `github.com/DRVR777/5DEngine` after every commit

## Iteration roadmap (this is the queue)

### Foundation (iter 7-10) — modular core
- **iter 7**: ECS-lite — single entity table + facet registry + parsers.
  Refactor existing hero/car/NPCs/coins to `$header/$facets` envelopes.
- **iter 8**: Hitboxes + collision (AABB on facets). Can't walk through
  walls. Can jump on objects.
- **iter 9**: Physics profile per world (gravity, time scale). Worlds as
  graph nodes with their own origin.
- **iter 10**: Health facet + damage events.

### Combat + items (iter 11-15)
- **iter 11**: 7 gun types as data (no special-case code) — pistol, smg,
  rifle, shotgun, sniper, rocket, plasma. Bullet entity facet.
- **iter 12**: 4 ammo types as facets. Pickup → inventory.
- **iter 13**: Inventory popup UI. Slot management.
- **iter 14**: AI enemies — simple state machine (idle/seek/attack).
  Enemy entity facets, drop loot on death.
- **iter 15**: Damage + death + respawn.

### Vehicles + crafting (iter 16-19)
- **iter 16**: Car parts as facets — body/engine/wheels combine.
- **iter 17**: Workbench entity — UI to combine parts → craft new entity.
- **iter 18**: Planes (3rd vehicle type, same `vehicle` facet).
- **iter 19**: Shop entity — buy/sell vehicles for in-game currency.

### Networking (iter 20-23)
- **iter 20**: WebSocket server — single-room, broadcast positions.
  Implements CWP v1.0 envelope (no real Ed25519 yet, just the shape).
- **iter 21**: Multi-client world (other players visible).
- **iter 22**: Friends list (sidecar identity stub).
- **iter 23**: World merging — when two friends are within proximity,
  their world processes union via portal.

### Worlds + customization (iter 24-27)
- **iter 24**: Custom object upload (OBJ/GLB/GLTF) — new objects get
  AABB hitboxes auto-generated.
- **iter 25**: Custom worlds — JSON manifest defines entities,
  hot-loaded by registry.
- **iter 26**: Building interiors with nested coordinate system per
  `conviction.pdf`. Doors are portals; interior is a separate world
  process; geometry inside can exceed exterior shell.
- **iter 27**: Character customization (color, body parts).

### In-game computer (iter 28-30)
- **iter 28**: Computer entity. Walk up + E → seated camera, screen
  takes over with edges showing.
- **iter 29**: App framework (registry of apps, simple JS-defined).
- **iter 30**: First two apps:
  - **ObjectStudio** — upload OBJ/GLB/GLTF
  - **FriendFinder** — discover other 5DEngine nodes

### Modes + polish (iter 31+)
- **iter 31**: Survival mode (health, hunger, drop loot)
- **iter 32**: Creative mode (no death, infinite inventory, free build)
- **iter 33+**: Optimization, network tuning, profiling

## Status update protocol

After each iter:
1. Append result to `STATUS.md`
2. Bump `engine_bridge.js` `VERSION` constant
3. Run `bash 5DEngine/smoke.sh` — must be green
4. Commit + push

## Wakeup recovery

If you wake up confused:
1. `cat 5DEngine/MASTER_PLAN.md` — this file
2. `cat 5DEngine/STATUS.md` — what's shipped
3. `bash 5DEngine/smoke.sh` — verify nothing's broken
4. Look at the user's original directive (saved in `5DEngine/USER_DIRECTIVE.md`)
5. Pick the next un-shipped iter from the roadmap, run plan-test-revise

## Reference docs (the why behind the architecture)

- `C:\Users\Quandale Dingle\yearTwo777\decentralizeAiNetwork\conviction.pdf` — nested worlds for impossible interiors
- `C:\Users\Quandale Dingle\yearTwo777\decentralizeAiNetwork\How to Be Modular.txt` — registry-only architecture
- `C:\Users\Quandale Dingle\yearTwo777\decentralizeAiNetwork\DWRLD_META_RUNTIME_SHARED_OS_LAYER.md` — sidecar API
- `C:\Users\Quandale Dingle\yearTwo777\decentralizeAiNetwork\DECENTRALIZED_GAME_SERVER_NETWORKING_STRATEGY.md` — domain authority
- `C:\Users\Quandale Dingle\yearTwo777\decentralizeAiNetwork\GAME_SERVER_NETWORKING.md` — CWP wire protocol

## What "done" means

The user said "code is never perfect; it can only strive to be." Done = each
listed feature has shipped at least a credible v1 with tests passing and
commit pushed. Polish is a forever-loop.
