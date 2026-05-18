# Structural + Algorithmic Repair Loop Progress

## Phase 1 — Algorithmic quick wins
- [x] A1. Cache _liveBoss ref
- [x] A2. Cache _activeVehicleDef
- [x] A3. Cache getElementById refs
- [x] A4. Pre-allocate camera Vector3s
- [x] A5. Alert propagation O(E²) → broadcast timestamp
- [x] A6. Flat en._meshChildren cache
- [x] A7. Cache em._alertBubble + em._typeGem
- [x] A8. Platforms dirty-flag cache
- [x] A9. Enemy separation early-out
- [x] A10. HUD enemy HP dirty-flag
- [x] A11. Mag bar dirty-flag
- [x] A12. Carry building-blocker ref through bullet loop
- [x] A13. Collected pickups splice-on-collect
- [x] A14. Single-pass ambient sound scan
- [x] A15. SVG dmgDir pre-create element

## Phase 2 — Modular extractions
- [x] B1. Extract Rain → src/world/rain.js
- [x] B2. Extract Toast + Kill feed → src/ui/hud_notifications.js
- [x] B3. Extract playSfx + _setAmbient → src/audio/sfx.js
- [x] B4. Extract Minimap → src/ui/minimap.js
- [x] B5. Extract High score → src/progression/high_score.js
- [x] B6. Wire Save/Load → src/systems/save_load.js
- [x] B7. Extract particles → src/render/vfx.js (note: particle_system.js already existed for InstancedMesh; vfx.js holds inline sphere/casing/damage-num/shockwave/muzzle-flash effects)
- [!] B8. Wire Multiplayer IIFE → src/social/multiplayer.js — FLAGGED: src/social/multiplayer.js already exists as a different Hub/WorldState abstract architecture (no socket.io). Merging the inline _mp IIFE into it would be an architectural decision. Skipping until explicit approval.

## Phase 3 — Structural wiring
- [x] C1. Wire EventBus to 5 additional game events (HERO_DAMAGED, WEAPON_SWITCH, VEHICLE_ENTER, VEHICLE_EXIT, SCORE_CHANGED)
- [x] C2. Add Engine.require() no-op proxy (added to src/core/engine.js, returns null if subsystem not registered)
- [x] C3. Fixed-timestep physics wrapper (FIXED_DT=1/60 + _physicsAcc accumulator wired into tick(); _physicsSteps/_physicsAlpha available for future subsystem migration)
- [x] C4. resetGameState() function (extracted from victoryPlayAgain click handler; exposed as window.resetGameState for console/game-mode-select reuse)
- [x] C5. GTAEngine null guard (added named throw guards for GTAEngine, GTABridge, GTAPhysics, GTARegistry, GTAInventory — clear error messages instead of cryptic TypeErrors)

## ✓ STRUCTURAL REPAIR LOOP COMPLETE — iter 407 (2026-05-17)
B8 flagged (existing multiplayer.js is a different architecture — requires explicit approval to merge).
Next: FUTURE_FEATURES.md — F1 game mode select, F2 LAN probe, F3 collab world sync, F4 network smoothing.

## Phase 4 — Orphaned file audit
- [x] D1. Classify 102 orphaned src/ files → docs/ORPHAN_AUDIT.md (101 files classified: 42 WIRED, 3 CROSS-REF, 2 DUPLICATE, 10 social/future, 10 economy/future, 14 world/future, 4 vehicle/future, 5 progression/future, ~11 scaffold)
- [x] D2. Fix leaderboard.js + leaderboards.js duplicate — confirmed DISTINCT (network-broadcast vs offline-history); added disambiguation banners to both files
- [x] D3. Fix minigame.js + minigames.js duplicate — confirmed DISTINCT (session-harness vs game-registry-hub); added disambiguation banners to both files

## Phase 5 — Future Features

- [x] F1. Game Mode Select Screen — `gameMode` var (solo/coop_build/wave_defense), APPS.gamemodes entry, 🎮 icon in grid, click handler (data-action="set-mode"), auto-opens on first launch via 500ms setTimeout. EventBus.emit("GAME_MODE_CHANGED") for F3.
- [x] F2. LAN Server Probe — iter 410: game_server.py `/api/status` + `/scan` (32-thread concurrent TCP+HTTP probe); iter 411: APPS.servers entry, 🖥️ icon, wireServersApp() scan button, join-server redirect, friend-request mp_event + toast.
- [x] F3. Collaborative World Sync — iter 412: module-scope hooks (_onMpBuildEvent, _onMpWelcomeHook), wired into _mp IIFE mp_event + mp_welcome + mp_player_joined handlers; worldBuilder mutation wrappers (_markBuildDirty), 1Hz flush with echo prevention (_applyingRemoteSync), full scene JSON sync on connect/peer-join. Active only in coop_build mode.
- [x] F4. Network Smoothing Pass — iter 413: dead-reckoning for vehicles (vel+velTime tracking in mp_pos handler, <300ms extrapolation in tick()); inVehicle flag added to 20Hz position send; vehicle lerp factor 8 vs walker 12. Damage informational only (already was; no change needed).

## ✓ FUTURE_FEATURES LOOP COMPLETE — iter 413 (2026-05-17)
F1-F4 all implemented. Continuing: build forever.

## Phase 6 — Peer Installer + Test Suite

- [x] P1. setup_peer.py — 4-step installer (Python pkgs, Node.js, PostgreSQL 16, smoke test); handles winget, PATH detection, DB creation + schema.sql; works as plain script or compiled EXE
- [x] P2. build_exe.bat — PyInstaller one-file build → dist/5DEngine-Setup.exe
- [x] P3. tests/test_server_api.py — pytest for all game_server.py Flask REST endpoints (/api/status, /scan, /api/friend_request, /api/friend_accept, /api/friends, static serving)
- [x] P4. tests/test_websocket.py — pytest for socket.io WebSocket events (connect/welcome, player joined/left, mp_name relay, mp_pos relay with sender ID, mp_event relay, friend_request broadcast)
- [x] P5. tests/test_db.py — pytest for PostgreSQL schema integrity + CRUD (sessions, scenes, quest_progress) + server.js Node API (/api/ping, sessions, scenes, quest-progress); auto-skips if PG/Node not running
- [x] P6. tests/run_tests.bat — Windows batch runner for all three suites with pass/fail summary

## ✓ PEER INSTALLER + TEST SUITE COMPLETE — iter 416 (2026-05-17)

## Phase 7 — ECS System Extractions (build forever)

- [x] iter 479: ecs_poisoner_dart — direct venom dart attack 3.5-10m range 3.0-4.5s CD, 21 unit tests
- [x] iter 480: ecs_enemy_bullet — enemy projectile travel + hero hit detection, 25 unit tests
- [x] iter 481: ecs_enemy_regen — out-of-combat HP regen 4hp/tick 8s delay 1.8s display interval, 13 unit tests
- [x] iter 482: ecs_enemy_separation — pairwise 1.2m overlap prevention 0.6 push, 10 unit tests
- [x] iter 483: ecs_combo — kill streak multiplier x2-x8 3.5s decay milestone events, 17 unit tests
- [x] iter 484: ecs_arena_clamp — 27.5m boundary enforcement safety net priority 16, 11 unit tests
- [x] iter 485: ecs_enemy_blind — flash grenade blind effect 6m radius 0.5-3.0s duration, 15 unit tests
