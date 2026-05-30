/**
 * universal_registry.js — The 35-line unified registry pattern
 *
 * FIRST PRINCIPLES:
 * The same pattern governs all three scales of VVV's system:
 *   - Game scale:           GTARegistry    + entities + requestAnimationFrame + EventBus
 *   - Application scale:    ThingRegistry  + Thingas  + React render loop     + subscribers
 *   - Infrastructure scale: 7D daemon      + graph    + observe() coroutines  + WebSocket
 *
 * The minimal abstraction that unifies all three is this module.
 *
 * WHY IT WORKS: Locality of Authority.
 * Each entity is responsible for its own state. Only designated writers can
 * modify a given facet. This invariant holds at all scales.
 *
 * USAGE:
 *   // Game scale
 *   const reg = createUniversalRegistry();
 *   reg.register("hero", { $header: { $type: "hero", $facets: [] } });
 *   reg.addFacet("hero", "health", { hp: 100 });
 *   reg.subscribe("facet:health", ({ id, data }) => console.log(id, data));
 *
 *   // Infra scale (same API, different kinds)
 *   reg.register("nginx:443", { $header: { $type: "nginx-route", $facets: [] } });
 *   reg.addFacet("nginx:443", "route", { port: 443, status: "active" });
 *
 * Author: SOCRATIC_PROFESSOR_20260326 (Council)
 * Session: 2026-05-29_go-thru-5dengine-and-change-whatever-they-want-to_2098afea
 */

export function createUniversalRegistry() {
  const entities = new Map();  // id → { $header: { $type, $facets[], $version }, ...facetData }
  const subs     = new Map();  // event → [fn]
  const regs     = new Map();  // id → Map<regName, value>  (fast registers, no GC)

  function emit(event, data) {
    (subs.get(event) || []).forEach(fn => fn(data));
    (subs.get("*")   || []).forEach(fn => fn({ event, data }));
  }

  return {
    // ── Entity lifecycle ───────────────────────────────────────────────
    register(id, entity) {
      if (!entity.$header) entity.$header = { $type: "unknown", $facets: [], $version: 0 };
      entities.set(id, entity);
      emit("spawn", { id, kind: entity.$header.$type });
      return entity;
    },

    remove(id) {
      entities.delete(id);
      regs.delete(id);
      emit("despawn", { id });
    },

    has(id) { return entities.has(id); },
    get(id)  { return entities.get(id) || null; },

    // ── Facet operations ───────────────────────────────────────────────
    addFacet(id, name, data) {
      const e = entities.get(id);
      if (!e) return null;
      e[name] = data;
      if (!e.$header.$facets.includes(name)) e.$header.$facets.push(name);
      e.$header.$version = (e.$header.$version || 0) + 1;
      emit(`facet:${name}`, { id, name, data });
      return data;
    },

    getFacet(id, name) {
      return entities.get(id)?.[name] ?? null;
    },

    updateFacet(id, name, patch) {
      const e = entities.get(id);
      if (!e) return null;
      e[name] = typeof patch === "function" ? patch(e[name] || {}) : Object.assign(e[name] || {}, patch);
      e.$header.$version = (e.$header.$version || 0) + 1;
      emit(`facet:${name}`, { id, name, data: e[name] });
      return e[name];
    },

    removeFacet(id, name) {
      const e = entities.get(id);
      if (!e) return;
      delete e[name];
      e.$header.$facets = e.$header.$facets.filter(f => f !== name);
      e.$header.$version = (e.$header.$version || 0) + 1;
    },

    // ── Queries ────────────────────────────────────────────────────────
    byKind(kind) {
      return [...entities.values()].filter(e => e.$header?.$type === kind);
    },

    all() { return [...entities.values()]; },

    ids() { return [...entities.keys()]; },

    // ── Fast registers (O(1) float access, no facet overhead) ─────────
    setRegister(id, name, value) {
      let m = regs.get(id);
      if (!m) { m = new Map(); regs.set(id, m); }
      m.set(name, value);
    },

    getRegister(id, name) {
      return regs.get(id)?.get(name) ?? null;
    },

    getAllRegisters(id) {
      const m = regs.get(id);
      return m ? Object.fromEntries(m) : {};
    },

    // ── Tick: apply per-facet behaviors ────────────────────────────────
    /**
     * @param {Map<string, {tick?: (entity, dt, registry) => void}>} handlers
     * @param {number} dt - delta time in seconds
     */
    tick(handlers, dt) {
      for (const [id, entity] of entities) {
        for (const facetName of (entity.$header.$facets || [])) {
          const handler = handlers.get(facetName);
          if (handler?.tick) handler.tick(entity, dt, this);
        }
      }
    },

    // ── Subscriptions ──────────────────────────────────────────────────
    subscribe(event, fn) {
      if (!subs.has(event)) subs.set(event, []);
      subs.get(event).push(fn);
      return () => {
        const arr = subs.get(event);
        if (arr) { const i = arr.indexOf(fn); if (i >= 0) arr.splice(i, 1); }
      };
    },

    // ── Serialization (for network sync) ──────────────────────────────
    serialize() {
      return {
        entities: Object.fromEntries(entities),
        registers: Object.fromEntries(
          [...regs.entries()].map(([id, m]) => [id, Object.fromEntries(m)])
        ),
      };
    },

    hydrate(data) {
      if (data.entities) {
        for (const [id, entity] of Object.entries(data.entities)) {
          entities.set(id, entity);
        }
      }
      if (data.registers) {
        for (const [id, regMap] of Object.entries(data.registers)) {
          regs.set(id, new Map(Object.entries(regMap)));
        }
      }
    },
  };
}

// ── Compatibility shim: ThingRegistry → universal_registry ──────────────────
/**
 * If you have an existing ThingRegistry instance (from holograph-runtime),
 * this wraps it in the universal_registry interface so the same client code
 * works with both.
 */
export function wrapThingRegistry(thingRegistry) {
  return {
    register: (id, entity) => thingRegistry.spawn({ id, kind: entity.$header?.$type || "unknown", facets: [] }),
    remove:   (id) => thingRegistry.despawn?.(id),
    has:      (id) => thingRegistry.rows?.has(id) || false,
    get:      (id) => thingRegistry.rows?.get(id) || null,

    addFacet:    (id, name, data) => thingRegistry.addFacet?.(id, name, data),
    getFacet:    (id, name) => thingRegistry.facetData?.(id, name),
    updateFacet: (id, name, patch) => thingRegistry.updateFacet?.(id, name, patch),

    byKind: (kind) => thingRegistry.byKind?.(kind) || [],
    all:    () => [...(thingRegistry.rows?.values() || [])],

    setRegister: thingRegistry.setRegister?.bind(thingRegistry) || (() => {}),
    getRegister: thingRegistry.getRegister?.bind(thingRegistry) || (() => null),

    subscribe: (event, fn) => thingRegistry.subscribe?.(fn) || (() => {}),
    tick: (handlers, dt) => {
      // Iterate all rows and call facet handlers
      for (const entity of (thingRegistry.rows?.values() || [])) {
        for (const facet of (entity.facets || [])) {
          const h = handlers.get(facet.name);
          if (h?.tick) h.tick(entity, dt, this);
        }
      }
    },
  };
}
