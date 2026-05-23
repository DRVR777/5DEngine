// Legacy clone of mountLoaders call site(s).
// Source: game.html @ sha256:c7b57cf73a695b8d
// Cloned by tools/clone_legacy_mounts.mjs — DO NOT EDIT BY HAND.
// Purpose: preserve the exact legacy invocation so substrate work
// can diff against it. Per CLAUDE.md the legacy authority is
// readable until the substrate equivalent proves identical behavior.

// occurrence 1 of 1
// game.html lines 243..243
// (context lines 239..247)

const showToast = Notifications.showToast;
const _addKillFeedEntry = Notifications.addKillFeedEntry;
// Multi-format loaders — pulled lazily so demo still runs if the CDN is down.
// ═══ EXTRACTED → src/render/loaders.js (iter 572)
const { Loaders } = mountLoaders();

// Post-processing — ═══ EXTRACTED → src/render/post_processing.js (iter 571)
// mountPostProcessing call is placed after mountRenderer (line ~824) so renderer+camera are live.
let composer = null;
