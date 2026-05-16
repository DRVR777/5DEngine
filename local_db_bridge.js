// local_db_bridge.js — 5DEngine ↔ local PostgreSQL (via server.js REST API)
// Drop-in replacement for supabase_bridge.js for local/offline use.
//
// Requires server.js running: node server.js
// Requires PostgreSQL running locally with the 5dengine database initialized:
//   createdb 5dengine && psql -d 5dengine -f db/schema.sql
//
// Usage:
//   LocalDb.saveSession({ score, enemyKills, heroHp, ... })
//   LocalDb.loadLatestSession()
//   LocalDb.saveScene("my_world", objects, spawnPoints)
//   LocalDb.listScenes()
//   LocalDb.syncQuestProgress(questsArray)

(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.LocalDb = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const API = "http://localhost:3001/api";

  // Stable anonymous local user ID — stored in localStorage, never changes
  function _getUserId() {
    let id = localStorage.getItem("5dengine_local_uid");
    if (!id) {
      id = "local_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem("5dengine_local_uid", id);
    }
    return id;
  }

  let _online = null;   // null = not checked, true/false after ping

  async function ping() {
    try {
      const r = await fetch(`${API}/ping`, { signal: AbortSignal.timeout(1500) });
      _online = r.ok;
    } catch (_) { _online = false; }
    return _online;
  }

  async function _get(path) {
    try {
      const r = await fetch(`${API}${path}`, { signal: AbortSignal.timeout(4000) });
      if (!r.ok) { console.warn("[LocalDb] GET", path, r.status); return null; }
      return await r.json();
    } catch (e) { console.warn("[LocalDb] GET", path, e.message); return null; }
  }

  async function _post(path, body) {
    try {
      const r = await fetch(`${API}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(6000),
      });
      if (!r.ok) { console.warn("[LocalDb] POST", path, r.status, await r.text()); return null; }
      return await r.json();
    } catch (e) { console.warn("[LocalDb] POST", path, e.message); return null; }
  }

  // ---- Sessions ----
  async function saveSession(state) {
    const uid = _getUserId();
    return _post("/sessions", {
      user_id:          uid,
      world_name:       state.worldName || "default",
      score:            state.score || 0,
      enemy_kills:      state.enemyKills || 0,
      coins_collected:  state.score || 0,
      total_coins:      state.totalCoins || 0,
      hero_hp:          state.heroHp || 100,
      hero_max_hp:      state.heroMaxHp || 100,
      play_time_seconds: state.playTime || 0,
      hero_u:           state.heroU || 0,
      hero_v:           state.heroV || 0,
      hero_y:           state.heroY || 0,
      active_weapon_id: state.weaponId || "pistol",
      inventory:        state.inventory || [],
      quest_progress:   state.questProgress || [],
    });
  }

  async function loadLatestSession(worldName = "default") {
    const uid = _getUserId();
    return _get(`/sessions/${encodeURIComponent(worldName)}?user_id=${uid}`);
  }

  // ---- Scenes ----
  async function saveScene(name, objects, spawnPoints, configOverrides, opts = {}) {
    const uid = _getUserId();
    return _post("/scenes", {
      user_id:         uid,
      world_name:      opts.worldName || "default",
      name,
      description:     opts.description || "",
      objects,
      spawn_points:    spawnPoints || [],
      config_overrides: configOverrides || {},
      is_public:       opts.isPublic || false,
      tags:            opts.tags || [],
      version:         opts.version || "1.0",
    });
  }

  async function loadScene(name, worldName = "default") {
    const uid = _getUserId();
    return _get(`/scenes/${encodeURIComponent(name)}?user_id=${uid}&world_name=${encodeURIComponent(worldName)}`);
  }

  async function listScenes(worldName = "default") {
    const uid = _getUserId();
    const data = await _get(`/scenes?user_id=${uid}&world_name=${encodeURIComponent(worldName)}`);
    return data || [];
  }

  async function listPublicScenes() {
    const data = await _get("/scenes/public");
    return data || [];
  }

  // ---- Quest progress ----
  async function syncQuestProgress(questsArray) {
    const uid = _getUserId();
    return _post("/quest-progress", {
      user_id: uid,
      rows: questsArray.map(q => ({
        quest_id:    q.id,
        steps_done:  q.steps.map(s => !!s.done),
        is_complete: q.steps.every(s => s.done),
        completed_at: q.steps.every(s => s.done) ? new Date().toISOString() : null,
      })),
    });
  }

  async function loadQuestProgress() {
    const uid = _getUserId();
    const data = await _get(`/quest-progress?user_id=${uid}`);
    return data || [];
  }

  // ---- Assets ----
  async function listAssets(category) {
    const uid = _getUserId();
    let url = `/assets?user_id=${uid}`;
    if (category) url += `&category=${encodeURIComponent(category)}`;
    const data = await _get(url);
    return data || [];
  }

  async function registerAsset(meta) {
    return _post("/assets", { user_id: _getUserId(), ...meta });
  }

  // ---- NPC dialogs ----
  async function loadNpcDialogs(worldName = "default") {
    const uid = _getUserId();
    const data = await _get(`/npc-dialogs?user_id=${uid}&world_name=${encodeURIComponent(worldName)}`);
    return data || [];
  }

  async function saveNpcDialog(npcId, npcDisplayName, lines, worldName = "default") {
    return _post("/npc-dialogs", {
      user_id: _getUserId(), world_name: worldName,
      npc_id: npcId, npc_display_name: npcDisplayName, lines,
    });
  }

  // ---- World objects ----
  async function saveWorldObject(obj) {
    return _post("/world-objects", { user_id: _getUserId(), ...obj });
  }

  async function loadWorldObjects(worldName = "default", objectType) {
    const uid = _getUserId();
    let url = `/world-objects?user_id=${uid}&world_name=${encodeURIComponent(worldName)}`;
    if (objectType) url += `&object_type=${encodeURIComponent(objectType)}`;
    const data = await _get(url);
    return data || [];
  }

  // Kick off a silent ping on load so _online is ready
  ping().catch(() => {});

  return {
    getUserId: _getUserId,
    isOnline: () => _online,
    ping,

    saveSession,
    loadLatestSession,

    saveScene,
    loadScene,
    listScenes,
    listPublicScenes,

    syncQuestProgress,
    loadQuestProgress,

    listAssets,
    registerAsset,

    loadNpcDialogs,
    saveNpcDialog,

    saveWorldObject,
    loadWorldObjects,

    API,
  };
});
