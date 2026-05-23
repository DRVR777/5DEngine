// Enemy type catalogue — templates used by wave spawner and AI system.
// WEAPON_DMG_MULTIPLIERS — resistance table per enemy type per weapon.
export const ENEMY_TYPES = [
  { type: "grunt",      color: 0xff0044, hp: 80,   maxHp: 80,   moveSpeed: 2.4, damage: 6,  attackRange: 1.6, sightRange: 12, dropAmmo: "pistol_9mm", dropQty: 12, dropHealth: 0,  wanderSpeed: 1.0 },
  { type: "heavy",      color: 0x880022, hp: 200,  maxHp: 200,  moveSpeed: 1.2, damage: 18, attackRange: 2.0, sightRange: 10, dropAmmo: "pistol_9mm", dropQty: 24, dropHealth: 30, wanderSpeed: 0.6 },
  { type: "fast",       color: 0xff6600, hp: 40,   maxHp: 40,   moveSpeed: 5.0, damage: 4,  attackRange: 1.2, sightRange: 16, dropAmmo: "pistol_9mm", dropQty: 6,  dropHealth: 0,  wanderSpeed: 2.5 },
  { type: "poisoner",   color: 0x00bb44, hp: 60,   maxHp: 60,   moveSpeed: 2.0, damage: 3,  attackRange: 1.8, sightRange: 12, dropAmmo: "pistol_9mm", dropQty: 8,  dropHealth: 0,  wanderSpeed: 0.8 },
  { type: "incendiary", color: 0xffaa00, hp: 70,   maxHp: 70,   moveSpeed: 2.2, damage: 5,  attackRange: 1.8, sightRange: 12, dropAmmo: "pistol_9mm", dropQty: 10, dropHealth: 0,  wanderSpeed: 0.9 },
  { type: "robot",      color: 0x4466aa, hp: 350,  maxHp: 350,  moveSpeed: 1.0, damage: 25, attackRange: 2.2, sightRange: 14, dropAmmo: "rifle_556",  dropQty: 20, dropHealth: 40, wanderSpeed: 0.4 },
  { type: "boss",       color: 0x660022, hp: 1200, maxHp: 1200, moveSpeed: 1.8, damage: 40, attackRange: 3.0, sightRange: 20, dropAmmo: "rifle_556",  dropQty: 60, dropHealth: 80, wanderSpeed: 0.5 },
  { type: "sniper",     color: 0x220033, hp: 55,   maxHp: 55,   moveSpeed: 0.9, damage: 45, attackRange: 20,  sightRange: 22, dropAmmo: "rifle_556",  dropQty: 15, dropHealth: 0,  wanderSpeed: 0.3 },
];

export const WEAPON_DMG_MULTIPLIERS = {
  heavy:  { pistol: 0.5, shotgun: 0.7, rifle: 1.0, smg: 0.6, sniper: 1.5 },
  boss:   { pistol: 0.4, shotgun: 0.6, rifle: 0.8, smg: 0.5, sniper: 2.0 },
  robot:  { pistol: 0.5, shotgun: 0.8, rifle: 1.0, smg: 0.7, sniper: 1.8 },
  sniper: { pistol: 1.0, shotgun: 1.5, rifle: 1.2, smg: 1.0, sniper: 0.8 },
  fast:   { pistol: 1.0, shotgun: 1.3, rifle: 1.0, smg: 1.0, sniper: 1.0 },
};
