export const facetHandlers = {
  position: {
    priority: 10,
    tick(_thing, data, dt) {
      if (!data.velocity) return;
      data.x = (data.x || 0) + (data.velocity.x || 0) * dt;
      data.y = (data.y || 0) + (data.velocity.y || 0) * dt;
      data.z = (data.z || 0) + (data.velocity.z || 0) * dt;
    }
  },
  ttl: {
    priority: 90,
    tick(thing, data, dt, registry) {
      data.remaining = (data.remaining ?? 0) - dt;
      if (data.remaining <= 0) registry.despawn(thing.id, "ttl-expired");
    }
  },
  health: { priority: 20 },
  destructible: { priority: 30 },
  mesh: { priority: 70 },
  "process-observer": { priority: 40 },
  "request-stream": { priority: 40 },
  "db-connection": { priority: 40 },
  "agent-message": { priority: 40 }
};

export function installDefaultHandlers(registry) {
  for (const [name, handler] of Object.entries(facetHandlers)) registry.registerFacetHandler(name, handler);
  return registry;
}
