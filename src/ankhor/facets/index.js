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
import enemyShoot     from "./enemy_shoot.js";
import inputState     from "./input_state.js";
import heroInputMove  from "./hero_input_move.js";
import heroShoot      from "./hero_shoot.js";
import heartbeat      from "./heartbeat.js";
import heroRegen     from "./hero_regen.js";
import burn           from "./burn.js";
import enemyDeathCleanup from "./enemy_death_cleanup.js";
import destructibleExplode from "./destructible_explode.js";
import dropOnDeath    from "./drop_on_death.js";
import heroRespawn    from "./hero_respawn.js";
import hudOverlay     from "./hud_overlay.js";
import damageFlash    from "./damage_flash.js";
import fpsTick        from "./fps_tick.js";
import healthDisplay  from "./health_display.js";
import aabbCollision  from "./aabb_collision.js";
import expandFade     from "./expand_fade.js";
import waveSpawner    from "./wave_spawner.js";
import vehicleEnterPrompt from "./vehicle_enter_prompt.js";
import vehicleDrive   from "./vehicle_drive.js";
import legacyMount    from "./legacy_mount.js";
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
  "enemy-shoot":         enemyShoot,
  "input-state":         inputState,
  "hero-input-move":     heroInputMove,
  "hero-shoot":          heroShoot,
  "heartbeat":           heartbeat,
  "hero-regen":          heroRegen,
  "burn":                burn,
  "enemy-death-cleanup": enemyDeathCleanup,
  "destructible-explode": destructibleExplode,
  "drop-on-death":       dropOnDeath,
  "hero-respawn":        heroRespawn,
  "hud-overlay":         hudOverlay,
  "damage-flash":        damageFlash,
  "fps-tick":            fpsTick,
  "health-display":      healthDisplay,
  "aabb-collision":      aabbCollision,
  "expand-fade":         expandFade,
  "wave-spawner":        waveSpawner,
  "vehicle-enter-prompt": vehicleEnterPrompt,
  "vehicle-drive":       vehicleDrive,
  "legacy-mount":        legacyMount,
  "ttl":                 ttl,
  // server-side data-container facets (no tick)
  "health":              { priority: 25 },
  "destructible":        { priority: 30 },
  "process-observer":    { priority: 50 },
  "request-stream":      { priority: 51 },
  "db-connection":       { priority: 52 },
  "agent-message":       { priority: 53 },
  // hero inventory — data only, written by pickup-radius effects
  "inventory":           { priority: 24 },
  // pickup-side data containers (read by pickup-radius dispatcher)
  "heal":                { priority: 41 },
  "ammo":                { priority: 41 },
  "armor":               { priority: 41 },
  "value":               { priority: 41 },
  // AABB extents — read by aabb-collision; data only
  "collider":            { priority: 42 },
  // Render context — refs to THREE+scene+camera; spawned by boot.js after
  // scene setup so facets like health-display can reach the render layer
  // without globals.
  "render-context":      { priority: 1 },
};

export function installFacetHandlers(registry) {
  for (const [name, handler] of Object.entries(FACET_HANDLERS)) {
    registry.registerFacetHandler(name, handler);
  }
}
