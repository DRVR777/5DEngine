-- 5DEngine local PostgreSQL schema
-- Run: psql -U postgres -d 5dengine -f db/schema.sql

CREATE DATABASE IF NOT EXISTS "5dengine";  -- psql: createdb 5dengine

-- Sessions
CREATE TABLE IF NOT EXISTS engine_sessions (
  id           SERIAL PRIMARY KEY,
  user_id      TEXT NOT NULL,
  world_name   TEXT NOT NULL DEFAULT 'default',
  score        INTEGER DEFAULT 0,
  enemy_kills  INTEGER DEFAULT 0,
  coins_collected INTEGER DEFAULT 0,
  total_coins  INTEGER DEFAULT 0,
  hero_hp      INTEGER DEFAULT 100,
  hero_max_hp  INTEGER DEFAULT 100,
  play_time_seconds NUMERIC DEFAULT 0,
  hero_u       NUMERIC DEFAULT 0,
  hero_v       NUMERIC DEFAULT 0,
  hero_y       NUMERIC DEFAULT 0,
  active_weapon_id TEXT DEFAULT 'pistol',
  inventory    JSONB DEFAULT '[]',
  quest_progress JSONB DEFAULT '[]',
  saved_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, world_name)
);

-- Scenes
CREATE TABLE IF NOT EXISTS engine_scenes (
  id            SERIAL PRIMARY KEY,
  user_id       TEXT NOT NULL,
  world_name    TEXT NOT NULL DEFAULT 'default',
  name          TEXT NOT NULL,
  description   TEXT DEFAULT '',
  objects       JSONB DEFAULT '[]',
  spawn_points  JSONB DEFAULT '[]',
  config_overrides JSONB DEFAULT '{}',
  is_public     BOOLEAN DEFAULT FALSE,
  tags          TEXT[] DEFAULT '{}',
  version       TEXT DEFAULT '1.0',
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, world_name, name)
);

CREATE INDEX IF NOT EXISTS idx_scenes_user ON engine_scenes(user_id);
CREATE INDEX IF NOT EXISTS idx_scenes_public ON engine_scenes(is_public) WHERE is_public = TRUE;

-- Assets
CREATE TABLE IF NOT EXISTS engine_assets (
  id               SERIAL PRIMARY KEY,
  user_id          TEXT NOT NULL,
  file_url         TEXT NOT NULL,
  format           TEXT NOT NULL CHECK (format IN ('glb','gltf','obj','fbx')),
  mtl_url          TEXT,
  texture_urls     JSONB DEFAULT '{}',
  display_name     TEXT NOT NULL,
  description      TEXT,
  tags             TEXT[] DEFAULT '{}',
  thumbnail_url    TEXT,
  polygon_count    INTEGER,
  has_animations   BOOLEAN DEFAULT FALSE,
  animation_names  TEXT[] DEFAULT '{}',
  recommended_scale NUMERIC DEFAULT 1.0,
  category         TEXT DEFAULT 'prop',
  is_hero_model    BOOLEAN DEFAULT FALSE,
  lod_urls         JSONB DEFAULT '[]',
  is_public        BOOLEAN DEFAULT FALSE,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assets_user ON engine_assets(user_id);

-- NPC dialogs
CREATE TABLE IF NOT EXISTS engine_npc_dialogs (
  id              SERIAL PRIMARY KEY,
  user_id         TEXT NOT NULL,
  world_name      TEXT NOT NULL DEFAULT 'default',
  npc_id          TEXT NOT NULL,
  npc_display_name TEXT NOT NULL,
  lines           JSONB NOT NULL DEFAULT '[]',
  entry_line      INTEGER DEFAULT 0,
  is_active       BOOLEAN DEFAULT TRUE,
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, world_name, npc_id)
);

-- Quest definitions
CREATE TABLE IF NOT EXISTS engine_quest_defs (
  id              SERIAL PRIMARY KEY,
  quest_id        TEXT NOT NULL UNIQUE,
  title           TEXT NOT NULL,
  description     TEXT,
  steps           JSONB NOT NULL DEFAULT '[]',
  triggers        JSONB DEFAULT '[]',
  completion_reward JSONB DEFAULT '{}',
  is_active       BOOLEAN DEFAULT TRUE,
  is_public       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO engine_quest_defs (quest_id, title, description, steps, is_public) VALUES
('intro', 'Explorer', 'Discover the world and collect coins scattered across the arena.',
 '[{"text":"Collect your first coin"},{"text":"Collect 3 coins"},{"text":"Collect all coins","reward":{"score_bonus":500}}]'::jsonb, true),
('combat', 'Fighter', 'Defeat enemies to prove your worth in the arena.',
 '[{"text":"Defeat your first enemy","reward":{"hp":10}},{"text":"Defeat 3 enemies","reward":{"score_bonus":300}}]'::jsonb, true),
('world', 'World Builder', 'Explore the 5DEngine build tools.',
 '[{"text":"Enter build mode (B)"},{"text":"Place a spawn point (N in build mode)","reward":{"score_bonus":100}}]'::jsonb, true)
ON CONFLICT (quest_id) DO NOTHING;

-- Quest progress
CREATE TABLE IF NOT EXISTS engine_quest_progress (
  id           SERIAL PRIMARY KEY,
  user_id      TEXT NOT NULL,
  quest_id     TEXT NOT NULL,
  steps_done   BOOLEAN[] DEFAULT '{}',
  is_complete  BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, quest_id)
);

CREATE INDEX IF NOT EXISTS idx_qp_user ON engine_quest_progress(user_id);

-- World objects
CREATE TABLE IF NOT EXISTS engine_world_objects (
  id          SERIAL PRIMARY KEY,
  user_id     TEXT NOT NULL,
  world_name  TEXT NOT NULL DEFAULT 'default',
  object_type TEXT NOT NULL,
  object_id   TEXT NOT NULL,
  u           NUMERIC DEFAULT 0,
  v           NUMERIC DEFAULT 0,
  heading     NUMERIC DEFAULT 0,
  color       BIGINT DEFAULT 4473924,
  building_facet JSONB,
  npc_facet      JSONB,
  enemy_facet    JSONB,
  vehicle_facet  JSONB,
  device_facet   JSONB,
  label       TEXT,
  is_active   BOOLEAN DEFAULT TRUE,
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, world_name, object_type, object_id)
);
