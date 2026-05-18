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
- [ ] B8. Wire Multiplayer IIFE → src/social/multiplayer.js

## Phase 3 — Structural wiring
- [ ] C1. Wire EventBus to 5 additional game events
- [ ] C2. Add Engine.require() no-op proxy
- [ ] C3. Fixed-timestep physics wrapper
- [ ] C4. resetGameState() function
- [ ] C5. GTAEngine null guard

## Phase 4 — Orphaned file audit
- [ ] D1. Classify 102 orphaned src/ files → docs/ORPHAN_AUDIT.md
- [ ] D2. Fix leaderboard.js + leaderboards.js duplicate
- [ ] D3. Fix minigame.js + minigames.js duplicate
