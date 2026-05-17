# Active priorities (top is highest)

1. **Extract `src/core/engine.js` namespace.** Single `window.Engine.*` root.
   Migrate `window._builderMultiList`, `window._hotbarSpawn`, etc., one at a
   time. No new globals.

2. **Add `src/core/events.js` event bus.** `Engine.events.emit/on/off`.
   Replace direct cross-system calls (showToast, playSfx) over the next several
   iters. Migration is incremental, not big-bang.

3. **Migrate `index.html` runtime into `src/core/main.js` as ES module entry.**
   index.html becomes a thin shell with one `<script type="module">` tag.

4. **Introduce Rapier physics behind `src/physics/` interface.** Keep AABB as
   fallback initially. Sloped terrain, stacked objects, character controller
   all flow from this.

5. **Component system (faceted entities).** See docs/MODULAR_ARCHITECTURE.md.
   Replace `mesh.userData.script` with `entity.components`. Replace parallel
   `enemies`/`vehicles`/`npcs` arrays with entity queries.

6. **Navmesh-based AI pathfinding.** Enemies walking through buildings is the
   weakest visible gameplay system. Recast/Detour port or grid A* (a_star.js exists).

7. **Animation state machine.** AnimationMixer → blend trees, transitions,
   IK, root motion, additive layers. So the GLB hero feels alive.

8. **Scene hierarchy panel + reparenting in builder.** Tree view, lock/hide
   toggles per node, search/filter, find-in-scene.

9. **Console + profiler overlay.** Frame time breakdown, allocation tracking,
   commands (spawn, tp, god, noclip, time 20:00). Needed to debug 4-7.

10. **Asset pipeline.** Import settings per asset, thumbnail generation,
    dependency tracking, hot-reload.

# Gated — DO NOT start until prerequisites done
- **Networking / multiplayer** — gated until 1, 2, 5 complete
- **Visual scripting (Blueprints-style)** — gated until 5 complete
- **Terrain editor** — gated until 4 complete
- **PBR material editor** — gated until 3 complete
- **New activities / minigames** — engine first, content second
