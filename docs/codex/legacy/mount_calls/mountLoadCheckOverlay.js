// Legacy clone of mountLoadCheckOverlay call site(s).
// Source: game.html @ sha256:c7b57cf73a695b8d
// Cloned by tools/clone_legacy_mounts.mjs — DO NOT EDIT BY HAND.
// Purpose: preserve the exact legacy invocation so substrate work
// can diff against it. Per CLAUDE.md the legacy authority is
// readable until the substrate equivalent proves identical behavior.

// occurrence 1 of 1
// game.html lines 2436..2443
// (context lines 2432..2447)

  createGrenadeCrateSystem, createArmorVestSystem,
});

// Pseudocode: working-build overlay verifies/pulls git after loading succeeds.
mountLoadCheckOverlay({
  actions: {
    showToast,
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    setInterval: (fn, ms) => setInterval(fn, ms),
    clearInterval: id => clearInterval(id),
  },
});

// Pseudocode: report uncaught runtime errors to server artifacts for the agent loop.
mountRuntimeErrorReporter();
</script>
