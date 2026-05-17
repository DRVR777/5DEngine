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
| 70   | music_selector.js: 6 contexts + palette + crossfade + fallbacks | 48   | iter70  |
| 71   | apps/minimap_markers: 6 kinds + filters + add/remove/select    | 35    | iter71  |
| 72   | emotes.js: 13 emotes + 20 emojis + trigger/cancel/tick/expire  | 46    | iter72  |
| 73   | destruction.js: 6 materials + collapse + debris + repair       | 47    | iter73  |
| 73.5 | Fix TDZ renderer bug — move click-to-shoot after const renderer | (loadtest) | tdzfix |
| 74   | city_gen.js: WFC-lite + tile palette + deterministic-by-seed   | 17    | iter74  |
| 75   | cinematics.js: cutscene timeline + 5 tracks + Director + easings | 32  | iter75  |
| 76   | photo_mode.js: 9 filters + gallery + tag/search/favorite/export | 50  | iter76  |
| 77   | input_remap.js: bindings + 3 devices + contexts + conflict detect | 48 | iter77  |
| 78   | accessibility.js: 5 colorblind modes + subtitles + uiScale + motion | 58 | iter78 |
| 79   | ride_along.js: replay buffer + spectator follow/free + catchup | 41    | iter79  |
| 80   | stream_overlay.js: 7 event kinds + chat fade + hype + follow ribbon | 44 | iter80 |
| 81   | weather_damage_bridge.js: lightning/flood/hail → destruction | 28      | iter81  |
| 82   | city_traffic.js: vehicles on CityPlan road graph + intersections | 26   | iter82  |
| 83   | npc_routing.js: A* + blocked nodes + mid-route replan + heap     | 38   | iter83  |
| 84   | mission_dsl.js: 9 objective kinds + cinematics hooks + branches  | 45   | iter84  |
| 85   | photo_export.js: pure-JS PNG encode + tEXt metadata + clipboard  | 35   | iter85  |
| 86   | leaderboards.js: per-board high/low + 5 time windows + filters   | 44   | iter86  |
| 87   | daily_challenges.js: deterministic-by-day picks + grant ledger   | 41   | iter87  |
| 88   | minigame.js: 3 modes + retry budget + leaderboard/daily hooks    | 44   | iter88  |
| 89   | coop_missions.js: vclock sync + per-obj merge + late-join catchup | 45  | iter89  |
| 90   | mod_sandbox.js: signed mods + capability gate + vm exec          | 36   | iter90  |
| 91   | replay_export.js: delta encode + JSON/gzip + roundtrip (11% size)| 45   | iter91  |
| 92   | stats.js: 13 default kinds + lifetime + 30-day rollups + topByKind | 46  | iter92  |
| 93   | notifications.js: 5 cats + 4 prios + sticky + mute + onClick     | 47   | iter93  |
| 94   | voice_envelopes.js: 3 channels + PTT + spatial falloff + mute    | 37   | iter94  |
| 95   | friends.js: request/accept/block + 4 statuses + session invites  | 59   | iter95  |
| 96   | clans.js: 5 ranks + 10 perms + treasury + apps + custom ranks    | 65   | iter96  |
| 97   | trading_post.js: offers + bids + escrow + dispute + resolve      | 53   | iter97  |
| 98   | weather_forecast.js: 7 kinds + 5 climates + nextOf + transitions | 38   | iter98  |
| 99   | currency_exchange.js: limit/market + slippage + depth + matching | 52   | iter99  |
| 100  | **MEGA-REGRESSION: 12 systems wired end-to-end**                 | 42   | iter100 |
| 101  | marketplace_search.js: query DSL + facets + sort + 3 adapters    | 62   | iter101 |
| 102  | pvp_queue.js: 4 modes + skill widening + region + snake-draft   | 53   | iter102 |
| 103  | spectator_director.js: auto-focus + 4 transitions + hysteresis  | 43   | iter103 |
| 104  | radio.js: stations + auto-DJ + no-repeat + context tune         | 42   | iter104 |
| 105  | mission_generator.js: 6 objective templates + diff curve + seed | 46   | iter105 |
| 106  | achievements.js: 5 kinds + chains + 5 rarities + claim reward   | 46   | iter106 |
| 107  | codex.js: lore entries + auto-unlock by event + refs + search   | 55   | iter107 |
| 108  | difficulty_scaler.js: 4-metric performance score + DDA mults    | 39   | iter108 |
| 109  | reputation.js: 7 tiers + ally/enemy cascades + decay + clamps   | 53   | iter109 |
| 110  | caravan.js: NPC convoys + 6-state machine + ambush + escort     | 50   | iter110 |
| 111  | env_hazards.js: fire/flood/shock/gas + spread + extinguish      | 37   | iter111 |
| 112  | weather_music_bridge.js: forecast→radio + hysteresis switching | 36   | iter112 |
| 113  | npc_routine.js: schedule windows + transitions + census + atLoc | 51   | iter113 |
| 114  | crime_police.js: 7 crimes + 6 tiers + chase/arrest/escape       | 67   | iter114 |
| 115  | vendor_restock.js: dynamic pricing + linear/exp restock + buy   | 53   | iter115 |
| 116  | banking.js: savings + loans + credit score + interest accrual   | 41   | iter116 |
| 117  | housing.js: buy/sell/rent + storage + decor + eviction tick     | 59   | iter117 |
| 118  | fishing.js: cast/bite/reel + 5 species + skill XP + bait pref   | 42   | iter118 |
| 119  | cooking.js: recipes + 6 qualities + buff outputs + skill        | 51   | iter119 |
| 120  | farming.js: 4 crops + 4 seasons + 7 phases + yield variance     | 51   | iter120 |
| 121  | pet_ai.js: 7 commands + 5 moods + bond/loyalty + fetch          | 49   | iter121 |
| 122  | race_track.js: laps + checkpoints + ghost replay + leaderboard  | 48   | iter122 |
| 123  | garage.js: 7 part slots + 5 tunings + paint + stat composition  | 54   | iter123 |
| 124  | character_customize.js: 8 slots + face/hair/body + tints       | 66   | iter124 |
| 125  | emote_wheel.js: 8-slot wheel + 3 selectors + cooldown          | 46   | iter125 |
| 126  | mounts.js: 3 species + 5 gaits + stamina + tame + summon       | 55   | iter126 |
| 127  | weather_missions.js: gate quests by kind/intensity/tod/season  | 45   | iter127 |
| 128  | diving.js: breath gauge + currents + wreck loot + risk/reward  | 46   | iter128 |
| 129  | treasure_map.js: clue chain + dig validate + reward grant      | 47   | iter129 |

**Total: 2242/2242 tests passing.**

## Demo serving

The demo uses ES modules which browsers block over `file://`. Run:
`python -m http.server 8765` (in 5DEngine/) → http://localhost:8765/index.html

## Up next

- **iter 130** — Ranged ballistics (drop + windage + zero).
- **iter 131** — Stealth detection (LOS cones + noise).
- **iter 132** — Archery/bow combat (draw + accuracy + quiver).
- **iter 133** — Magic spell system (mana + cooldowns + elements).
- **iter 134** — Climbing/parkour (ledge grab + wall run).
- **iter 135** — Swimming/water physics (buoyancy + depth).

## Wakeup checklist

1. `cat 5DEngine/MASTER_PLAN.md`
2. `cat 5DEngine/STATUS.md` (this file)
3. `bash 5DEngine/smoke.sh` — must be green before starting
4. Pick next unfinished iter from MASTER_PLAN
5. PLAN → CODE → TEST → REVISE → COMMIT → PUSH
6. Append a row to "Shipped" above
