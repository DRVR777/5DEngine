import { describe, expect, it, vi } from "vitest";
import { createDefaultRegistry, RegistryError } from "../experimental/holograph-runtime/src/registry.js";
import { installDefaultHandlers } from "../experimental/holograph-runtime/src/handlers.js";

function barrel(id = "barrel/1") {
  return {
    id,
    kind: "barrel",
    name: "Explosive Barrel",
    facets: [
      { name: "position", data: { x: 0, y: 0, z: 0 } },
      { name: "health", data: { hp: 40, maxHp: 40 } },
      { name: "destructible", data: { blastRadius: 3.5, damage: 60 } }
    ]
  };
}

describe("ThingRegistry", () => {
  it("spawns Things and indexes facets", () => {
    const registry = createDefaultRegistry();
    registry.registerKind("barrel", { requiredFacets: ["position", "health", "destructible"] });
    registry.spawn(barrel());
    expect(registry.get("barrel/1").kind).toBe("barrel");
    expect([...registry.byFacet("health")]).toEqual(["barrel/1"]);
  });

  it("fails loud for duplicate ids and missing required facets", () => {
    const registry = createDefaultRegistry();
    registry.registerKind("barrel", { requiredFacets: ["health"] });
    registry.spawn(barrel());
    expect(() => registry.spawn(barrel())).toThrow(RegistryError);
    expect(() => registry.spawn({ id: "barrel/2", kind: "barrel", name: "bad", facets: [] })).toThrow(/requires health/);
  });

  it("ticks handlers in priority order", () => {
    const registry = installDefaultHandlers(createDefaultRegistry());
    registry.spawn({ id: "req/1", kind: "http-request", name: "GET /", facets: [{ name: "ttl", data: { remaining: 0.1 } }] });
    registry.tick(0.2);
    expect(registry.get("req/1").deleted_at).toBeTruthy();
  });

  it("broadcasts cleanup on despawn", () => {
    const cleanup = vi.fn();
    const registry = createDefaultRegistry();
    registry.registerFacetHandler("health", { cleanup });
    registry.spawn(barrel());
    registry.despawn("barrel/1", "test");
    expect(cleanup).toHaveBeenCalledOnce();
    expect(registry.byFacet("health").size).toBe(0);
  });

  it("throws on reference collisions", () => {
    const registry = createDefaultRegistry();
    registry.spawn({ ...barrel("barrel/a"), name: "same" });
    registry.spawn({ ...barrel("barrel/b"), name: "same" });
    expect(() => registry.resolveRef("same")).toThrow(/multiple Things/);
  });
});
