// server.js — 5DEngine local PostgreSQL API server
// Run: node server.js  (requires PostgreSQL running locally)
// Set env vars: PGUSER, PGPASSWORD, PGDATABASE (default: postgres / postgres / 5dengine)
// Or set DATABASE_URL=postgresql://user:pass@localhost:5432/5dengine

"use strict";

const express = require("express");
const cors    = require("cors");
const { Pool } = require("pg");

const PORT = process.env.PORT || 3001;

const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host:     process.env.PGHOST     || "localhost",
        port:     process.env.PGPORT     || 5432,
        database: process.env.PGDATABASE || "5dengine",
        user:     process.env.PGUSER     || "postgres",
        password: process.env.PGPASSWORD || "postgres",
      }
);

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// ---- Helpers ----
function q(text, params) { return pool.query(text, params); }

// ---- Health ----
app.get("/api/ping", (_req, res) => res.json({ ok: true, ts: Date.now() }));

// ---- Sessions ----
app.post("/api/sessions", async (req, res) => {
  try {
    const d = req.body;
    const { rows } = await q(`
      INSERT INTO engine_sessions
        (user_id, world_name, score, enemy_kills, coins_collected, total_coins,
         hero_hp, hero_max_hp, play_time_seconds, hero_u, hero_v, hero_y,
         active_weapon_id, inventory, quest_progress, saved_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,NOW())
      ON CONFLICT (user_id, world_name) DO UPDATE SET
        score=$3, enemy_kills=$4, coins_collected=$5, total_coins=$6,
        hero_hp=$7, hero_max_hp=$8, play_time_seconds=$9,
        hero_u=$10, hero_v=$11, hero_y=$12,
        active_weapon_id=$13, inventory=$14, quest_progress=$15, saved_at=NOW()
      RETURNING *`,
      [d.user_id, d.world_name||"default", d.score||0, d.enemy_kills||0,
       d.coins_collected||0, d.total_coins||0, d.hero_hp||100, d.hero_max_hp||100,
       d.play_time_seconds||0, d.hero_u||0, d.hero_v||0, d.hero_y||0,
       d.active_weapon_id||"pistol",
       JSON.stringify(d.inventory||[]), JSON.stringify(d.quest_progress||[])]
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/sessions/:worldName", async (req, res) => {
  try {
    const { worldName } = req.params;
    const { user_id } = req.query;
    if (!user_id) return res.status(400).json({ error: "user_id required" });
    const { rows } = await q(
      "SELECT * FROM engine_sessions WHERE user_id=$1 AND world_name=$2 ORDER BY saved_at DESC LIMIT 1",
      [user_id, worldName]
    );
    res.json(rows[0] || null);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---- Scenes ----
app.post("/api/scenes", async (req, res) => {
  try {
    const d = req.body;
    const { rows } = await q(`
      INSERT INTO engine_scenes
        (user_id, world_name, name, description, objects, spawn_points,
         config_overrides, is_public, tags, version, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
      ON CONFLICT (user_id, world_name, name) DO UPDATE SET
        description=$4, objects=$5, spawn_points=$6,
        config_overrides=$7, is_public=$8, tags=$9, version=$10, updated_at=NOW()
      RETURNING *`,
      [d.user_id, d.world_name||"default", d.name, d.description||"",
       JSON.stringify(d.objects||[]), JSON.stringify(d.spawn_points||[]),
       JSON.stringify(d.config_overrides||{}),
       d.is_public||false, d.tags||[], d.version||"1.0"]
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/scenes", async (req, res) => {
  try {
    const { user_id, world_name = "default" } = req.query;
    if (!user_id) return res.status(400).json({ error: "user_id required" });
    const { rows } = await q(
      "SELECT id,name,description,is_public,updated_at FROM engine_scenes WHERE user_id=$1 AND world_name=$2 ORDER BY updated_at DESC",
      [user_id, world_name]
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/scenes/public", async (req, res) => {
  try {
    const { rows } = await q(
      "SELECT id,name,description,updated_at FROM engine_scenes WHERE is_public=TRUE ORDER BY updated_at DESC LIMIT 50"
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/scenes/:name", async (req, res) => {
  try {
    const { user_id, world_name = "default" } = req.query;
    if (!user_id) return res.status(400).json({ error: "user_id required" });
    const { rows } = await q(
      "SELECT * FROM engine_scenes WHERE user_id=$1 AND world_name=$2 AND name=$3",
      [user_id, world_name, req.params.name]
    );
    res.json(rows[0] || null);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---- Quest progress ----
app.post("/api/quest-progress", async (req, res) => {
  try {
    const { user_id, rows: quests } = req.body;
    for (const qp of quests) {
      await q(`
        INSERT INTO engine_quest_progress (user_id, quest_id, steps_done, is_complete, completed_at, updated_at)
        VALUES ($1,$2,$3,$4,$5,NOW())
        ON CONFLICT (user_id, quest_id) DO UPDATE SET
          steps_done=$3, is_complete=$4, completed_at=$5, updated_at=NOW()`,
        [user_id, qp.quest_id, qp.steps_done, qp.is_complete, qp.completed_at]
      );
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/quest-progress", async (req, res) => {
  try {
    const { user_id } = req.query;
    if (!user_id) return res.status(400).json({ error: "user_id required" });
    const { rows } = await q("SELECT * FROM engine_quest_progress WHERE user_id=$1", [user_id]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---- Assets ----
app.get("/api/assets", async (req, res) => {
  try {
    const { user_id, category } = req.query;
    let text = "SELECT * FROM engine_assets WHERE (is_public=TRUE";
    const params = [];
    if (user_id) { text += " OR user_id=$1"; params.push(user_id); }
    text += ")";
    if (category) { params.push(category); text += ` AND category=$${params.length}`; }
    text += " ORDER BY created_at DESC";
    const { rows } = await q(text, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/assets", async (req, res) => {
  try {
    const d = req.body;
    const { rows } = await q(`
      INSERT INTO engine_assets
        (user_id, file_url, format, mtl_url, texture_urls, display_name,
         description, tags, thumbnail_url, polygon_count, has_animations,
         animation_names, recommended_scale, category, is_hero_model, lod_urls, is_public)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
      RETURNING *`,
      [d.user_id, d.file_url, d.format, d.mtl_url||null,
       JSON.stringify(d.texture_urls||{}), d.display_name, d.description||null,
       d.tags||[], d.thumbnail_url||null, d.polygon_count||null,
       d.has_animations||false, d.animation_names||[], d.recommended_scale||1.0,
       d.category||"prop", d.is_hero_model||false,
       JSON.stringify(d.lod_urls||[]), d.is_public||false]
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---- NPC dialogs ----
app.get("/api/npc-dialogs", async (req, res) => {
  try {
    const { user_id, world_name = "default" } = req.query;
    let text = "SELECT * FROM engine_npc_dialogs WHERE world_name=$1 AND is_active=TRUE";
    const params = [world_name];
    if (user_id) { params.push(user_id); text += ` AND user_id=$${params.length}`; }
    const { rows } = await q(text, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/npc-dialogs", async (req, res) => {
  try {
    const d = req.body;
    const { rows } = await q(`
      INSERT INTO engine_npc_dialogs (user_id, world_name, npc_id, npc_display_name, lines, updated_at)
      VALUES ($1,$2,$3,$4,$5,NOW())
      ON CONFLICT (user_id, world_name, npc_id) DO UPDATE SET
        npc_display_name=$4, lines=$5, updated_at=NOW()
      RETURNING *`,
      [d.user_id, d.world_name||"default", d.npc_id, d.npc_display_name, JSON.stringify(d.lines||[])]
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---- World objects ----
app.post("/api/world-objects", async (req, res) => {
  try {
    const d = req.body;
    const { rows } = await q(`
      INSERT INTO engine_world_objects
        (user_id, world_name, object_type, object_id, u, v, heading, color,
         building_facet, npc_facet, enemy_facet, vehicle_facet, device_facet, label, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW())
      ON CONFLICT (user_id, world_name, object_type, object_id) DO UPDATE SET
        u=$5, v=$6, heading=$7, color=$8,
        building_facet=$9, npc_facet=$10, enemy_facet=$11, vehicle_facet=$12,
        device_facet=$13, label=$14, updated_at=NOW()
      RETURNING *`,
      [d.user_id, d.world_name||"default", d.object_type, d.object_id,
       d.u||0, d.v||0, d.heading||0, d.color||4473924,
       d.building_facet ? JSON.stringify(d.building_facet) : null,
       d.npc_facet ? JSON.stringify(d.npc_facet) : null,
       d.enemy_facet ? JSON.stringify(d.enemy_facet) : null,
       d.vehicle_facet ? JSON.stringify(d.vehicle_facet) : null,
       d.device_facet ? JSON.stringify(d.device_facet) : null,
       d.label||null]
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/world-objects", async (req, res) => {
  try {
    const { user_id, world_name = "default", object_type } = req.query;
    if (!user_id) return res.status(400).json({ error: "user_id required" });
    let text = "SELECT * FROM engine_world_objects WHERE user_id=$1 AND world_name=$2 AND is_active=TRUE";
    const params = [user_id, world_name];
    if (object_type) { params.push(object_type); text += ` AND object_type=$${params.length}`; }
    const { rows } = await q(text, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---- DB init helper (run once to create tables) ----
async function initDb() {
  const fs = require("fs");
  const path = require("path");
  const sql = fs.readFileSync(path.join(__dirname, "db", "schema.sql"), "utf8");
  const stmts = sql.split(";").map(s => s.trim()).filter(Boolean);
  for (const stmt of stmts) {
    try { await pool.query(stmt + ";"); }
    catch (e) { if (!e.message.includes("already exists")) console.warn(stmt, e.message); }
  }
  console.log("DB initialized.");
}

module.exports = { initDb };

app.listen(PORT, () => {
  console.log(`[5DEngine] API server running on http://localhost:${PORT}`);
  console.log(`[5DEngine] DB: ${process.env.PGDATABASE || "5dengine"} @ ${process.env.PGHOST || "localhost"}`);
});
