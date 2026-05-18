/**
 * registry.js — Universal FacetRegistry for 5DEngine
 *
 * The F=ma of this codebase. Every game object is an atom:
 *   { $header: { $version, $type, $facets, $refs, $meta }, ...facetData }
 *
 * The registry holds one parser per facet type. Adding a new game concept
 * (weapon, enemy, perk, network node, agent identity) means adding ONE entry
 * to this registry — not a new file structure, not new API routes, not new
 * validation logic. The infrastructure is constant. Only entries grow.
 *
 * This is the same pattern as Temporal Nexus / theC0UNCIL / decentralizeAiNetwork:
 *   identity file + packet → API call → indexed output
 *   $header + $facets → registry lookup → validated data
 *
 * Registry entries implement FacetParser:
 *   { id, name, validate(data) → { ok, data, error } }
 *
 * Usage:
 *   import { Registry } from "./src/core/registry.js";
 *   Registry.register(weaponFacet);
 *   const parsed = Registry.parse(rawWeaponJson);
 */

export const Registry = (() => {
  "use strict";

  const _facets = new Map();   // Map<facetId, FacetParser>
  const _types  = new Map();   // Map<$type, TypeConfig>
  const ATOM_VERSION = "1.0";

  // ── FacetParser contract ───────────────────────────────────────────────────
  // Every facet parser must implement: { id, name, validate(data) }

  function register(parser) {
    if (!parser.id || typeof parser.validate !== "function") {
      throw new Error(`Registry.register: parser missing id or validate(). Got: ${JSON.stringify(parser)}`);
    }
    _facets.set(parser.id, parser);
    return parser;
  }

  function registerType(config) {
    // config: { type, requiredFacets, optionalFacets }
    _types.set(config.type, config);
  }

  function get(facetId) {
    return _facets.get(facetId) ?? null;
  }

  // ── Atom parsing ───────────────────────────────────────────────────────────
  // An atom is any object with a $header. The registry validates each facet.

  function parse(atom) {
    const hdr = atom?.$header;
    if (!hdr) return { ok: false, error: "Missing $header", atom };
    if (hdr.$version !== ATOM_VERSION) return { ok: false, error: `Unknown version: ${hdr.$version}`, atom };

    const facetIds = hdr.$facets ?? [];
    const parsedFacets = {};

    for (const fid of facetIds) {
      const parser = _facets.get(fid);
      if (!parser) {
        // Unknown facet — passthrough (forward-compatibility)
        parsedFacets[fid] = atom[fid] ?? {};
        continue;
      }
      const result = parser.validate(atom[fid] ?? {});
      if (!result.ok) return { ok: false, error: `Facet '${fid}': ${result.error}`, atom };
      parsedFacets[fid] = result.data;
    }

    return {
      ok: true,
      type: hdr.$type,
      facets: facetIds,
      refs: hdr.$refs ?? [],
      meta: hdr.$meta ?? {},
      data: parsedFacets,
      raw: atom,
    };
  }

  // ── Atom construction ──────────────────────────────────────────────────────
  // Build a well-formed atom from facet data.

  function build(type, facets, refs = [], meta = {}) {
    const atom = {
      $header: {
        $version: ATOM_VERSION,
        $type: type,
        $facets: Object.keys(facets),
        $refs: refs,
        $meta: { source: "5DEngine", createdAt: new Date().toISOString(), ...meta },
      },
    };
    Object.assign(atom, facets);
    return atom;
  }

  // ── Schema auto-detection ──────────────────────────────────────────────────
  // Detect what kind of atom we're looking at without being told.

  function detect(data) {
    if (!data || typeof data !== "object") return null;
    if (data.$header?.$type) return data.$header.$type;
    // Structural fingerprinting fallback
    if (Array.isArray(data)) return null;
    if ("hp" in data && "moveSpeed" in data) return "entity";
    if ("damage" in data && "fireRate" in data) return "weapon";
    if ("effect" in data && "color" in data) return "perk";
    if ("cost" in data && "effect" in data) return "shop_item";
    if ("components" in data) return "prefab";
    if ("fn" in data && "priority" in data) return "system";
    return "unknown";
  }

  // ── dworld:// pointer resolution ───────────────────────────────────────────
  // $refs use format: "protocol:value"
  //   uuid:abc-123            → local entity ID
  //   title:Grunt             → entity by type label
  //   dworld://agent/xyz      → remote agent identity
  //   dworld://field/xyz      → semantic field node
  //   path:enemies/grunt      → data file path

  function resolveRef(ref) {
    const { $ref, $rel } = ref;
    if (!$ref) return null;
    const colon = $ref.indexOf(":");
    if (colon < 0) return { protocol: "raw", value: $ref, rel: $rel };
    const protocol = $ref.slice(0, colon);
    const value    = $ref.slice(colon + 1);
    return { protocol, value, rel: $rel };
  }

  // ── Snapshot ───────────────────────────────────────────────────────────────

  function snapshot() {
    return {
      facets: [..._facets.keys()],
      types:  [..._types.keys()],
      version: ATOM_VERSION,
    };
  }

  // ── Built-in facet parsers ─────────────────────────────────────────────────
  // Minimal validate() functions. ok=true + coerced data, or ok=false + error.

  const _ok  = data => ({ ok: true,  data });
  const _err = msg  => ({ ok: false, error: msg });

  function _num(v, field)  { return typeof v === "number" ? null : `${field} must be a number (got ${typeof v})`; }
  function _str(v, field)  { return typeof v === "string" ? null : `${field} must be a string (got ${typeof v})`; }
  function _bool(v, field) { return typeof v === "boolean" ? null : `${field} must be boolean (got ${typeof v})`; }

  // entity facet — spatial + visual identity
  register({
    id: "entity",
    name: "Entity",
    validate(d) {
      if (_num(d.bodyRadius, "bodyRadius")) return _err(_num(d.bodyRadius, "bodyRadius"));
      if (_num(d.bodyHeight, "bodyHeight")) return _err(_num(d.bodyHeight, "bodyHeight"));
      return _ok({ bodyRadius: d.bodyRadius, bodyHeight: d.bodyHeight, color: d.color ?? "0xffffff" });
    },
  });

  // combat facet — HP, damage, ranges
  register({
    id: "combat",
    name: "Combat",
    validate(d) {
      const required = ["hp", "maxHp", "damage", "attackRange", "moveSpeed"];
      for (const f of required) if (_num(d[f], f)) return _err(_num(d[f], f));
      return _ok({
        hp: d.hp, maxHp: d.maxHp,
        damage: d.damage, attackRange: d.attackRange,
        sightRange: d.sightRange ?? 12,
        moveSpeed: d.moveSpeed, wanderSpeed: d.wanderSpeed ?? 1.0,
        frontalArmor: d.frontalArmor ?? false,
        ability: d.ability ?? null,
      });
    },
  });

  // loot facet — drop table
  register({
    id: "loot",
    name: "Loot",
    validate(d) {
      return _ok({
        dropAmmo:   d.dropAmmo   ?? null,
        dropQty:    d.dropQty    ?? 0,
        dropHealth: d.dropHealth ?? 0,
      });
    },
  });

  // weapon facet — ballistics + fire control
  register({
    id: "weapon",
    name: "Weapon",
    validate(d) {
      const required = ["id", "damage", "fireRate", "range", "speed", "magCap"];
      for (const f of required) if (f === "id" ? _str(d[f], f) : _num(d[f], f)) {
        return _err((f === "id" ? _str : _num)(d[f], f));
      }
      return _ok({
        id:             d.id,
        name:           d.name ?? d.id,
        ammoItem:       d.ammoItem ?? "pistol_9mm",
        fireRate:       d.fireRate,
        damage:         d.damage,
        range:          d.range,
        speed:          d.speed,
        magCap:         d.magCap,
        bulletRadius:   d.bulletRadius ?? 0.025,
        reloadDuration: d.reloadDuration ?? 1500,
        pellets:        d.pellets ?? 1,
        spread:         d.spread ?? 0,
        automatic:      d.automatic ?? false,
        falloff:        d.falloff ?? 1.0,
      });
    },
  });

  // perk facet — player upgrade
  register({
    id: "perk",
    name: "Perk",
    validate(d) {
      if (_str(d.id,    "id"))    return _err(_str(d.id, "id"));
      if (_str(d.label, "label")) return _err(_str(d.label, "label"));
      return _ok({ id: d.id, label: d.label, desc: d.desc ?? "", color: d.color ?? "#ffffff" });
    },
  });

  // effect facet — declarative mutation (what applying the perk does)
  register({
    id: "effect",
    name: "Effect",
    validate(d) {
      if (_str(d.op, "op")) return _err(_str(d.op, "op"));
      return _ok({ op: d.op, target: d.target ?? null, value: d.value ?? 0, ...d });
    },
  });

  // shop_item facet
  register({
    id: "shop_item",
    name: "Shop Item",
    validate(d) {
      if (_str(d.id,   "id"))   return _err(_str(d.id,   "id"));
      if (_str(d.name, "name")) return _err(_str(d.name, "name"));
      if (_num(d.cost, "cost")) return _err(_num(d.cost, "cost"));
      return _ok({ id: d.id, name: d.name, desc: d.desc ?? "", cost: d.cost });
    },
  });

  // prefab facet — entity template
  register({
    id: "prefab",
    name: "Prefab",
    validate(d) {
      if (typeof d.components !== "object") return _err("prefab.components must be an object");
      return _ok({ extends: d.extends ?? null, components: d.components });
    },
  });

  // net_node facet — dworld:// / mkii network identity
  register({
    id: "net_node",
    name: "Net Node",
    validate(d) {
      return _ok({
        peerId:      d.peerId ?? null,
        channel:     d.channel ?? 0,
        protocol:    d.protocol ?? "mkii",
        dworldUri:   d.dworldUri ?? null,
        identityId:  d.identityId ?? null,
      });
    },
  });

  // agent facet — decentralized AI agent identity (from decentralizeAiNetwork)
  register({
    id: "agent",
    name: "Agent",
    validate(d) {
      return _ok({
        identityId:    d.identityId ?? null,
        embeddingDim:  d.embeddingDim ?? 384,
        embeddingModel: d.embeddingModel ?? "all-MiniLM-L6-v2",
        dworldUri:     d.dworldUri ?? null,
        hopHistory:    d.hopHistory ?? [],
      });
    },
  });

  // ── Type configs ───────────────────────────────────────────────────────────
  registerType({ type: "entity",    requiredFacets: ["entity", "combat"], optionalFacets: ["loot", "net_node"] });
  registerType({ type: "weapon",    requiredFacets: ["weapon"],           optionalFacets: [] });
  registerType({ type: "perk",      requiredFacets: ["perk", "effect"],   optionalFacets: [] });
  registerType({ type: "shop_item", requiredFacets: ["shop_item"],        optionalFacets: ["effect"] });
  registerType({ type: "prefab",    requiredFacets: ["prefab"],           optionalFacets: [] });
  registerType({ type: "net_node",  requiredFacets: ["net_node"],         optionalFacets: ["agent"] });

  return Object.freeze({ register, registerType, get, parse, build, detect, resolveRef, snapshot });
})();

export default Registry;
