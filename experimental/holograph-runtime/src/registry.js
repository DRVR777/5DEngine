const KIND_NAMES = [
  // Game entities
  "barrel", "crate", "bullet", "enemy", "pickup", "vehicle", "npc", "weapon",
  "hazard-zone", "speed-orb", "spawn-point", "screen", "hero",
  // Specific pickups (added per docs/codex/MIGRATION_PROGRESS.md as kinds are absorbed)
  "coin-drop", "health-pickup", "ammo-pickup", "weapon-pickup",
  "armor-shard", "armor-vest", "grenade-crate",
  // Combat extensions
  "mine", "turret", "grenade",
  // Ephemeral particles spawned by particle-emitter facet
  "smoke-particle",
  // Short-lived expanding-fading particle (muzzle flash, impact puff, etc.)
  "decal-particle",
  // Server / 7D kinds
  "server-process", "docker-container", "http-request", "database",
  "database-row", "nginx-route", "agent", "agent-message", "journal-event",
  // Singleton input device — captures keyboard/mouse, hero reads byKind("input")
  "input",
  // Singleton DOM overlay — hud-overlay facet owns its container
  "hud",
  // Singleton render context — boot.js stashes {THREE, scene, camera} here
  // so facets can reach Three.js without globals
  "render-context",
  // Singleton wave driver — spawns enemies in escalating waves
  "wave-spawner",
  // Invisible boundary wall — pure collider, no mesh
  "arena-wall",
  // Composition kinds — everything-is-a-Thinga architecture
  "root", "world", "kind-def", "spawn-set",
  // Meta kinds
  "tuning", "spec", "instruction"
];

export const Kind = Object.freeze(Object.fromEntries(KIND_NAMES.map((name) => [toConst(name), name])));

export class RegistryError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "RegistryError";
    this.code = code;
    this.details = details;
  }
}

export class ThingRegistry {
  constructor({ now = () => new Date().toISOString() } = {}) {
    this.now = now;
    this.rows = new Map();
    this.facetStore = new Map();
    this.kindRegistry = new Map();
    this.reverseFacetIndex = new Map();
    this.handlerRegistry = new Map();
    this.refIndex = new Map();
    this.subscribers = new Set();
  }

  registerKind(kind, definition = {}) {
    assertKnownKind(kind);
    this.kindRegistry.set(kind, {
      requiredFacets: definition.requiredFacets || [],
      optionalFacets: definition.optionalFacets || [],
      priority: definition.priority || 100,
      ...definition
    });
    return this;
  }

  registerFacetHandler(name, handler) {
    if (!name || typeof handler !== "object") throw new RegistryError("BAD_HANDLER", "facet handler must be an object", { name });
    this.handlerRegistry.set(name, {
      priority: handler.priority ?? 100,
      tick: handler.tick || null,
      init: handler.init || null,
      cleanup: handler.cleanup || null,
      ...handler
    });
    return this;
  }

  subscribe(fn) {
    this.subscribers.add(fn);
    return () => this.subscribers.delete(fn);
  }

  spawn(input) {
    const thing = normalizeThing(input, this.now);
    assertKnownKind(thing.kind);
    if (this.rows.has(thing.id) && !this.rows.get(thing.id).deleted_at) throw new RegistryError("DUPLICATE_ID", `Thing already exists: ${thing.id}`, { id: thing.id });
    const kindDef = this.kindRegistry.get(thing.kind);
    if (kindDef) {
      for (const facetName of kindDef.requiredFacets || []) {
        if (!thing.facets.some((facet) => facet.name === facetName)) throw new RegistryError("MISSING_REQUIRED_FACET", `${thing.kind} requires ${facetName}`, { thing: thing.id, facet: facetName });
      }
    }
    this.rows.set(thing.id, thing);
    this._indexRef(thing);
    for (const facet of thing.facets) this._setFacet(thing.id, facet.name, facet.data ?? {}, { init: true });
    this._emit({ type: "spawn", thing: clone(thing) });
    return thing;
  }

  updateFacet(id, name, data) {
    const thing = this.get(id);
    this._setFacet(id, name, data, { init: false });
    const existing = thing.facets.find((facet) => facet.name === name);
    if (existing) existing.data = data;
    else thing.facets.push({ name, data });
    this._emit({ type: "update", id, facet: name, data: clone(data) });
  }

  tick(dt) {
    const ordered = [...this.handlerRegistry.entries()].sort((a, b) => a[1].priority - b[1].priority);
    for (const [facetName, handler] of ordered) {
      if (!handler.tick) continue;
      for (const id of this.byFacet(facetName)) {
        const thing = this.rows.get(id);
        if (!thing || thing.deleted_at) continue;
        handler.tick(thing, this.facetData(id, facetName), dt, this);
      }
    }
    this._emit({ type: "tick", dt });
  }

  despawn(id, reason = "despawn") {
    const thing = this.get(id);
    if (thing.deleted_at) return thing;
    for (const facet of [...thing.facets]) {
      const handler = this.handlerRegistry.get(facet.name);
      if (handler?.cleanup) handler.cleanup(thing, this.facetData(id, facet.name), this, reason);
    }
    thing.deleted_at = this.now();
    thing.delete_reason = reason;
    for (const facet of thing.facets) {
      this.facetStore.get(facet.name)?.delete(id);
      this.reverseFacetIndex.get(facet.name)?.delete(id);
    }
    this._removeRef(thing);
    this._emit({ type: "despawn", id, reason, deleted_at: thing.deleted_at });
    return thing;
  }

  get(id) {
    const thing = this.rows.get(id);
    if (!thing) throw new RegistryError("UNKNOWN_THING", `No Thing exists for id: ${id}`, { id });
    return thing;
  }

  byKind(kind) {
    assertKnownKind(kind);
    return [...this.rows.values()].filter((thing) => thing.kind === kind && !thing.deleted_at);
  }

  byFacet(name) {
    return new Set(this.reverseFacetIndex.get(name) || []);
  }

  facetData(id, name) {
    return this.facetStore.get(name)?.get(id) ?? null;
  }

  resolveRef(ref) {
    const live = (this.refIndex.get(ref) || []).filter((id) => !this.rows.get(id)?.deleted_at);
    if (live.length === 1) return this.get(live[0]);
    if (live.length === 0) throw new RegistryError("REF_NOT_FOUND", `Reference did not resolve: ${ref}`, { ref });
    throw new RegistryError("REF_COLLISION", `Reference resolved to multiple Things: ${ref}`, { ref, ids: live });
  }

  toJSON() {
    return [...this.rows.values()].map(clone);
  }

  _setFacet(id, name, data, { init }) {
    if (!this.facetStore.has(name)) this.facetStore.set(name, new Map());
    if (!this.reverseFacetIndex.has(name)) this.reverseFacetIndex.set(name, new Set());
    this.facetStore.get(name).set(id, data);
    this.reverseFacetIndex.get(name).add(id);
    if (init) this.handlerRegistry.get(name)?.init?.(this.get(id), data, this);
  }

  _indexRef(thing) {
    for (const ref of [thing.id, thing.name].filter(Boolean)) {
      if (!this.refIndex.has(ref)) this.refIndex.set(ref, []);
      this.refIndex.get(ref).push(thing.id);
    }
  }

  _removeRef(thing) {
    for (const ref of [thing.id, thing.name].filter(Boolean)) {
      const next = (this.refIndex.get(ref) || []).filter((id) => id !== thing.id);
      if (next.length) this.refIndex.set(ref, next);
      else this.refIndex.delete(ref);
    }
  }

  _emit(event) {
    for (const fn of this.subscribers) fn(event);
  }
}

export function createDefaultRegistry(options = {}) {
  const registry = new ThingRegistry(options);
  for (const kind of KIND_NAMES) registry.registerKind(kind);
  return registry;
}

function normalizeThing(input, now) {
  if (!input || typeof input !== "object") throw new RegistryError("BAD_THING", "Thing must be an object");
  if (!input.id || !input.kind || !input.name) throw new RegistryError("BAD_THING", "Thing requires id, kind, and name", { input });
  return {
    id: input.id,
    kind: input.kind,
    name: input.name,
    parent: input.parent || null,
    created_at: input.created_at || now(),
    deleted_at: input.deleted_at || null,
    facets: Array.isArray(input.facets) ? input.facets.map(normalizeFacet) : []
  };
}

function normalizeFacet(facet) {
  if (typeof facet === "string") return { name: facet, data: {} };
  if (!facet?.name) throw new RegistryError("BAD_FACET", "Facet requires name", { facet });
  return { name: facet.name, data: facet.data ?? {} };
}

function assertKnownKind(kind) {
  if (!KIND_NAMES.includes(kind)) throw new RegistryError("UNKNOWN_KIND", `Unknown kind: ${kind}`, { kind });
}

function toConst(name) {
  return name.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
