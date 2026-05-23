// Legacy clone of mountScreenInteraction call site(s).
// Source: game.html @ sha256:c7b57cf73a695b8d
// Cloned by tools/clone_legacy_mounts.mjs — DO NOT EDIT BY HAND.
// Purpose: preserve the exact legacy invocation so substrate work
// can diff against it. Per CLAUDE.md the legacy authority is
// readable until the substrate equivalent proves identical behavior.

// occurrence 1 of 1
// game.html lines 1210..1210
// (context lines 1206..1214)

const _setAmbient = Sfx.setAmbient;

// ═══ EXTRACTED → src/systems/screen_interaction.js (iter 682) ═══════════════════
// Pseudocode: E-key raycast → worldScreens, big screen → mouse-mode, normal → click.
const _screenInteraction = mountScreenInteraction({ THREE, getScreenMesh: () => window.ScreenMesh || null, get: { worldScreens: () => worldScreens, camera: () => camera, mouseMode: () => mouseMode }, set: { activeMouseScreen: v => { activeMouseScreen = v; }, mouseMode: v => { mouseMode = v; }, mouseModeCursorX: v => { mouseModeCursor.x = v; }, mouseModeCursorY: v => { mouseModeCursor.y = v; } }, exitPointerLock: () => { if (document.pointerLockElement) document.exitPointerLock(); } });
const tryClickWorldScreen  = () => _screenInteraction.tryClickWorldScreen();
const enterScreenMouseMode = (screen, uv) => _screenInteraction.enterScreenMouseMode(screen, uv);
const exitScreenMouseMode  = () => _screenInteraction.exitScreenMouseMode();

