# 5DEngine — STATUS

> **Append-only.** Every iteration adds a row. Wakeups read from the bottom.

## Shipped

| Iter | What                                                          | Tests | Commit  |
|------|---------------------------------------------------------------|-------|---------|
| 1    | Bridge math (engine↔render, camera-relative, chase cam)       | 9     | iter1   |
| 2    | Browser engine + boundary transitions                         | 7     | iter2   |
| 3    | Pointer-lock freelook, 4 NPCs, 8 buildings                    | 6     | iter3   |
| 4    | Drivable car (bicycle physics) + mini-map                     | 11    | iter4   |
| 5    | 8 collectible coins + objective + day/night cycle             | 13    | iter5   |
| 6    | Articulated character + procedural ground + sky shader        | 6     | iter6   |
| 7    | ECS-lite: entity envelope + facet/type/app registries          | 23    | iter7   |
| 8    | AABB hitboxes + substepped collision (no tunneling, slide)     | 17    | iter8   |
| 8.5  | Wire collision into index.html (no-walk-thru-walls in browser) | (visual) | iter8.5 |
| 9    | Per-world physics profile (earth/moon/underwater/dreamworld)   | 20    | iter9   |
| 10   | Health facet + damage/heal/regen/death events                  | 24    | iter10  |
| 11   | 7 gun types as data + bullet entity facet                      | 56    | iter11  |
| 12   | Slot inventory + 4 ammo types + 7 gun items + parts            | 34    | iter12  |
| 13   | Inventory popup UI (I to toggle), HUD shows hp/ammo            | (visual) | iter13 |
| 14   | AI enemies (FSM: idle→seek→attack→dead) + patrol               | 19    | iter14  |
| 15   | tickBullets (bullet→target hits) + loot drop on death          | 16    | iter15  |
| 16   | vehicle.js: 11 parts + buildVehicle + compatibility/cost       | 26    | iter16  |
| 17   | crafting.js: 5 recipes + workbench tiers + overflow refund     | 23    | iter17  |
| 18   | planePhysicsStep: throttle/pitch/yaw/altitude + plane build    | 13    | iter18  |
| 19   | shop.js: buy/sell + buyback rate + restock + currency          | 29    | iter19  |
| 20   | net.js: CWP v1.0 envelope + vector clocks + room hub           | 36    | iter20  |
| 21   | multiplayer.js: server tick, client snapshot apply, room iso   | 16    | iter21  |
| 22   | identity.js: profiles + friends list (req/accept/block) + persist | 25 | iter22  |
| 23   | world_graph.js: worlds-as-nodes, portals, merge, traverse      | 26    | iter23  |
| 24   | custom_objects.js: OBJ parser + AABB + auto-register type      | 33    | iter24  |
| 25   | custom_worlds.js: JSON manifest load/export round-trip         | 33    | iter25  |
| 26   | subworlds.js: nested impossible interiors per conviction.pdf   | 24    | iter26  |
| 27   | character.js: 8 slots + presets + randomize + persistence      | 39    | iter27  |

**Total: 584/584 tests passing.**

## Up next (from MASTER_PLAN.md)

- **iter 28** — In-game computer entity (sit + screen takeover).
- **iter 29** — App framework (registry of apps).
- **iter 30** — First 2 apps (ObjectStudio + FriendFinder).
- **iter 31** — Survival mode integration.
- **iter 32** — Creative mode integration.

## Wakeup checklist

1. `cat 5DEngine/MASTER_PLAN.md`
2. `cat 5DEngine/STATUS.md` (this file)
3. `bash 5DEngine/smoke.sh` — must be green before starting
4. Pick next unfinished iter from MASTER_PLAN
5. PLAN → CODE → TEST → REVISE → COMMIT → PUSH
6. Append a row to "Shipped" above
