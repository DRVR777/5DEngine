/**
 * ecs_bullet.js — ECS bullet travel and hit detection for 5DEngine
 *
 * Ported from 5DEngineMassive/index.html lines 6582-6700:
 *   Substeps: 5 per tick to avoid tunneling (line 6584)
 *   Hit radius: 0.6m (line 6599: Math.hypot < 0.6)
 *   Headshot: posY > 1.35 (line 6600)
 *   Backstab: dirU*sin(heading)+dirV*cos(heading) > 0.55 (line 6601-6602)
 *   FrontalBlock: dot < -0.55 AND (boss|heavy) (line 6603)
 *   Crit: 10% random when no other modifier (line 6605)
 *   Bullet KB: 3.5 strength, 0.1s duration (line 6635-6637)
 *   Heavy-hit stagger: dmg >= 25% maxHp → 0.6s (line 6640-6642)
 *   Falloff: Math.max(0.15, 1 - traveled/range * falloff) (line 6606)
 *
 * Bullet component:
 *   Bullet: { posU, posV, posY, dirU, dirV, dirY, speed, damage, range,
 *             traveled, falloff, weaponId, ownerId, dmgMultipliers }
 *   - falloff: 0 = no falloff (pistol/rifle), 0.85 = shotgun
 *   - dmgMultipliers: $facets from damage_multipliers.json (passed at spawn)
 *
 * Events emitted on Core:
 *   "bullet:hit"  { bulletId, targetId, dmg, headshot, backstab, frontalBlock, crit }
 *   "bullet:expired" { bulletId }    — bullet traveled beyond range without hit
 *   "bullet:knockback" { entityId, kbU, kbV, kbT }
 *   "bullet:stagger"   { entityId, duration }
 *
 * Events listened to on Core:
 *   "bullet:spawn" { posU, posV, posY, dirU, dirV, dirY, speed, damage,
 *                    range, falloff?, weaponId, ownerId?, dmgMultipliers? }
 *     → creates a Bullet entity in the world
 *
 * Usage:
 *   const sys = createBulletSystem();
 *   Core.addSystem(sys, 9, "bullet"); // after weapon:8, before ai:12
 */

import { applyPlayerDamage } from "./ecs_combat.js";

export const BULLET_HIT_RADIUS   = 0.6;    // enemy body hitbox (monolith line 6599)
export const BULLET_HEADSHOT_Y   = 1.35;   // height threshold (monolith line 6600)
export const BULLET_BACKSTAB_DOT = 0.55;   // alignment threshold (monolith line 6602)
export const BULLET_FRONTAL_DOT  = -0.55;  // frontal block threshold (monolith line 6603)
export const BULLET_CRIT_CHANCE  = 0.10;   // random crit probability (monolith line 6605)
export const BULLET_KB_STRENGTH  = 3.5;    // bullet knockback (monolith line 6635)
export const BULLET_KB_DUR       = 0.1;    // bullet KB seconds (monolith line 6637)
export const BULLET_HEAVY_STAGGER = 0.6;   // stagger seconds on heavy hit (monolith line 6641)
export const BULLET_FALLOFF_MIN   = 0.15;  // floor (monolith line 6606)
export const BULLET_SUBSTEPS      = 5;     // sub-steps per tick (monolith line 6584)

/**
 * spawnBullet(core, opts) → bulletEntityId
 * Pure spawn helper — does not require system to be running.
 */
export function spawnBullet(core, opts = {}) {
  const id = core.createEntity();
  core.addComponent(id, "Bullet", {
    posU:    opts.posU    ?? 0,
    posV:    opts.posV    ?? 0,
    posY:    opts.posY    ?? 0.85,
    dirU:    opts.dirU    ?? 0,
    dirV:    opts.dirV    ?? 1,
    dirY:    opts.dirY    ?? 0,
    speed:   opts.speed   ?? 80,
    damage:  opts.damage  ?? 20,
    range:   opts.range   ?? 30,
    traveled: 0,
    falloff: opts.falloff ?? 0,
    weaponId: opts.weaponId ?? "pistol",
    ownerId:  opts.ownerId  ?? null,
    dmgMultipliers: opts.dmgMultipliers ?? {},
  });
  return id;
}

/**
 * Compute hit modifiers for a single hit against an enemy.
 * Exported for unit-testing without needing a running system.
 * @param {object} b - Bullet component
 * @param {object} ai - EnemyAI component (has .heading, .type)
 * @param {function} [randFn] - optional rng (defaults to Math.random)
 */
export function computeHitModifiers(b, ai, randFn = Math.random) {
  const heading = ai.heading ?? 0;
  const headshot = b.posY > BULLET_HEADSHOT_Y;
  const dot = b.dirU * Math.sin(heading) + b.dirV * Math.cos(heading);
  const backstab     = !headshot && dot > BULLET_BACKSTAB_DOT;
  const frontalBlock = !headshot && !backstab && dot < BULLET_FRONTAL_DOT
                       && (ai.type === "boss" || ai.type === "heavy");
  const crit = !headshot && !backstab && !frontalBlock && randFn() < BULLET_CRIT_CHANCE;
  return { headshot, backstab, frontalBlock, crit };
}

/**
 * createBulletSystem(opts?) → system function
 * @param {object} [opts]
 * @param {function} [opts.randFn] - rng override for deterministic testing
 */
export function createBulletSystem({ randFn = Math.random } = {}) {
  let _wired = false;

  function system(dt, core) {
    if (!_wired) {
      _wired = true;

      core.on("bullet:spawn", (opts) => {
        spawnBullet(core, opts);
      });
    }

    const bulletIds = core.query("Bullet");
    if (!bulletIds.length) return;

    // Query enemies once per tick (not per bullet)
    const enemies = core.query("EnemyAI", "Transform", "Health");
    const subDt   = dt / BULLET_SUBSTEPS;

    for (const bid of bulletIds) {
      const b = core.getComponent(bid, "Bullet");
      if (!b) continue;

      let hit = false;

      for (let s = 0; s < BULLET_SUBSTEPS && !hit; s++) {
        // Advance bullet
        b.posU     += b.dirU * b.speed * subDt;
        b.posV     += b.dirV * b.speed * subDt;
        b.posY     += b.dirY * b.speed * subDt;
        b.traveled += b.speed * subDt;

        // Range check
        if (b.traveled >= b.range) {
          core.emit("bullet:expired", { bulletId: bid });
          core.destroyEntity(bid);
          hit = true;
          break;
        }

        // Check against all enemies
        for (const eid of enemies) {
          if (eid === b.ownerId) continue; // no friendly fire

          const t  = core.getComponent(eid, "Transform");
          const h  = core.getComponent(eid, "Health");
          const ai = core.getComponent(eid, "EnemyAI");
          if (!t || !h || h.hp <= 0) continue;

          const dist = Math.hypot(t.u - b.posU, t.v - b.posV);
          if (dist >= BULLET_HIT_RADIUS) continue;

          // Compute modifiers and damage
          const mods = computeHitModifiers(b, ai, randFn);
          const falloffMul = b.falloff
            ? Math.max(BULLET_FALLOFF_MIN, 1 - (b.traveled / (b.range || 1)) * b.falloff)
            : 1;

          const dmg = applyPlayerDamage(
            b.damage, b.weaponId, ai.type, b.dmgMultipliers,
            { ...mods, falloffMul }
          );

          h.hp = Math.max(0, h.hp - dmg);

          core.emit("bullet:hit", { bulletId: bid, targetId: eid, dmg, ...mods });

          // Bullet knockback
          const kbLen = dist || 1;
          const kbU = ((t.u - b.posU) / kbLen) * BULLET_KB_STRENGTH;
          const kbV = ((t.v - b.posV) / kbLen) * BULLET_KB_STRENGTH;
          core.emit("bullet:knockback", { entityId: eid, kbU, kbV, kbT: BULLET_KB_DUR });

          // Heavy-hit stagger: single bullet dealing ≥25% maxHp
          const maxHp = h.maxHp ?? 80;
          if (ai.type !== "boss" && dmg >= maxHp * 0.25 && h.hp > 0) {
            core.emit("bullet:stagger", { entityId: eid, duration: BULLET_HEAVY_STAGGER });
          }

          core.destroyEntity(bid);
          hit = true;
          break;
        }
      }
    }
  }

  return system;
}

export default {
  createBulletSystem, spawnBullet, computeHitModifiers,
  BULLET_HIT_RADIUS, BULLET_HEADSHOT_Y, BULLET_BACKSTAB_DOT,
  BULLET_FRONTAL_DOT, BULLET_CRIT_CHANCE, BULLET_SUBSTEPS,
};
