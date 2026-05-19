// Registers available window-global subsystems into the Engine namespace.
// All checks are guarded so missing modules are silently skipped.
export function mountEngineRegistry() {
  if (typeof Engine !== "undefined") {
    if (typeof EventBus      !== "undefined") { Engine.register("events", EventBus); Engine.events = EventBus; }
    if (typeof AStar         !== "undefined") Engine.register("astar",        AStar);
    if (typeof Achievements  !== "undefined") Engine.register("achievements", Achievements);
    if (typeof StatusEffects !== "undefined") Engine.register("statusEffects",StatusEffects);
    if (typeof Crafting      !== "undefined") Engine.register("crafting",     Crafting);
    if (typeof ParticleSystem!== "undefined") Engine.register("particles",    ParticleSystem);
    if (typeof TriggerZones  !== "undefined") Engine.register("triggerZones", TriggerZones);
    if (typeof SoundZones    !== "undefined") Engine.register("soundZones",   SoundZones);
    if (typeof Cutscene      !== "undefined") Engine.register("cutscene",     Cutscene);
    if (typeof Terrain       !== "undefined") Engine.register("terrain",      Terrain);
    if (typeof WaveManager   !== "undefined") Engine.register("waves",        WaveManager);
  }
  if (typeof DevConsole !== "undefined") DevConsole.init();
}
