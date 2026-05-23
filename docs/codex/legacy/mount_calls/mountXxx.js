// Legacy clone of mountXxx call site(s).
// Source: game.html @ sha256:c7b57cf73a695b8d
// Cloned by tools/clone_legacy_mounts.mjs — DO NOT EDIT BY HAND.
// Purpose: preserve the exact legacy invocation so substrate work
// can diff against it. Per CLAUDE.md the legacy authority is
// readable until the substrate equivalent proves identical behavior.

// occurrence 1 of 1
// game.html lines 133..133
// (context lines 129..137)

  ─────────────────────
  This file is the game's single entry point. All state lives here as `let`
  variables; systems receive it through closure-based dependency injection:

    mountXxx({ get: { foo: () => foo }, set: { foo: v => { foo = v; } }, actions })

  "get/set" pairs expose individual state fields without passing mutable refs.
  "actions" provides callbacks to engine functions the module needs to call.

