// physics_profile.js — per-world physics rules. Worlds are graph nodes
// (per conviction.pdf), each with its own coordinate origin + physics
// profile. Crossing a portal = world-process handoff, NOT coordinate math.
//
// A profile is just data:
//   { name, gravity, timeScale, walkSpeed, sprintSpeed, jumpVelocity }
// The bridge reads the profile when applying movement / gravity, so the
// same code works in earth-like, low-G, water, asteroid, dreamworld, etc.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTAPhysicsProfile = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const PROFILES = {
    earth: {
      name: "earth",
      gravity: -25,
      timeScale: 1.0,
      walkSpeed: 5,
      sprintSpeed: 9,
      jumpVelocity: 8,
    },
    moon: {
      name: "moon",
      gravity: -4,
      timeScale: 1.0,
      walkSpeed: 4,
      sprintSpeed: 7,
      jumpVelocity: 12,
    },
    underwater: {
      name: "underwater",
      gravity: -2,
      timeScale: 0.7,
      walkSpeed: 2,
      sprintSpeed: 3,
      jumpVelocity: 4,
    },
    dreamworld: {           // for conviction.pdf "impossible interiors"
      name: "dreamworld",
      gravity: -8,
      timeScale: 0.5,
      walkSpeed: 7,
      sprintSpeed: 14,
      jumpVelocity: 14,
    },
  };

  function get(name) {
    return PROFILES[name] || PROFILES.earth;
  }

  function register(name, profile) {
    if (PROFILES[name]) throw new Error(`profile ${name} already registered`);
    PROFILES[name] = Object.assign({ name }, profile);
  }

  function names() { return Object.keys(PROFILES); }

  // Apply gravity for one tick: returns updated y + velocityY.
  // floor is the surface height beneath the entity (0 by default).
  function applyGravity(profile, y, velocityY, dt, floor) {
    floor = floor == null ? 0 : floor;
    const g  = profile.gravity   != null ? profile.gravity   : -25;
    const ts = profile.timeScale != null ? profile.timeScale : 1;
    const newVy = velocityY + g * dt * ts;
    let newY = y + newVy * dt * ts;
    let landed = false;
    if (newY <= floor) { newY = floor; landed = true; }
    return { y: newY, velocityY: landed ? 0 : newVy, landed };
  }

  // Try to jump: succeeds only if grounded (within slop).
  function tryJump(profile, y, velocityY, floor) {
    floor = floor == null ? 0 : floor;
    if (y <= floor + 0.001) return { velocityY: profile.jumpVelocity || 8, jumped: true };
    return { velocityY, jumped: false };
  }

  return { get, register, names, applyGravity, tryJump, PROFILES };
});
