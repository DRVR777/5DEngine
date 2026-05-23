/** drop-on-death facet — on despawn with reason "killed", spawn the
 *  enemy variant's loot Things at the dying enemy's position. Loot
 *  table pulled from the spawn's mesh.tuning_ref variant tuning
 *  (drop_ammo, drop_qty, drop_health).
 *
 *  Lift-ready per docs/ACTOR_TRAJECTORY.md: spawn envelopes built as
 *  locals before delivering. This is the **THIRD spawn-envelope
 *  handler** after particle-emitter (iter 736) and hero-shoot (iter
 *  741). **STRIKE 3/3** — the actor lift's mutate+reach trigger
 *  condition is now met. Deferred behind user playability pivot;
 *  lift will land in a later iter (likely during HUD or screen-render
 *  phase per GAME_HTML_INVENTORY.md).
 *
 *  Data: { _dropped? } — sentinel so cleanup is idempotent if called
 *  twice for any reason. */
export default {
  priority: 29,
  tick() { /* no-op — drop happens on death via cleanup hook */ },

  cleanup(thing, data, registry, reason) {
    if (reason !== "killed") return;
    if (data && data._dropped) return;
    if (data) data._dropped = true;

    const pos = registry.facetData(thing.id, "position");
    if (!pos) return;
    const mesh = registry.facetData(thing.id, "mesh");
    if (!mesh?.tuning_ref) return;

    const loot = resolveLoot(mesh.tuning_ref, registry);
    if (!loot) return;
    const seq = Date.now() % 1000000;

    if (loot.drop_health > 0) {
      const envelope = {
        to: `health-pickup/drop-${thing.id.replace(/[/]/g, "_")}-${seq}`,
        message: {
          kind: "spawn",
          facets: [
            { name: "position", data: { x: pos.x + 0.25, y: 0.6, z: pos.z } },
            { name: "mesh",     data: { tuning_ref: "health-pickup-tuning" } },
            { name: "pickup-radius", data: { radius: 1.0, on_pickup_action: "heal", on_pickup_amount: loot.drop_health } },
          ],
        },
      };
      trySpawn(envelope, "health-pickup", registry);
    }

    if (loot.drop_qty > 0 && loot.drop_ammo) {
      const envelope = {
        to: `ammo-pickup/drop-${thing.id.replace(/[/]/g, "_")}-${seq}`,
        message: {
          kind: "spawn",
          facets: [
            { name: "position", data: { x: pos.x - 0.25, y: 0.6, z: pos.z } },
            { name: "mesh",     data: { tuning_ref: "ammo-pickup-tuning" } },
            { name: "pickup-radius", data: { radius: 1.0, on_pickup_action: "ammo", on_pickup_item: loot.drop_ammo, on_pickup_amount: loot.drop_qty } },
          ],
        },
      };
      trySpawn(envelope, "ammo-pickup", registry);
    }
  }
};

function resolveLoot(tuningName, registry) {
  for (const t of registry.byKind("tuning")) {
    if (t.name !== tuningName) continue;
    const tn = registry.facetData(t.id, "tuning") || {};
    return {
      drop_health: typeof tn.drop_health === "number" ? tn.drop_health : 0,
      drop_ammo:   typeof tn.drop_ammo   === "string" ? tn.drop_ammo   : "",
      drop_qty:    typeof tn.drop_qty    === "number" ? tn.drop_qty    : 0,
    };
  }
  return null;
}

function trySpawn(envelope, kind, registry) {
  try {
    registry.spawn({ id: envelope.to, kind, name: envelope.to, facets: envelope.message.facets });
  } catch (e) {
    console.warn(`[ankhor] drop-on-death spawn ${envelope.to}:`, e.message);
  }
}
