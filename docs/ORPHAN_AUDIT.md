# 5DEngine — Orphan File Audit (D1)
Generated iter 405. 143 total src/ files. 42 wired into index.html. 101 not wired.

---

## Classification Key
- **WIRED** — imported/loaded by index.html (active, do not touch)
- **CROSS-REF** — not in index.html but imported by another src/ file
- **FUTURE** — planned feature (in FUTURE_FEATURES.md or multiplayer_plan.md)
- **SCAFFOLD** — valid module, wirable when its feature is built
- **DUPLICATE** — near-identical sibling file (D2/D3 issues flagged separately)
- **ORPHAN** — no known caller; purpose unclear; safe-delete candidate

---

## Wired into index.html (42 files — DO NOT TOUCH)
```
src/activities/crafting.js       src/audio/audio.js
src/audio/audio_webaudio.js      src/audio/sfx.js
src/audio/sound_zones.js         src/bridges/engine_bridge.js
src/bridges/engine_browser.js    src/bridges/local_db_bridge.js
src/builder/builder.js           src/builder/scripting.js
src/combat/guns.js               src/combat/health.js
src/config/game_config.js        src/core/dev_console.js
src/core/engine.js               src/core/event_bus.js
src/devices/devices.js           src/devices/wires.js
src/entities/behavior_tree.js    src/entities/entity.js
src/physics/physics.js           src/progression/achievements.js
src/progression/high_score.js    src/render/camera_spine.js
src/render/gltf_loader.js        src/render/particle_system.js
src/render/screen_mesh.js        src/render/vfx.js
src/systems/a_star.js            src/systems/cutscene.js
src/systems/inventory.js         src/systems/registry.js
src/systems/save_load.js         src/systems/status_effects.js
src/systems/trigger_zones.js     src/systems/wave_manager.js
src/ui/hud_notifications.js      src/ui/minimap.js
src/world/day_night.js           src/world/rain.js
src/world/terrain.js             src/world/world_data.js
```

---

## Duplicates — Flagged (D2 / D3)

| File A | File B | Action |
|--------|--------|--------|
| src/progression/leaderboard.js | src/progression/leaderboards.js | D2 — keep one, merge or delete other |
| src/activities/minigame.js | src/activities/minigames.js | D3 — keep one, merge or delete other |
| src/render/particles.js | src/render/particle_system.js + src/render/vfx.js | Investigate — particles.js may predate particle_system; compare APIs |

---

## Active (indirectly used by other src/ files)

| File | Referenced by | Notes |
|------|---------------|-------|
| src/devices/computer.js | src/devices/devices.js (conceptually) | Computer app framework; wirable via E-key opener |
| src/devices/manifest.js | src/devices/devices.js (conceptually) | Signed manifest for device assets |
| src/social/net.js | src/social/multiplayer.js | Hub/relay protocol; used by abstract multiplayer layer |

---

## Future — Planned Features

### Multiplayer / Social (F2, F3, F4 in FUTURE_FEATURES.md)
| File | Notes |
|------|-------|
| src/social/multiplayer.js | Abstract Hub/WorldState layer — separate from inline _mp IIFE |
| src/social/net.js | Protocol layer for multiplayer hub |
| src/social/chat.js | In-game text chat |
| src/social/clans.js | Clan/guild system |
| src/social/friends.js | Friend list (localInternetComms integration target) |
| src/social/coop_missions.js | Co-op mission objectives |
| src/social/pvp_queue.js | PvP matchmaking queue |
| src/social/emotes.js | Player emote actions |
| src/social/emote_wheel.js | Radial emote picker UI |
| src/social/factions.js | Faction alignment system |

### Economy (future economy update)
| File | Notes |
|------|-------|
| src/economy/economy.js | Core currency + inflation model |
| src/economy/shop.js | Static shop interface |
| src/economy/banking.js | Account + interest system |
| src/economy/trade.js | Player-to-player trade |
| src/economy/trading_post.js | Persistent trading post |
| src/economy/app_store.js | In-game OS app store |
| src/economy/currency_exchange.js | Multi-currency conversion |
| src/economy/marketplace_search.js | Search/filter marketplace |
| src/economy/mod_marketplace.js | Mod distribution store |
| src/economy/vendor_restock.js | NPC vendor restock logic |

### Weather / World (future world expansion)
| File | Notes |
|------|-------|
| src/world/weather.js | Extended weather system |
| src/world/weather_damage.js | Weather-based damage to entities |
| src/world/weather_damage_bridge.js | Bridge: weather damage → health system |
| src/world/weather_forecast.js | Dynamic weather timeline |
| src/world/weather_missions.js | Missions gated by weather conditions |
| src/world/weather_music_bridge.js | Weather → music selector bridge |
| src/world/city_gen.js | Procedural city generation |
| src/world/city_traffic.js | AI traffic system for city |
| src/world/domain.js | Domain/zone ownership system |
| src/world/env_hazards.js | Environmental hazard zones |
| src/world/fog_of_war.js | Fog-of-war reveal system |
| src/world/portal_gen.js | Portal/teleport zone generator |
| src/world/subworlds.js | Sub-world layer management |
| src/world/world_graph.js | Connectivity graph of world zones |

### Vehicles (future vehicle expansion)
| File | Notes |
|------|-------|
| src/vehicles/traffic.js | AI traffic cars |
| src/vehicles/mounts.js | Rideable animal mounts |
| src/vehicles/sidecar.js | Vehicle attachment (sidecar) |
| src/vehicles/visibility.js | Vehicle LoD / culling |

### Progression (future season/ranking)
| File | Notes |
|------|-------|
| src/progression/quests.js | Quest system (wirable to wave_manager) |
| src/progression/reputation.js | Faction reputation tracking |
| src/progression/daily_challenges.js | Daily/weekly challenge system |
| src/progression/interest.js | Economy interest calculation |
| src/progression/player_profile.js | Persistent cross-session player profile |

---

## Scaffold — Valid modules, wire when ready

| File | Wire-when | Notes |
|------|-----------|-------|
| src/entities/ai.js | AI overhaul | Expanded AI beyond behavior_tree.js |
| src/entities/boss.js | Boss system refactor | Boss AI scaffold |
| src/entities/character.js | Character system | Base character class |
| src/entities/character_customize.js | Cosmetics feature | Skin/gear customizer |
| src/entities/npc_routine.js | NPC daily routine | Time-of-day NPC behavior |
| src/entities/npc_routing.js | NPC pathfinding | Grid-based NPC routing |
| src/entities/npc_schedule.js | NPC schedule | Day/night NPC schedule |
| src/entities/pet_ai.js | Pet feature | Companion AI |
| src/entities/vehicle.js | Vehicle overhaul | OOP vehicle base class |
| src/audio/music_selector.js | Music system | Dynamic music selection |
| src/audio/voice_chat.js | Multiplayer audio | Voice chat (needs WebRTC) |
| src/audio/voice_envelopes.js | Voice chat | ADSR envelopes for voice |
| src/builder/custom_objects.js | Builder feature | Custom object spawning |
| src/builder/custom_worlds.js | Builder feature | Custom world templates |
| src/combat/destruction.js | Destructibles | Destructible environment |
| src/systems/accessibility.js | Accessibility pass | A11y settings |
| src/systems/anticheat.js | Multiplayer | Client-side sanity checks |
| src/systems/cinematics.js | Story mode | Cinematic sequence system |
| src/systems/codex.js | Lore feature | In-game encyclopedia |
| src/systems/crime_police.js | Open world | Wanted level / police |
| src/systems/debug.js | Dev tooling | Extended debug overlay |
| src/systems/difficulty_scaler.js | Difficulty | Dynamic difficulty adjustment |
| src/systems/game_mode.js | F1 feature | Game mode select (FUTURE F1) |
| src/systems/identity.js | Accounts | Player identity/auth |
| src/systems/input_remap.js | Settings | Key rebinding |
| src/systems/notifications.js | UI | System notification toasts |
| src/systems/pathfinding.js | AI | Alternative pathfinding |
| src/systems/photo_export.js | Photo mode | Export photo to file |
| src/systems/photo_mode.js | Photo mode | Photo mode camera rig |
| src/systems/physics_profile.js | Physics | Physics preset profiles |
| src/systems/replay_export.js | Replay | Export gameplay replay |
| src/systems/spectator_director.js | Multiplayer | Spectator camera |
| src/systems/stats.js | Analytics | Session stats tracking |
| src/ui/app_framework.js | DWRLD OS | OS app plugin system |
| src/ui/radio.js | In-world radio | Radio UI (already wired in-game via APPS.radio) |
| src/ui/stream_overlay.js | Streaming | Twitch overlay layer |
| src/activities/caravan.js | Exploration | Travelling merchant system |
| src/activities/cooking.js | Survival | Cooking/crafting food |
| src/activities/diving.js | Exploration | Underwater diving |
| src/activities/farming.js | Survival | Crop farming system |
| src/activities/fishing.js | Exploration | Fishing minigame |
| src/activities/garage.js | Vehicles | Vehicle garage/upgrade |
| src/activities/housing.js | Exploration | Player housing |
| src/activities/loot.js | Combat | Loot drop system |
| src/activities/mission_dsl.js | Story mode | Mission scripting DSL |
| src/activities/mission_generator.js | Procedural | Procedural mission gen |
| src/activities/race_track.js | Vehicles | Racing minigame |
| src/activities/ride_along.js | Vehicles | Passenger ride system |
| src/activities/treasure_map.js | Exploration | Treasure hunt system |
| src/modding/mod_loader.js | Modding | Load external mods |
| src/modding/mod_sandbox.js | Modding | Isolated mod execution |

---

## Action Items

1. **D2** — Resolve leaderboard.js vs leaderboards.js (which is canonical?)
2. **D3** — Resolve minigame.js vs minigames.js (which is canonical?)
3. **particles.js** — Compare API with particle_system.js; likely predate it; investigate before deleting
4. **game_mode.js** — Wire this when implementing F1 (game mode select screen)
5. **src/ui/radio.js** — Check if this duplicates APPS.radio inline code in index.html
6. **src/systems/pathfinding.js** — Check if this duplicates a_star.js

---

*Last updated: iter 405 (2026-05-17)*
