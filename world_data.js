// world_data.js — all static world configuration.
// Edit this file to change the layout without touching engine logic.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.WorldData = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // ---- Buildings ----
  // Each entry: { id, color (hex int), u0, v0, u1, v1 }
  const buildings = [
    { id: "shop",    color: 0xff6b6b, u0:  10, v0:  -4, u1:  16, v1:   4 },
    { id: "tower",   color: 0x4ecdc4, u0: -16, v0:   6, u1: -10, v1:  12 },
    { id: "house",   color: 0xffe66d, u0:  -6, v0: -14, u1:   0, v1:  -8 },
    { id: "garage",  color: 0xa8dadc, u0:   6, v0:  10, u1:  12, v1:  16 },
    { id: "diner",   color: 0xff9f1c, u0: -22, v0: -12, u1: -16, v1:  -6 },
    { id: "bank",    color: 0x9b5de5, u0:  18, v0:  12, u1:  24, v1:  18 },
    { id: "park",    color: 0x80ed99, u0: -10, v0:  18, u1:  -2, v1:  26 },
    { id: "studio",  color: 0xf72585, u0:  20, v0: -22, u1:  26, v1: -14 },
  ];

  // ---- NPCs ----
  // Each: { id, color, u, v, heading (radians), wanderSpeed }
  const npcs = [
    { id: "npc_red",   color: 0xe63946, u:  4, v:   4, heading: 1.2, wanderSpeed: 2.2 },
    { id: "npc_blue",  color: 0x457b9d, u: -8, v:   2, heading: 3.0, wanderSpeed: 2.2 },
    { id: "npc_green", color: 0x52b788, u:  2, v:  -6, heading: 0.5, wanderSpeed: 2.2 },
    { id: "npc_white", color: 0xeeeeee, u: -3, v: -10, heading: 4.7, wanderSpeed: 2.2 },
  ];

  // ---- Enemies ----
  // Spawned at runtime; engine can clone for multiple enemies.
  const enemyTemplate = {
    id: "enemy1", color: 0xff0044,
    u: 14, v: -14, heading: 0,
    hp: 80, maxHp: 80,
    sightRange: 10, attackRange: 1.6,
    moveSpeed: 2.4, damage: 6,
  };

  // ---- Vehicles ----
  // Each vehicle has its own physics params + behavior profile.
  // Engine spawns all of them; player presses F near any to enter.
  const vehicles = [
    {
      id: "sedan",
      type: "sedan",
      color: 0x4488ff,
      u: 4, v: 6,
      maxSpeed: 24,        // m/s top speed
      acceleration: 8,     // m/s² throttle force
      braking: 18,         // m/s² braking deceleration
      handling: 1.0,       // turn-rate multiplier (1 = baseline)
      mass: 1400,          // kg — affects inertia feel
      hitbox: { w: 2, d: 4 },
      animations: [],      // GLB clip names to play while driving
    },
    {
      id: "truck",
      type: "truck",
      color: 0xff8833,
      u: 15, v: -5,
      maxSpeed: 16,
      acceleration: 5,
      braking: 12,
      handling: 0.7,
      mass: 3000,
      hitbox: { w: 2.5, d: 5.5 },
      animations: [],
    },
    {
      id: "motorcycle",
      type: "motorcycle",
      color: 0xff2244,
      u: -8, v: 12,
      maxSpeed: 42,
      acceleration: 16,
      braking: 22,
      handling: 1.9,
      mass: 280,
      hitbox: { w: 1.0, d: 2.2 },
      animations: [],
    },
  ];

  // ---- Coin pickups ----
  const pickups = [
    { id: "coin1", u:  4, v:  -8 },
    { id: "coin2", u: -8, v:  10 },
    { id: "coin3", u: 18, v:   2 },
    { id: "coin4", u:-20, v:   0 },
    { id: "coin5", u:  0, v: -22 },
    { id: "coin6", u: 12, v:  20 },
    { id: "coin7", u:-12, v: -18 },
    { id: "coin8", u: 22, v: -10 },
  ];

  // ---- Entities (interactive objects) ----
  const entities = {
    computer: { id: "pc1", u: -4, v: 4 },
  };

  // ---- Jumbotron / sky screen positions ----
  const screens = {
    jumbotron: { u: 30, y_offset: 1, v: 25, rotY: Math.PI },
    sky:       { u:  0, y: 300, v: 0 },
  };

  // ---- Device positions (relative to computer entity) ----
  // du/dv/dy = offset from computer.u, computer.v, 0
  const devices = {
    pc:     { id: "pc1",    du: 0,    dv: 0,    dy: 1.1 },
    mon:    { id: "mon1",   du: 0,    dv: 0,    dy: 1.6 },
    spk:    { id: "spk1",   du: 1.0,  dv: -0.2, dy: 0.8 },
    usb:    { id: "usb1",   du: -0.4, dv: 0.1,  dy: 1.0 },
    radioA: { id: "radioA", du: 0.3,  dv: -0.2, dy: 1.4 },
    radioB: { id: "radioB", u: 10, v: 8, dy: 1.0 },  // absolute position
  };

  return { buildings, npcs, enemyTemplate, vehicles, pickups, entities, screens, devices };
});
