// supabase_bridge.js — 5DEngine ↔ Supabase (ankhor schema) integration
// Provides cloud save/load for sessions, scenes, assets, quests, and NPC dialogs.
// Uses the ankhor Supabase project (vsriwayvdbqzbsmeiujt).
//
// Usage (after user logs in via supabaseAuth.signInWithOAuth):
//   await SupabaseBridge.saveSession({ score, kills, hp, ... });
//   await SupabaseBridge.loadLatestSession();
//   await SupabaseBridge.saveScene("my_world", objects, spawnPoints);
//   const scenes = await SupabaseBridge.listScenes();
//   await SupabaseBridge.syncQuestProgress(questsArray);
//
// Auth note: the Supabase anon key is safe to include in browser code.
// RLS policies ensure users can only read/write their own rows.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.SupabaseBridge = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const SUPABASE_URL    = "https://vsriwayvdbqzbsmeiujt.supabase.co";
  const SUPABASE_ANON   = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzcml3YXl2ZGJxemJzbWVpdWp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MDg3NjQsImV4cCI6MjA5MDE4NDc2NH0.-5zk4S5shN3UQT5mv4gwtZhNiGSPo84f8Nm4bbxmRN8";

  let _sb = null;       // @supabase/supabase-js client (lazy import)
  let _user = null;     // authenticated user object

  // ---- Client bootstrap ----
  async function _getClient() {
    if (_sb) return _sb;
    try {
      const { createClient } = await import(
        "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm"
      );
      _sb = createClient(SUPABASE_URL, SUPABASE_ANON);
      // Restore existing session from localStorage if available
      const { data: { session } } = await _sb.auth.getSession();
      if (session) _user = session.user;
      // Listen for auth changes
      _sb.auth.onAuthStateChange((_event, session) => {
        _user = session ? session.user : null;
      });
    } catch (e) {
      console.warn("[SupabaseBridge] Failed to initialize Supabase client:", e.message);
    }
    return _sb;
  }

  function getUser() { return _user; }
  function isAuthed() { return !!_user; }

  // ---- Auth ----
  async function signIn(provider = "google") {
    const sb = await _getClient();
    if (!sb) return null;
    const { data, error } = await sb.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin }
    });
    if (error) { console.warn("[SupabaseBridge] signIn error:", error.message); return null; }
    return data;
  }

  async function signOut() {
    const sb = await _getClient();
    if (sb) await sb.auth.signOut();
    _user = null;
  }

  // ---- Helper ----
  function _guardAuth() {
    if (!_user) { console.warn("[SupabaseBridge] Not authenticated"); return false; }
    return true;
  }

  async function _rpc(table, method, body) {
    const sb = await _getClient();
    if (!sb) return { data: null, error: new Error("Supabase unavailable") };
    return await sb.from(table)[method](body);
  }

  // ---- Sessions ----
  async function saveSession(state) {
    if (!_guardAuth()) return null;
    const sb = await _getClient();
    const payload = {
      user_id: _user.id,
      world_name: state.worldName || "default",
      score: state.score || 0,
      enemy_kills: state.enemyKills || 0,
      coins_collected: state.score || 0,
      total_coins: state.totalCoins || 0,
      hero_hp: state.heroHp || 100,
      hero_max_hp: state.heroMaxHp || 100,
      play_time_seconds: state.playTime || 0,
      hero_u: state.heroU || 0,
      hero_v: state.heroV || 0,
      hero_y: state.heroY || 0,
      active_weapon_id: state.weaponId || "pistol",
      inventory: state.inventory || [],
      quest_progress: state.questProgress || [],
      saved_at: new Date().toISOString(),
    };
    // Upsert: one row per (user_id, world_name) — update if exists
    const { data, error } = await sb.from("engine_sessions").upsert(payload, {
      onConflict: "user_id,world_name",
      ignoreDuplicates: false,
    }).select().single();
    if (error) console.warn("[SupabaseBridge] saveSession error:", error.message);
    return data;
  }

  async function loadLatestSession(worldName = "default") {
    if (!_guardAuth()) return null;
    const sb = await _getClient();
    const { data, error } = await sb.from("engine_sessions")
      .select("*")
      .eq("user_id", _user.id)
      .eq("world_name", worldName)
      .order("saved_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) console.warn("[SupabaseBridge] loadLatestSession error:", error.message);
    return data;
  }

  // ---- Scenes ----
  async function saveScene(name, objects, spawnPoints, configOverrides, opts = {}) {
    if (!_guardAuth()) return null;
    const sb = await _getClient();
    const payload = {
      user_id: _user.id,
      world_name: opts.worldName || "default",
      name,
      description: opts.description || "",
      objects,
      spawn_points: spawnPoints || [],
      config_overrides: configOverrides || {},
      is_public: opts.isPublic || false,
      tags: opts.tags || [],
      version: opts.version || "1.0",
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await sb.from("engine_scenes").upsert(payload, {
      onConflict: "user_id,world_name,name",
      ignoreDuplicates: false,
    }).select().single();
    if (error) console.warn("[SupabaseBridge] saveScene error:", error.message);
    return data;
  }

  async function loadScene(name, worldName = "default") {
    if (!_guardAuth()) return null;
    const sb = await _getClient();
    const { data, error } = await sb.from("engine_scenes")
      .select("*")
      .eq("user_id", _user.id)
      .eq("world_name", worldName)
      .eq("name", name)
      .maybeSingle();
    if (error) console.warn("[SupabaseBridge] loadScene error:", error.message);
    return data;
  }

  async function listScenes(worldName = "default") {
    if (!_guardAuth()) return [];
    const sb = await _getClient();
    const { data, error } = await sb.from("engine_scenes")
      .select("id,name,description,object_count,is_public,updated_at")
      .eq("user_id", _user.id)
      .eq("world_name", worldName)
      .order("updated_at", { ascending: false });
    if (error) console.warn("[SupabaseBridge] listScenes error:", error.message);
    return data || [];
  }

  async function listPublicScenes() {
    const sb = await _getClient();
    if (!sb) return [];
    const { data, error } = await sb.from("engine_scenes")
      .select("id,name,description,object_count,updated_at")
      .eq("is_public", true)
      .order("updated_at", { ascending: false })
      .limit(50);
    if (error) console.warn("[SupabaseBridge] listPublicScenes error:", error.message);
    return data || [];
  }

  // ---- Quest progress sync ----
  async function syncQuestProgress(questsArray) {
    if (!_guardAuth()) return;
    const sb = await _getClient();
    const rows = questsArray.map(q => ({
      user_id: _user.id,
      quest_id: q.id,
      steps_done: q.steps.map(s => s.done),
      is_complete: q.steps.every(s => s.done),
      completed_at: q.steps.every(s => s.done) ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await sb.from("engine_quest_progress").upsert(rows, {
      onConflict: "user_id,quest_id",
      ignoreDuplicates: false,
    });
    if (error) console.warn("[SupabaseBridge] syncQuestProgress error:", error.message);
  }

  async function loadQuestProgress() {
    if (!_guardAuth()) return [];
    const sb = await _getClient();
    const { data, error } = await sb.from("engine_quest_progress")
      .select("*")
      .eq("user_id", _user.id);
    if (error) console.warn("[SupabaseBridge] loadQuestProgress error:", error.message);
    return data || [];
  }

  // ---- Assets ----
  async function listAssets(category) {
    const sb = await _getClient();
    if (!sb) return [];
    let q = sb.from("engine_assets").select("*");
    if (_user) q = q.or(`user_id.eq.${_user.id},is_public.eq.true`);
    else q = q.eq("is_public", true);
    if (category) q = q.eq("category", category);
    const { data, error } = await q.order("created_at", { ascending: false });
    if (error) console.warn("[SupabaseBridge] listAssets error:", error.message);
    return data || [];
  }

  async function registerAsset(meta) {
    if (!_guardAuth()) return null;
    const sb = await _getClient();
    const payload = { user_id: _user.id, ...meta };
    const { data, error } = await sb.from("engine_assets").insert(payload).select().single();
    if (error) console.warn("[SupabaseBridge] registerAsset error:", error.message);
    return data;
  }

  // ---- NPC Dialogs ----
  async function loadNpcDialogs(worldName = "default") {
    const sb = await _getClient();
    if (!sb) return [];
    let q = sb.from("engine_npc_dialogs").select("*").eq("world_name", worldName).eq("is_active", true);
    if (_user) q = q.eq("user_id", _user.id);
    const { data, error } = await q;
    if (error) console.warn("[SupabaseBridge] loadNpcDialogs error:", error.message);
    return data || [];
  }

  async function saveNpcDialog(npcId, npcDisplayName, lines, worldName = "default") {
    if (!_guardAuth()) return null;
    const sb = await _getClient();
    const payload = {
      user_id: _user.id,
      world_name: worldName,
      npc_id: npcId,
      npc_display_name: npcDisplayName,
      lines,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await sb.from("engine_npc_dialogs").upsert(payload, {
      onConflict: "user_id,world_name,npc_id",
    }).select().single();
    if (error) console.warn("[SupabaseBridge] saveNpcDialog error:", error.message);
    return data;
  }

  return {
    getClient: _getClient,
    getUser,
    isAuthed,
    signIn,
    signOut,

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

    SUPABASE_URL,
  };
});
