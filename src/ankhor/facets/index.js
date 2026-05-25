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
import heroFace       from "./hero_face.js";
import heroShoot      from "./hero_shoot.js";
import camShake       from "./cam_shake.js";
import camPitchSprings from "./cam_pitch_springs.js";
import heroKnockback  from "./hero_knockback.js";
import dodge          from "./dodge.js";
import crouchSpeed    from "./crouch_speed.js";
import freecam        from "./freecam.js";
import layerTransition from "./layer_transition.js";
import motionSprings  from "./motion_springs.js";
import sniperSway     from "./sniper_sway.js";
import jumpGravity    from "./jump_gravity.js";
import vignette       from "./vignette.js";
import scopeFov       from "./scope_fov.js";
import clockHud       from "./clock_hud.js";
import footstepSound  from "./footstep_sound.js";
import heartbeat      from "./heartbeat.js";
import dayNight     from "./day_night.js";
import lighting     from "./lighting.js";
import weather      from "./weather.js";
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
  "hero-face":           heroFace,
  "hero-shoot":          heroShoot,
  "cam-shake":           camShake,
  "cam-pitch-springs":   camPitchSprings,
  "hero-knockback":      heroKnockback,
  "dodge":               dodge,
  "crouch-speed":        crouchSpeed,
  "freecam":             freecam,
  "layer-transition":    layerTransition,
  "motion-springs":      motionSprings,
  "sniper-sway":         sniperSway,
  "jump-gravity":        jumpGravity,
  "vignette":            vignette,
  "scope-fov":           scopeFov,
  "clock-hud":           clockHud,
  "footstep-sound":      footstepSound,
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

  // CONFIG FACETS — authoritative data from legacy source
  "skybox":       { priority: 5, init(_t,d){ d.presets={day:{bg:0x87ceeb,fog:0x87ceeb,fogNear:40,fogFar:140,ambColor:0xffffff,ambInt:0.9,sunColor:0xffffff,sunInt:1.1},sunset:{bg:0xff7744,fog:0xee6633,fogNear:20,fogFar:90,ambColor:0xff9966,ambInt:0.8,sunColor:0xff8800,sunInt:1.4},night:{bg:0x060a1a,fog:0x060a1a,fogNear:15,fogFar:60,ambColor:0x223366,ambInt:0.3,sunColor:0x3366aa,sunInt:0.4},holo:{bg:0x010810,fog:0x010810,fogNear:30,fogFar:100,ambColor:0x00ccff,ambInt:0.4,sunColor:0x00ffaa,sunInt:0.6},space:{bg:0x000008,fog:0x000008,fogNear:60,fogFar:300,ambColor:0x8866ff,ambInt:0.2,sunColor:0xffffff,sunInt:2.0}}; d.current="day"; } },
  "day-night":    dayNight,
  "lighting":     lighting,
  "weather":      weather,
  "fog_of_war":   { priority: 50, init(_t,d){ d.FOW_RADIUS=25; d.FOW_FADE_START=18; d.FOW_OPACITY=0.85; } },
  "rain":         { priority: 12, init(_t,d){ d.rainDrops=true; d.rainIntensity=1; } },
  "world_layout": { priority: 10, init(_t,d){ d.ARENA_HALF=28; d.ARENA_THICK=1.6; d.ARENA_HEIGHT=2.2; } },
  "terrain":      { priority: 50, init(_t,d){ d.gridSize=100; } },
  "portal_gen":   { priority: 50, init(_t,d){ d.portalTypes=["building","shop","garage"]; } },
  "city_gen":     { priority: 50, init(_t,d){ d.BLDG_HEIGHTS={shop:8,tower:25,house:6,garage:5,diner:7,bank:12,park:4,studio:10}; } },
  "world_data":   { priority: 50 },
  "world_graph":  { priority: 50 },
  "city_traffic": { priority: 50 },
  "settings_panel": { priority: 50 },
};

export function installFacetHandlers(registry) {
  for (const [name, handler] of Object.entries(FACET_HANDLERS)) {
    registry.registerFacetHandler(name, handler);
  }
}
