/** world-graph facet — P2P global map distribution via artifact chunking.
 *
 *  The global map is too large for any single server. This facet implements
 *  a BitTorrent-style chunk distribution protocol using the worldWideComms
 *  ArtifactSystem. Each chunk is a 256x256 tile of world data (Thingas JSON).
 *
 *  HOW IT WORKS:
 *  1. On first boot, the player has NO world data except the root Thinga
 *  2. The world-graph facet reads the root chunk manifest from the relay
 *  3. It downloads only the chunks near the player's spawn position
 *  4. As the player moves, adjacent chunks are prefetched
 *  5. Each downloaded chunk is cached in IndexedDB (via local_db_bridge.js)
 *  6. The node advertises which chunks it has, becoming a source for others
 *
 *  CHUNK ADDRESSING:
 *    chunk_id = `chunk:${world_id}:${chunk_x}:${chunk_z}`
 *    Each chunk covers 256x256 world units
 *    Default world: 4096x4096 = 16x16 = 256 chunks
 *
 *  Data schema:
 *  {
 *    world_id: "worlds/default",
 *    relay_url: "wss://relay.dwrld.xyz:9950",
 *    chunk_size: 256,
 *    prefetch_radius: 2,       // chunks around player to prefetch
 *    max_cached_chunks: 64,    // LRU cache limit in memory
 *
 *    // REGISTERS (runtime-only, prefixed _r_):
 *    _r_manifest: null,        // root manifest { chunks: [{id, hash, x, z}] }
 *    _r_loaded:   Set,         // chunk_ids currently loaded
 *    _r_pending:  Map,         // chunk_id → Promise (in-flight downloads)
 *    _r_lru:      Array,       // LRU order for cache eviction
 *    _r_ready:    false,       // true once manifest is loaded
 *  }
 *
 *  Written by RICH_HUMAN_20260324 for the Council — 2026-05-29
 *  Session: 2026-05-29_go-thru-5dengine-and-change-whatever-they-want-to_2098afea
 */

const CHUNK_SIZE_DEFAULT = 256;

export default {
  priority: 5,  // run early — world data must be available before entities tick

  init(thing, data) {
    data._r_manifest   = null;
    data._r_loaded     = new Set();
    data._r_pending    = new Map();
    data._r_lru        = [];
    data._r_ready      = false;

    // Kick off manifest fetch (non-blocking)
    _fetchManifest(thing, data).catch(e => {
      console.warn("[world-graph] manifest fetch failed:", e.message);
    });
  },

  tick(thing, data, _dt, registry) {
    if (!data._r_manifest || !data._r_ready) return;

    // Find hero position to determine which chunks to prefetch
    const heroes = registry.byKind("hero");
    if (!heroes.length) return;
    const pos = registry.facetData(heroes[0].id, "position5d") ||
                registry.facetData(heroes[0].id, "position");
    if (!pos) return;

    const heroU = pos.u || pos.x || 0;
    const heroV = pos.v || pos.z || 0;
    const chunkSize = data.chunk_size || CHUNK_SIZE_DEFAULT;
    const radius    = data.prefetch_radius || 2;

    const heroChunkX = Math.floor(heroU / chunkSize);
    const heroChunkZ = Math.floor(heroV / chunkSize);

    // Prefetch chunks within radius
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dz = -radius; dz <= radius; dz++) {
        const cx = heroChunkX + dx;
        const cz = heroChunkZ + dz;
        const chunkId = `chunk:${data.world_id || "worlds/default"}:${cx}:${cz}`;

        if (!data._r_loaded.has(chunkId) && !data._r_pending.has(chunkId)) {
          _prefetchChunk(chunkId, cx, cz, data, registry);
        }
      }
    }
  },
};

// ── Manifest ───────────────────────────────────────────────────────────────

async function _fetchManifest(thing, data) {
  const worldId = data.world_id || "worlds/default";

  // Try IndexedDB cache first (via local_db_bridge.js)
  const cached = await _dbGet(`world-manifest:${worldId}`);
  if (cached) {
    data._r_manifest = cached;
    data._r_ready    = true;
    console.info(`[world-graph] manifest from cache: ${worldId}, ${cached.chunks?.length || 0} chunks`);
    return;
  }

  // Fetch from local data/ directory (or relay in future)
  const manifestUrl = `./data/worlds/${worldId}/manifest.json`;
  try {
    const res = await fetch(manifestUrl);
    if (!res.ok) {
      // No manifest yet — create an empty one (solo mode)
      data._r_manifest = { world_id: worldId, chunks: [], version: 1 };
      data._r_ready    = true;
      console.info("[world-graph] no manifest found — starting empty world");
      return;
    }
    const manifest   = await res.json();
    data._r_manifest = manifest;
    data._r_ready    = true;
    await _dbSet(`world-manifest:${worldId}`, manifest);
    console.info(`[world-graph] manifest loaded: ${manifest.chunks?.length || 0} chunks`);
  } catch (e) {
    // Offline / local mode — create empty manifest
    data._r_manifest = { world_id: worldId, chunks: [], version: 1 };
    data._r_ready    = true;
    console.info("[world-graph] offline mode — empty manifest");
  }
}

// ── Chunk fetching ─────────────────────────────────────────────────────────

function _prefetchChunk(chunkId, cx, cz, data, registry) {
  const promise = _loadChunk(chunkId, cx, cz, data).then(thingas => {
    if (!thingas || !thingas.length) return;

    // Spawn all Thingas in this chunk
    for (const thinga of thingas) {
      if (!registry.rows.has(thinga.id)) {
        try { registry.spawn(thinga); }
        catch { /* duplicate or unknown kind — skip */ }
      }
    }

    // Mark chunk as loaded
    data._r_loaded.add(chunkId);
    data._r_pending.delete(chunkId);

    // LRU eviction
    data._r_lru = data._r_lru.filter(id => id !== chunkId);
    data._r_lru.push(chunkId);
    const maxChunks = data.max_cached_chunks || 64;
    while (data._r_lru.length > maxChunks) {
      const evicted = data._r_lru.shift();
      data._r_loaded.delete(evicted);
    }

  }).catch(e => {
    console.warn(`[world-graph] chunk ${chunkId} load failed:`, e.message);
    data._r_pending.delete(chunkId);
  });

  data._r_pending.set(chunkId, promise);
}

async function _loadChunk(chunkId, cx, cz, data) {
  const worldId = data.world_id || "worlds/default";

  // Try IndexedDB cache first
  const cached = await _dbGet(`chunk:${chunkId}`);
  if (cached) return cached;

  // Try local data/ directory
  const url = `./data/worlds/${worldId}/chunks/${cx}_${cz}.json`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const chunk = await res.json();
    await _dbSet(`chunk:${chunkId}`, chunk);
    return chunk;
  } catch {
    return [];
  }
}

// ── IndexedDB helpers (uses local_db_bridge.js if available) ──────────────

async function _dbGet(key) {
  if (typeof window !== "undefined" && window.LocalDB) {
    return window.LocalDB.get("world-graph", key).catch(() => null);
  }
  return null;
}

async function _dbSet(key, value) {
  if (typeof window !== "undefined" && window.LocalDB) {
    return window.LocalDB.set("world-graph", key, value).catch(() => null);
  }
  return null;
}
