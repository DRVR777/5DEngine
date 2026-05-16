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
| 28   | computer.js: in-game PC entity, sit/stand/launch + fileSystem  | 39    | iter28  |
| 29   | app_framework.js: register/instantiate/render/input/ipc        | 23    | iter29  |
| 30   | apps/object_studio.js + apps/friend_finder.js (with IPC)       | 27    | iter30  |
| 31   | game_mode.js: survival/creative/peaceful as data rules         | 34    | iter31  |
| 32   | interest.js: 3-tier interest mgmt (80m/300m/∞ at 60/5/1Hz)     | 28    | iter32  |
| 33   | domain.js: sector grid + HINT/PREPARE/COMMIT handoff           | 27    | iter33  |
| 34   | manifest.js: signed content-addressed manifests + dep graph    | 32    | iter34  |
| 35   | sidecar.js: capability-checked storage/pubsub/identity         | 30    | iter35  |
| 36   | app_store.js + chat.js + world_browser.js (publish/install)    | 41    | iter36  |
| 37   | Browser viz: AI enemy + computer entity + hp bar + prompts     | (visual) | iter37 |
| 38   | debug.js: packet recorder + replay + hub instrumentation       | 28    | iter38  |
| 39   | apps/music_player + settings + file_manager (with IPC)         | 38    | iter39  |
| 40   | Full-session integration test (12 modules end-to-end)          | 24    | iter40  |
| 41   | Performance benchmarks across 7 hot paths                      | 7     | iter41  |
| 42   | Browser polish: crosshair + click-to-shoot + bullets + flash   | (visual) | iter42 |
| 43   | apps/calculator + apps/terminal (REPL with custom commands)    | 44    | iter43  |
| 44   | mod_loader.js: signed manifests + sandbox + quarantine         | 29    | iter44  |
| 45   | save_load.js: world snapshot/restore + slot manager + signed   | 33    | iter45  |
| 46   | audio.js: 4-route mixer + adapter + spatialization + events    | 44    | iter46  |
| 47   | particles.js: emit/tick/retire + 4 presets + bounce + cap      | 30    | iter47  |
| 48   | boss.js: 3-phase boss + 4 telegraphed attacks (cone+stun)      | 37    | iter48  |
| 49   | pathfinding.js: A* grid + diagonal + corner-cut block + smooth | 34    | iter49  |
| 50   | apps/network_monitor: filter, pause, view-lines, IPC stats     | 33    | iter50  |
| 51   | Vehicle parts: motorcycle, boat, helicopter (9 new parts)      | 31    | iter51  |
| 52   | weather.js: 6 presets + Markov transitions + particle wiring   | 36    | iter52  |
| 53   | voice_chat.js: WebRTC signaling state machine over CWP         | 40    | iter53  |
| 54   | traffic.js: road network + BFS routes + fleet auto-respawn     | 40    | iter54  |
| 55   | quests.js: 5 objective kinds + chains + repeatable + custom    | 40    | iter55  |
| 56   | player_profile.js: 11 stats + 8 achievements + level + persist | 57    | iter56  |
| 57   | fog_of_war.js: visible/explored grid + waypoints + TTL         | 44    | iter57  |
| 58   | minigames.js: hub + tic-tac-toe + coin-flip + RPS register     | 34    | iter58  |
| 59   | leaderboard.js: per-stat boards + Hub broadcast + ts dedup     | 46    | iter59  |
| 60   | anticheat.js: 5 validators + strikes/throttle/ban + audit log  | 37    | iter60  |
| 61   | economy.js: per-world currencies + rates + tax + cross-convert | 52    | iter61  |
| 62   | npc_schedule.js: 3 templates + activityAt + day/night routines | 45    | iter62  |
| 63   | trade.js: P2P escrow + counter + lock + atomic swap + timeout  | 45    | iter63  |
| 64   | factions.js: 6 rep tiers + cross-faction cascades + access     | 52    | iter64  |
| 65   | chat.js: rooms + @ mentions + mute + history + broadcast       | 52    | iter65  |
| 66   | mod_marketplace.js: list/buy/settle + revenue split + reviews  | 60    | iter66  |
| 67   | portal_gen.js: 6 strategies (ring/star/MST/full/weighted/kNN)  | 41    | iter67  |
| 68   | weather_damage.js: lightning + flood + hail + height bonus     | 30    | iter68  |
| 69   | visibility.js: ambient + light field + carry-torch + classify  | 38    | iter69  |

**Total: 2066/2066 tests passing.**

## Up next

- **iter 70** — Ambient music selector (per-world soundtrack).
- **iter 71** — Minimap markers app.
- **iter 72** — Emoji + emote system.

## Wakeup checklist

1. `cat 5DEngine/MASTER_PLAN.md`
2. `cat 5DEngine/STATUS.md` (this file)
3. `bash 5DEngine/smoke.sh` — must be green before starting
4. Pick next unfinished iter from MASTER_PLAN
5. PLAN → CODE → TEST → REVISE → COMMIT → PUSH
6. Append a row to "Shipped" above
