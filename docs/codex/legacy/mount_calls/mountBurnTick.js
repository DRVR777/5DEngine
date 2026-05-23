// Legacy clone of mountBurnTick call site(s).
// Source: game.html @ sha256:c7b57cf73a695b8d
// Cloned by tools/clone_legacy_mounts.mjs — DO NOT EDIT BY HAND.
// Purpose: preserve the exact legacy invocation so substrate work
// can diff against it. Per CLAUDE.md the legacy authority is
// readable until the substrate equivalent proves identical behavior.

// occurrence 1 of 1
// game.html lines 802..806
// (context lines 798..810)

let _vignetteAmt = 0; // spring [0..1]: driven by hit impulses + low-HP pulse
let _heroFireT = 0;
let _heroFireDmgT = 0;
// ═══ EXTRACTED → src/systems/burn_tick.js (iter 591)
const _burnTick = mountBurnTick({
  get: { heroFireT: () => _heroFireT, heroFireDmgT: () => _heroFireDmgT, heroHp: () => heroHp, heroDead: () => _heroDead, heroPos: () => world.players.get("hero") },
  set: { heroFireT: v => { _heroFireT = v; }, heroFireDmgT: v => { _heroFireDmgT = v; }, heroHp: v => { heroHp = v; }, heroLastDamageT: v => { heroLastDamageT = v; } },
  actions: { spawnParticles: (u,y,v,n,c,s,sz) => _spawnParticles(u,y,v,n,c,s,sz), heroShowDeathScreen: () => _heroShowDeathScreen() },
});
let _heroEmpT = 0;    // seconds sprinting is disabled (robot EMP burst debuff)
let _camShakeAmt = 0;
// ═══ EXTRACTED → src/systems/damage_feedback.js (iter 589)
const { flashDamage, applyScreenShake: _applyScreenShake } = mountDamageFeedback({
