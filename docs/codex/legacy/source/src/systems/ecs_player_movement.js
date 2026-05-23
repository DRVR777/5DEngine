/**
 * ecs_player_movement.js — ECS player WASD + sprint + dodge + gravity system for 5DEngine
 *
 * Ported from 5DEngineMassive/index.html lines 6280-6432 (player movement block).
 *
 * Reads an Input component each tick; produces Transform deltas.
 * Direction convention (from monolith drone code lines 6357-6364, the correct non-inverted form):
 *   Forward: (sin(heading), cos(heading)) in U/V space
 *   Right:   (cos(heading), -sin(heading)) in U/V space
 *
 * Components consumed:
 *   PlayerControl: { active }
 *   Input:  { forward, back, left, right, sprint, jump, dodge, heading }
 *   Transform: { u, v, y }
 *   Stamina: { stamina, extraMax } — optional, for sprint/dodge gating
 *
 * Components managed by this system (auto-added if missing):
 *   Motion: { vy, dodgeT, dodgeCooldown, dodgeVU, dodgeVV, grounded }
 *
 * Constants (monolith line parity):
 *   WALK   = 5     (CFG.walkSpeed   || 5,  line 5652)
 *   SPRINT = 9     (CFG.sprintSpeed || 9,  line 5653)
 *   GRAVITY = -25  (CFG.gravity     || -25, line 5650)
 *   JUMP_V  = 13   (CFG.jumpVelocity || 13, line 5651)
 *   DODGE_DUR  = 0.25   (line 5985)
 *   DODGE_SPEED= 18     (line 5986)
 *   DODGE_CD   = 1.1    (line 5987)
 *   DODGE_COST = 20     (ecs_stamina DODGE_COST)
 *   STAMINA_LOCKOUT = 15 (ecs_stamina STAMINA_LOCKOUT — re-entry threshold)
 *
 * Events emitted on Core:
 *   "player:dodged"     { entityId }
 *   "player:jumped"     { entityId }
 *   "player:landed"     { entityId }
 *   "player:dodge_ended" { entityId }
 *
 * Usage:
 *   const sys = createPlayerMovementSystem();
 *   Core.addSystem(sys, 7, "player_movement"); // before weapon:8, combat:10
 *
 * To wire input: set the Input component on the hero entity each frame from raw key state.
 * Example bridge (index.html):
 *   Core.on("tick:input", () => {
 *     const inputComp = Core.getComponent(heroId, "Input");
 *     if (inputComp) {
 *       inputComp.forward  = !!keys["KeyW"];
 *       inputComp.back     = !!keys["KeyS"];
 *       inputComp.left     = !!keys["KeyA"];
 *       inputComp.right    = !!keys["KeyD"];
 *       inputComp.sprint   = !!(keys["ShiftLeft"] || keys["ShiftRight"]);
 *       inputComp.jump     = !!keys["Space"];
 *       inputComp.dodge    = !!keys["KeyX"];
 *       inputComp.heading  = camYaw;
 *     }
 *   });
 */

export const PLAYER_WALK_SPEED   = 5;     // monolith line 5652
export const PLAYER_SPRINT_SPEED = 9;     // monolith line 5653
export const PLAYER_GRAVITY      = -25;   // monolith line 5650
export const PLAYER_JUMP_V       = 13;    // monolith line 5651
export const PLAYER_DODGE_DUR    = 0.25;  // monolith line 5985
export const PLAYER_DODGE_SPEED  = 18;    // monolith line 5986
export const PLAYER_DODGE_CD     = 1.1;   // monolith line 5987
export const PLAYER_DODGE_COST   = 20;    // ecs_stamina DODGE_COST
export const PLAYER_STAMINA_LOCKOUT = 15; // ecs_stamina STAMINA_LOCKOUT

const _DEFAULT_MOTION = () => ({
  vy: 0, dodgeT: 0, dodgeCooldown: 0,
  dodgeVU: 0, dodgeVV: 0, grounded: true,
});

/**
 * createPlayerMovementSystem() → system function
 */
export function createPlayerMovementSystem() {
  function system(dt, core) {
    const heroes = core.query("PlayerControl", "Transform", "Input");

    for (const id of heroes) {
      const ctrl = core.getComponent(id, "PlayerControl");
      if (!ctrl.active) continue;

      const input = core.getComponent(id, "Input");
      const t     = core.getComponent(id, "Transform");
      const stam  = core.getComponent(id, "Stamina"); // optional

      // Ensure Motion component exists
      let motion = core.getComponent(id, "Motion");
      if (!motion) {
        motion = _DEFAULT_MOTION();
        core.addComponent(id, "Motion", motion);
      }

      const heading  = input.heading ?? 0;
      const fU = Math.sin(heading);   // forward U
      const fV = Math.cos(heading);   // forward V
      const rU = Math.cos(heading);   // right U
      const rV = -Math.sin(heading);  // right V

      // Sprint eligibility: need LOCKOUT stamina to start, 1 to continue
      const isSprinting = motion._wasSprinting ?? false;
      const stamVal = stam ? stam.stamina : Infinity;
      const canSprint = input.sprint
        && (isSprinting ? stamVal >= 1 : stamVal >= PLAYER_STAMINA_LOCKOUT);
      motion._wasSprinting = canSprint;

      // Dodge cooldown decay
      if (motion.dodgeCooldown > 0) motion.dodgeCooldown -= dt;

      if (motion.dodgeT > 0) {
        // Active dodge — apply burst velocity, iframes window
        t.u += motion.dodgeVU * dt;
        t.v += motion.dodgeVV * dt;
        motion.dodgeT -= dt;
        if (motion.dodgeT <= 0) {
          core.emit("player:dodge_ended", { entityId: id });
        }
      } else if (input.dodge && motion.dodgeCooldown <= 0
                 && (!stam || stam.stamina >= PLAYER_DODGE_COST)) {
        // Initiate dodge in movement direction (or forward if no input)
        let mU = 0, mV = 0;
        if (input.forward)  { mU += fU; mV += fV; }
        if (input.back)     { mU -= fU; mV -= fV; }
        if (input.right)    { mU += rU; mV += rV; }
        if (input.left)     { mU -= rU; mV -= rV; }

        if (Math.hypot(mU, mV) < 0.01) { mU = fU; mV = fV; } // default to forward if stationary
        const mag = Math.hypot(mU, mV);

        motion.dodgeVU = (mU / mag) * PLAYER_DODGE_SPEED;
        motion.dodgeVV = (mV / mag) * PLAYER_DODGE_SPEED;
        motion.dodgeT  = PLAYER_DODGE_DUR;
        motion.dodgeCooldown = PLAYER_DODGE_CD;

        if (stam) stam.stamina = Math.max(0, stam.stamina - PLAYER_DODGE_COST);
        core.emit("player:dodged", { entityId: id });
      } else {
        // Standard WASD movement
        const speed = canSprint ? PLAYER_SPRINT_SPEED : PLAYER_WALK_SPEED;
        let du = 0, dv = 0;
        if (input.forward) { du += fU * speed * dt; dv += fV * speed * dt; }
        if (input.back)    { du -= fU * speed * dt; dv -= fV * speed * dt; }
        if (input.right)   { du += rU * speed * dt; dv += rV * speed * dt; }
        if (input.left)    { du -= rU * speed * dt; dv -= rV * speed * dt; }
        t.u += du;
        t.v += dv;
      }

      // Jump + gravity
      if (input.jump && motion.grounded) {
        motion.vy = PLAYER_JUMP_V;
        motion.grounded = false;
        core.emit("player:jumped", { entityId: id });
      }

      motion.vy += PLAYER_GRAVITY * dt;
      t.y += motion.vy * dt;

      if (t.y <= 0) {
        const wasAirborne = !motion.grounded;
        t.y = 0;
        motion.vy = 0;
        motion.grounded = true;
        if (wasAirborne) core.emit("player:landed", { entityId: id });
      }
    }
  }

  return system;
}

export default {
  createPlayerMovementSystem,
  PLAYER_WALK_SPEED, PLAYER_SPRINT_SPEED, PLAYER_GRAVITY, PLAYER_JUMP_V,
  PLAYER_DODGE_DUR, PLAYER_DODGE_SPEED, PLAYER_DODGE_CD,
  PLAYER_DODGE_COST, PLAYER_STAMINA_LOCKOUT,
};
