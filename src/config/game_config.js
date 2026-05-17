// game_config.js — all tunable game constants.
// Change values here; engine logic reads from window.GameConfig.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.GameConfig = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // ---- Weapons ----
  // Each entry is a complete weapon spec. The engine loads the active weapon
  // by id at runtime — adding a new weapon means adding a new entry here.
  const weapons = [
    {
      id: "pistol",
      name: "Pistol",
      ammoItem: "pistol_9mm",
      fireRate: 5,                // shots / second
      damage: 20,
      range: 50,                  // m
      speed: 120,                 // m/s — fast enough to see tracers in flight
      magCap: 12,
      bulletRadius: 0.025,
      reloadDuration: 1200,       // ms
      pellets: 1,
      spread: 0,
      automatic: false,
    },
    {
      id: "rifle",
      name: "Assault Rifle",
      ammoItem: "rifle_556",
      fireRate: 12,               // 12 rps auto-fire = clearly visible stream of tracers
      damage: 25,
      range: 80,
      speed: 160,
      magCap: 30,
      bulletRadius: 0.02,
      reloadDuration: 2000,
      pellets: 1,
      spread: 0.015,
      automatic: true,
    },
    {
      id: "shotgun",
      name: "Shotgun",
      ammoItem: "shotgun_12g",
      fireRate: 1.2,
      damage: 14,                 // per pellet
      range: 20,
      speed: 70,                  // slower spread pellets — all visible at once
      magCap: 8,
      bulletRadius: 0.03,
      reloadDuration: 2800,
      pellets: 9,
      spread: 0.14,
      automatic: false,
    },
    {
      id: "smg",
      name: "SMG",
      ammoItem: "pistol_9mm",
      fireRate: 14,
      damage: 12,
      range: 30,
      speed: 100,
      magCap: 30,
      bulletRadius: 0.02,
      reloadDuration: 1400,
      pellets: 1,
      spread: 0.04,
      automatic: true,
    },
    {
      id: "sniper",
      name: "Sniper",
      ammoItem: "rifle_556",
      fireRate: 0.7,
      damage: 95,
      range: 200,
      speed: 250,
      magCap: 5,
      bulletRadius: 0.018,
      reloadDuration: 3500,
      pellets: 1,
      spread: 0,
      automatic: false,
    },
  ];

  return {
    // ---- Weapons registry ----
    weapons,

    // ---- Player movement ----
    walkSpeed:   5,      // m/s
    sprintSpeed: 9,      // m/s
    jumpVelocity: 13,    // m/s upward
    gravity: -25,        // m/s²

    // ---- Player health ----
    heroMaxHp: 100,
    heroRegenDelay: 5,   // seconds before regen starts after damage
    heroRegenRate: 4,    // hp/s

    // ---- Camera ----
    camDistMin: 0,
    camDistMax: 15,
    camDefaultDist: 7,
    camAimShrink: 0.4,   // fraction pulled in when aiming
    camAimLerpSpeed: 12,
    camPitchMin: -1.2,
    camPitchMax:  0.4,
    camLookAheadDist: 18,

    // ---- Enemy ----
    enemyRespawnDelay: 8,  // seconds
    ammoDropQty: 12,

    // ---- World ----
    arenaHalfExtent: 30,
    miniMapHalfExtent: 35,
    computerInteractDist: 2.5, // m
    vehicleInteractDist: 3.0,  // m
    pickupRadius: 1.2,

    // ---- Builder ----
    snapGridSize: 0.5,
    hotbarSlots: 9,
  };
});
