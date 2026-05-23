/** Aggregates per-facet handler modules. Add a new facet by importing it here
 *  and adding it to FACET_HANDLERS under its facet name. */
import position      from "./position.js";
import bob           from "./bob.js";
import spin          from "./spin.js";
import emissivePulse from "./emissive_pulse.js";
import opacityPulse  from "./opacity_pulse.js";
import magnet        from "./magnet.js";
import pickupRadius    from "./pickup_radius.js";
import respawnOnCollect from "./respawn_on_collect.js";
import damageZone      from "./damage_zone.js";
import statusZone      from "./status_zone.js";
import heroBroadcaster from "./hero_broadcaster.js";
import kineticHit      from "./kinetic_hit.js";
import particleEmitter from "./particle_emitter.js";
import chaseTarget    from "./chase_target.js";
import attackTarget   from "./attack_target.js";
import inputState     from "./input_state.js";
import heroInputMove  from "./hero_input_move.js";
import heroShoot      from "./hero_shoot.js";
import ttl             from "./ttl.js";

export const FACET_HANDLERS = {
  "position":            position,
  "bob":                 bob,
  "spin":                spin,
  "emissive-pulse":      emissivePulse,
  "opacity-pulse":       opacityPulse,
  "magnet":              magnet,
  "pickup-radius":       pickupRadius,
  "respawn-on-collect":  respawnOnCollect,
  "damage-zone":         damageZone,
  "status-zone":         statusZone,
  "hero-broadcaster":    heroBroadcaster,
  "kinetic-hit":         kineticHit,
  "particle-emitter":    particleEmitter,
  "chase-target":        chaseTarget,
  "attack-target":       attackTarget,
  "input-state":         inputState,
  "hero-input-move":     heroInputMove,
  "hero-shoot":          heroShoot,
  "ttl":                 ttl,
  // server-side data-container facets (no tick)
  "health":              { priority: 25 },
  "destructible":        { priority: 30 },
  "process-observer":    { priority: 50 },
  "request-stream":      { priority: 51 },
  "db-connection":       { priority: 52 },
  "agent-message":       { priority: 53 },
};

export function installFacetHandlers(registry) {
  for (const [name, handler] of Object.entries(FACET_HANDLERS)) {
    registry.registerFacetHandler(name, handler);
  }
}
