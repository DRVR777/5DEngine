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
