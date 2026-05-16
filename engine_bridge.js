// engine_bridge.js — UMD bridge between multi_dim_engine_skeleton and Three.js.
//
// Convention (engine 5D → render 3D):
//   render.x = engine.u            (ground east)
//   render.z = engine.v            (ground north)
//   render.y = engine.y + height   (vertical, y kept for jumps)
//   engine.x and engine.z are reserved for "deep state" channels — not
//   rendered, used by the engine for layer routing and freezeTest.
//
// Movement (camera-relative, GTA-style):
//   forwardVec = camera-forward projected to ground plane
//   rightVec   = camera-right   projected to ground plane
//   delta      = forward * inputForward + right * inputRight, normalized × speed × dt
//   then engine.applyMovement(id, deltaU, deltaY, deltaV)
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTABridge = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function engineToRenderPos(p) {
    if (!p) return null;
    return { x: p.u, y: (p.y || 0), z: p.v };
  }

  function renderToEngineUV(v3) {
    return { u: v3.x, v: v3.z, y: v3.y };
  }

  // Apply a camera-relative movement to a player in the world.
  // forward/right are unit vectors in the ground plane (y=0 component dropped).
  // If `opts.blockers` is supplied with the mover's hitbox in `opts.heroHitbox`,
  // the move is resolved against AABB blockers (no walking through walls).
  function applyCameraRelativeMove(world, id, inputF, inputR, forward, right, speed, dt, opts) {
    const p = world.players.get(id);
    if (!p) return null;
    let dx = forward.x * inputF + right.x * inputR;
    let dz = forward.z * inputF + right.z * inputR;
    const mag = Math.hypot(dx, dz);
    if (mag > 1e-6) {
      dx = (dx / mag) * speed * dt;
      dz = (dz / mag) * speed * dt;
    } else {
      dx = 0; dz = 0;
    }
    if (opts && opts.blockers && opts.heroHitbox) {
      const Phys = (typeof require === "function") ? require("./physics.js") :
        (typeof self !== "undefined" ? self.GTAPhysics : null);
      if (Phys) {
        const mover = { u: p.u, v: p.v, hitbox: opts.heroHitbox };
        const applied = Phys.resolveAABBMove(mover, dx, dz, opts.blockers);
        world.setPlayer(id, p.x, p.y, p.z, mover.u, mover.v);
        return { du: applied.dU, dv: applied.dV };
      }
    }
    world.setPlayer(id, p.x, p.y, p.z, p.u + dx, p.v + dz);
    return { du: dx, dv: dz };
  }

  // Chase camera position: behind+above the character along its facing yaw.
  function chaseCameraPos(targetRenderPos, yaw, distance, height) {
    return {
      x: targetRenderPos.x - Math.sin(yaw) * distance,
      y: targetRenderPos.y + height,
      z: targetRenderPos.z - Math.cos(yaw) * distance,
    };
  }

  // Project camera forward+right vectors onto ground plane and renormalize.
  function cameraGroundBasis(cameraQuat) {
    // cameraQuat is a {x,y,z,w} or any object with .matrixWorld basis.
    // Caller supplies the already-resolved {forward:{x,y,z}, right:{x,y,z}}
    // We just zero-out y and renormalize. This keeps the bridge framework-free.
    return function ground(vec) {
      const m = Math.hypot(vec.x, vec.z) || 1;
      return { x: vec.x / m, y: 0, z: vec.z / m };
    };
  }

  // Plane physics: throttle (forward), pitch (up/down), yaw (turn).
  // state = { speed, heading, pitch, altitude }
  // Returns updated state.
  function planePhysicsStep(world, id, state, throttle, pitch, yaw, dt) {
    const ACCEL = 18, DRAG = 0.6, MAX_S = 60, MAX_PITCH = 0.6, MAX_TURN = 1.0;
    const LIFT_FACTOR = 0.4;   // altitude change per (speed * pitch * dt)
    let speed   = state.speed   || 0;
    let heading = state.heading || 0;
    let pitchA  = state.pitch   || 0;
    let altitude= state.altitude|| 0;
    speed += throttle * ACCEL * dt;
    speed *= Math.exp(-DRAG * dt);
    if (speed > MAX_S) speed = MAX_S;
    if (speed < 0) speed = 0;
    pitchA += pitch * 0.8 * dt;
    if (pitchA >  MAX_PITCH) pitchA =  MAX_PITCH;
    if (pitchA < -MAX_PITCH) pitchA = -MAX_PITCH;
    heading += yaw * MAX_TURN * dt * (speed / MAX_S);
    altitude += pitchA * speed * LIFT_FACTOR * dt;
    if (altitude < 0) altitude = 0;
    const p = world.players.get(id);
    if (p) {
      const du = Math.sin(heading) * speed * dt;
      const dv = Math.cos(heading) * speed * dt;
      world.setPlayer(id, p.x, altitude, p.z, p.u + du, p.v + dv);
    }
    return { speed, heading, pitch: pitchA, altitude };
  }

  // Bullet vs targetable entity hit test. Returns array of {bullet, target}
  // pairs that hit this tick. Caller decides what damage flow to run.
  // Removes hit bullets from the input array in-place.
  function tickBullets(world, bullets, dt) {
    const hits = [];
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      // advance position
      b.position.u += b.velocity.u * b.speed * dt;
      b.position.v += b.velocity.v * b.speed * dt;
      b.traveled += b.speed * dt;
      // hit any targetable in the bullet's lane?
      let hit = null;
      for (const [id, e] of world.entities) {
        if (id === b.ownerId) continue;
        if (!e.targetable) continue;
        if (e.health && e.health.dead) continue;
        if (!e.position) continue;
        const du = e.position.u - b.position.u;
        const dv = e.position.v - b.position.v;
        const r2 = du * du + dv * dv;
        const radius = (e.hitbox && e.hitbox.w) ? e.hitbox.w * 0.6 : 0.5;
        if (r2 <= radius * radius) { hit = { id, entity: e }; break; }
      }
      if (hit) {
        hits.push({ bullet: b, target: hit });
        bullets.splice(i, 1);
        continue;
      }
      if (b.traveled >= b.range) bullets.splice(i, 1);
    }
    return hits;
  }

  // Wander step for an NPC: small random heading change, advance forward.
  // Returns the new heading. Pure function on top of Math.random by default;
  // pass a deterministic rng for headless tests.
  function wanderStep(world, id, heading, speed, dt, rng) {
    rng = rng || Math.random;
    const turn = (rng() - 0.5) * 0.4;       // up to ±0.2 rad/tick
    const newHeading = heading + turn;
    const p = world.players.get(id);
    if (!p) return newHeading;
    const du = Math.sin(newHeading) * speed * dt;
    const dv = Math.cos(newHeading) * speed * dt;
    world.setPlayer(id, p.x, p.y, p.z, p.u + du, p.v + dv);
    return newHeading;
  }

  // Car physics step. Bicycle-model lite:
  //   throttle ∈ [-1, 1] (back/forward), steer ∈ [-1, 1] (left/right at full lock)
  //   speed accumulates with throttle, drags toward 0
  //   heading turns at a rate proportional to (steer × current speed)
  // Returns updated { speed, heading } so caller persists them.
  // Gear table: each gear caps speed, has its own accel multiplier.
  // Auto-shift up when speed > 90% of gear cap; down when < 40%.
  const CAR_GEARS = [
    { name: "R",  maxSpeed: -10, accelMul: 0.8 },
    { name: "N",  maxSpeed:   0, accelMul: 0   },
    { name: "1",  maxSpeed:   8, accelMul: 1.6 },
    { name: "2",  maxSpeed:  16, accelMul: 1.3 },
    { name: "3",  maxSpeed:  28, accelMul: 1.0 },
    { name: "4",  maxSpeed:  42, accelMul: 0.75 },
    { name: "5",  maxSpeed:  60, accelMul: 0.5 },
  ];
  function carPhysicsStep(world, id, state, throttle, steer, dt, opts) {
    opts = opts || {};
    const BASE_ACCEL = 16;
    const DRAG = 0.9;
    const BRAKE = 30;
    const HANDBRAKE = 60;
    const MAX_TURN = 2.2;
    let speed   = state.speed   || 0;
    let heading = state.heading || 0;
    let gear    = state.gear != null ? state.gear : 2;   // start in 1st (index 2)
    const handbrake = !!opts.handbrake;
    // Reverse: hold throttle<0 from standstill → engage R
    if (throttle < 0 && speed <= 0.5 && gear > 1) gear = 0;
    if (throttle > 0 && speed >= -0.5 && gear === 0) gear = 2;
    if (gear === 1 && throttle !== 0) gear = throttle > 0 ? 2 : 0;
    const g = CAR_GEARS[gear];
    // Apply throttle / braking
    if (handbrake) {
      const sign = Math.sign(speed);
      speed -= sign * HANDBRAKE * dt;
      if (Math.sign(speed) !== sign) speed = 0;
    } else if ((speed > 0 && throttle < 0) || (speed < 0 && throttle > 0)) {
      // Braking: counter-throttle decelerates faster
      const sign = Math.sign(speed);
      speed -= sign * BRAKE * dt;
      if (Math.sign(speed) !== sign) speed = 0;
    } else {
      speed += throttle * BASE_ACCEL * g.accelMul * dt;
    }
    // Drag (rolling resistance)
    speed *= Math.exp(-DRAG * dt);
    // Clamp to gear's range
    if (gear === 0) {
      if (speed < g.maxSpeed) speed = g.maxSpeed;
      if (speed > 0) speed = 0;
    } else {
      if (speed > g.maxSpeed) speed = g.maxSpeed;
      if (speed < -2) speed = -2;
    }
    // Auto-shift (forward gears only)
    if (gear >= 2 && !handbrake) {
      if (gear < CAR_GEARS.length - 1 && speed > g.maxSpeed * 0.95) gear++;
      else if (gear > 2 && speed < CAR_GEARS[gear - 1].maxSpeed * 0.45) gear--;
    }
    // Steering — speed-dependent, plus tighter at low speed
    const speedNorm = Math.min(1, Math.abs(speed) / 30);
    const turnRate = steer * MAX_TURN * (0.3 + 0.7 * speedNorm);
    heading += turnRate * dt;
    const p = world.players.get(id);
    if (p) {
      const du = Math.sin(heading) * speed * dt;
      const dv = Math.cos(heading) * speed * dt;
      const newU = p.u + du;
      const newV = p.v + dv;
      // Building collision: if blockers given, halt at first hit
      let hit = false;
      if (Array.isArray(opts.blockers)) {
        const halfW = (opts.carHitbox && opts.carHitbox.w / 2) || 1.5;
        const halfD = (opts.carHitbox && opts.carHitbox.d / 2) || 2.5;
        for (const b of opts.blockers) {
          const bw = b.hitbox.w / 2, bd = b.hitbox.d / 2;
          if (newU + halfW > b.u - bw && newU - halfW < b.u + bw &&
              newV + halfD > b.v - bd && newV - halfD < b.v + bd) {
            hit = true; break;
          }
        }
      }
      if (hit) {
        speed *= 0.3;   // bounce — bleed speed on impact
        // don't move this tick
      } else {
        world.setPlayer(id, p.x, p.y, p.z, newU, newV);
      }
    }
    return { speed, heading, gear, gearName: CAR_GEARS[gear].name };
  }

  // Distance in the (u, v) ground plane between two engine players.
  function uvDist(world, idA, idB) {
    const a = world.players.get(idA), b = world.players.get(idB);
    if (!a || !b) return Infinity;
    return Math.hypot(a.u - b.u, a.v - b.v);
  }

  // Walk-cycle phase scaled by current ground speed. Returns radians of leg
  // swing — caller applies it as rotation.x on each leg, opposite signs.
  function walkCyclePhase(state, dt, groundSpeed) {
    const FREQ = 4.0;          // base steps/sec at normalized=1
    const MAX_SWING = 0.6;     // radians
    // Normalize: walk=5 → 1.0, sprint=9 → 1.8. Idle stays at 0.
    const norm = groundSpeed > 0.1 ? Math.max(0.4, Math.min(3.0, groundSpeed / 5)) : 0;
    state.t = (state.t || 0) + dt * FREQ * norm;
    const intensity = Math.min(1, groundSpeed / 4);
    return {
      swing: Math.sin(state.t) * MAX_SWING * intensity,
      bob:   Math.abs(Math.sin(state.t)) * 0.08 * intensity,
    };
  }

  // Collect any pickup within `radius` of the player. Mutates the pickups
  // array (sets .collected=true). Returns the id collected this tick or null.
  function collectPickup(world, playerId, pickups, radius) {
    const p = world.players.get(playerId);
    if (!p) return null;
    for (const pk of pickups) {
      if (pk.collected) continue;
      const d = Math.hypot(pk.u - p.u, pk.v - p.v);
      if (d <= radius) {
        pk.collected = true;
        pk.collected_at = Date.now();
        return pk.id;
      }
    }
    return null;
  }

  // Day-night phase ∈ [0, 1). Returns sun direction + light tint + fog density.
  function dayNightPhase(t, periodSec) {
    const phase = (t / periodSec) % 1;
    const angle = phase * Math.PI * 2; // peak (noon) at phase=0.25, midnight at 0.75
    const sun = { x: Math.cos(angle), y: Math.max(-0.2, Math.sin(angle)), z: 0.3 };
    const dayMix = Math.max(0, Math.min(1, (sun.y + 0.1) / 0.6));
    const sky = {
      r: 0.05 + 0.48 * dayMix,
      g: 0.07 + 0.73 * dayMix,
      b: 0.18 + 0.74 * dayMix,
    };
    const fog = 0.018 - 0.013 * dayMix; // denser at night
    return { phase, sun, sky, fog, dayMix };
  }

  // Soft-clamp a player's (u, v) inside a square arena so NPCs don't escape.
  function clampToArena(world, id, half) {
    const p = world.players.get(id);
    if (!p) return;
    let u = p.u, v = p.v;
    if (u >  half) u =  half;
    if (u < -half) u = -half;
    if (v >  half) v =  half;
    if (v < -half) v = -half;
    if (u !== p.u || v !== p.v) world.setPlayer(id, p.x, p.y, p.z, u, v);
  }

  return {
    engineToRenderPos,
    renderToEngineUV,
    applyCameraRelativeMove,
    chaseCameraPos,
    cameraGroundBasis,
    wanderStep,
    clampToArena,
    carPhysicsStep,
    uvDist,
    collectPickup,
    dayNightPhase,
    walkCyclePhase,
    tickBullets,
    planePhysicsStep,
    VERSION: "0.66.0-iter73",
  };
});
