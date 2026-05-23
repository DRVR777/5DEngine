// Extracted from index.html (iter 683) — save/load wiring.
// Calls GameProgress.init with collect+apply callbacks, wires auto-save (30s),
// Ctrl+S handler, and window._saveGame/_loadGame globals.
export function mountSaveWiring({ GameProgress, get, set, actions, registerKeydown = null }) {
  function collect() {
    const heroNow = get.heroPos();
    return {
      score: get.score(),
      enemyKills: get.enemyKills(),
      heroHp: get.heroHp(),
      heroMaxHp: get.heroMaxHp(),
      heroU: heroNow.u, heroV: heroNow.v, heroY: heroNow.y || 0,
      weaponId: get.currentWeaponId(),
      inventory: [...get.inventory()],
      spawnPoints: get.spawnPoints().filter(sp => sp.label !== "origin").map(sp => ({ u: sp.u, v: sp.v })),
      questProgress: get.quests().map(q => ({ id: q.id, steps: q.steps.map(s => s.done) })),
    };
  }

  function apply(data, source) {
    if (data.score) set.score(data.score);
    if (data.enemy_kills != null) set.enemyKills(data.enemy_kills);
    else if (data.enemyKills) set.enemyKills(data.enemyKills);
    const maxHp = get.heroMaxHp();
    if (data.hero_hp != null) set.heroHp(Math.min(data.hero_hp, maxHp));
    else if (data.heroHp) set.heroHp(Math.min(data.heroHp, maxHp));

    const spawnPts = data.spawn_points || data.spawnPoints;
    if (Array.isArray(spawnPts)) { for (const sp of spawnPts) actions.addSpawnPoint(sp.u, sp.v); }

    const qp = data.quest_progress || data.questProgress;
    if (Array.isArray(qp)) {
      for (const entry of qp) {
        const q = get.quests().find(q => q.id === (entry.id || entry.quest_id));
        if (!q) continue;
        const steps = entry.steps || entry.steps_done;
        if (Array.isArray(steps)) {
          for (let i = 0; i < steps.length && i < q.steps.length; i++) { if (steps[i]) q.steps[i].done = true; }
        }
      }
      actions.renderQuests();
    }

    const age = data.saved_at
      ? Math.round((Date.now() - new Date(data.saved_at).getTime()) / 60000)
      : (data.timestamp ? Math.round((Date.now() - data.timestamp) / 60000) : 0);
    actions.showToast(`Save loaded from ${source} (${age}m ago) — score:${data.score || get.score()} kills:${data.enemyKills || data.enemy_kills || get.enemyKills()}`, "info", 4000);
  }

  GameProgress.init(collect, apply, { getQuests: () => get.quests() });

  const save = () => GameProgress.save();
  const load = () => GameProgress.load();

  // Auto-save every 30 seconds
  setInterval(save, 30000);

  if (registerKeydown) {
    registerKeydown((e) => {
      if (e.code === "KeyS" && e.ctrlKey && !get.computerOpen()) {
        e.preventDefault();
        save();
        actions.showToast("Game saved", "success", 1500);
      }
    });
  }

  return { save, load };
}
