# gta_demo — iteration plan

A runnable, browser-only 3D third-person demo built on
`multi_dim_engine_skeleton/`. The engine is the authoritative state
(player position in 5D, layer transitions, spatial grid). Three.js is
the rendering layer (CDN, no install). The bridge is `engine_bridge.js`.

## Plan-test-revise loop (every iteration)

Each iteration writes:
1. **PLAN section** appended below — what this iteration adds + how to verify
2. **CODE** — the smallest change that delivers it
3. **TEST** — `test_iter_NN.js` that exercises the new API headlessly
   (no browser needed) so a regression is caught immediately
4. **REVISE** — if test fails, fix until it passes, then commit

The browser demo is the integration test. Headless `test_*.js` files
are unit tests on the bridge.

---

## How GTA-style 3rd person works (research synthesis)

- **Character controller**: capsule collider, kinematic — apply velocity
  per frame, clamp to world bounds, gravity for falling. GTA uses a
  hybrid character controller (Havok physics under the hood, but the
  walk/run gait is a state machine on top).
- **Camera**: third-person follow camera. Sits at offset
  (behind, above) from the character, looks at the character's head.
  Mouse drag rotates the camera around the character (orbit). Right
  stick on controller. Pitch is clamped (no flipping over).
- **Movement direction is camera-relative** — pressing W moves the
  character along the camera's forward vector projected to the ground
  plane. This is the single most important UX detail GTA gets right.
- **Environment**: world is decomposed into "interior" and "exterior"
  cells. Crossing a doorway loads/unloads the interior cell. We map this
  to our engine's `LayerBoundary` system: each building is a rect
  boundary that triggers a `phase_shift` event when entered.
- **Day/night, traffic, NPCs** — out of scope for v1; can layer on later.

## Iteration sequence

- **iter 1 (this commit)**: PLAN + bridge skeleton + headless smoke
  proving the bridge can map (engine 5D pos) → (Three.js Vector3) and
  back deterministically. *Verifiable without browser.*
- **iter 2**: index.html + Three.js scene, ground plane, capsule
  character, chase camera, WASD camera-relative movement.
- **iter 3**: buildings as layer boundaries, console-log entries via
  engine `transition_event`. Add 3-5 buildings + a road grid.
- **iter 4**: mouse orbit camera, sprint (shift), jump (space + simple
  gravity), camera collision (don't clip into buildings).
- **iter 5**: enterable interiors — when a layer transition fires, the
  exterior dims and an interior layer renders.
- **iter 6**: polish — character mesh (low-poly), ground texture, sky,
  HUD with current layer + position.

## Verify each iter

```
node gta_demo/test_iter_NN.js   # headless unit
start gta_demo/index.html       # visual integration
```
