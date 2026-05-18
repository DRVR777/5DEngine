/**
 * ecs_boss_slam.js — Boss ground slam + other-enemy friendly-fire system for 5DEngine
 *
 * Ported from 5DEngineMassive/index.html lines 7345-7373:
 *   Line 7346: triggers when dist < 4m from hero + canSee
 *   Line 7347: cooldown 5s normal, 2.8s when enraged
 *   Line 7354: slamRadius=5, slamDmg=50
 *   Line 7358: hero damage: round(50 * (1 - d/5)); falls off with distance
 *   Line 7369: other enemies within 5*0.6=3m take 30 flat damage (friendly fire)
 *
 * Trigger conditions:
 *   - EnemyAI.type === "boss"
 *   - Hero visible and within SLAM_TRIGGER_DIST = 4m
 *   - Cooldown elapsed (SLAM_CD_NORMAL=5s, SLAM_CD_ENRAGED=2.8s)
 *
 * Events emitted on Core:
 *   "boss:slam" { entityId, u, v, radius, enraged }  — for VFX / audio / screen shake
 *
 * Usage:
 *   const sys = createBossSlamSystem();
 *   Core.addSystem(sys, 14, "boss_slam"); // after enrage:13, before status:15
 */

export const SLAM_TRIGGER_DIST  = 4;    // monolith line 7346
export const SLAM_RADIUS        = 5;    // monolith line 7354
export const SLAM_DMG           = 50;   // monolith line 7354
export const SLAM_FRIENDLY_DIST = 3;    // monolith line 7369: slamRadius * 0.6 = 3
export const SLAM_FRIENDLY_DMG  = 30;   // monolith line 7370
export const SLAM_CD_NORMAL     = 5.0;  // monolith line 7347
export const SLAM_CD_ENRAGED    = 2.8;  // monolith line 7347

/**
 * createBossSlamSystem() → system function
 */
export function createBossSlamSystem() {
  let _elapsed = 0;

  function system(dt, core) {
    _elapsed += dt;

    const bosses = core.query("EnemyAI", "Transform", "Health");
    if (!bosses.length) return;

    const heroIds = core.query("PlayerControl", "Transform", "Health");
    if (!heroIds.length) return;

    const heroId = heroIds[0];
    const heroT  = core.getComponent(heroId, "Transform");
    const heroH  = core.getComponent(heroId, "Health");
    if (!heroT || !heroH || heroH.hp <= 0) return;

    const elapsedS = _elapsed;

    for (const bid of bosses) {
      const ai = core.getComponent(bid, "EnemyAI");
      const t  = core.getComponent(bid, "Transform");
      const h  = core.getComponent(bid, "Health");
      if (!ai || !t || !h) continue;
      if (ai.type !== "boss") continue;
      if (h.hp <= 0) continue;

      const dist = Math.hypot(t.u - heroT.u, t.v - heroT.v);
      if (dist >= SLAM_TRIGGER_DIST) continue;

      // Cooldown check
      const cd = ai._enraged ? SLAM_CD_ENRAGED : SLAM_CD_NORMAL;
      const lastSlam = ai._slamT ?? -999;
      if (elapsedS - lastSlam < cd) continue;

      // Fire slam
      ai._slamT = elapsedS;
      core.emit("boss:slam", { entityId: bid, u: t.u, v: t.v, radius: SLAM_RADIUS, enraged: !!ai._enraged });

      // Hero damage — falls off with distance
      const heroDmg = Math.round(SLAM_DMG * (1 - dist / SLAM_RADIUS));
      if (heroDmg > 0) {
        heroH.hp = Math.max(0, heroH.hp - heroDmg);
        core.emit("hero:damaged", { amount: heroDmg, sourceId: bid, type: "boss_slam" });
      }

      // Friendly-fire — nearby enemies take 30 flat damage
      const allEnemies = core.query("EnemyAI", "Transform", "Health");
      for (const eid of allEnemies) {
        if (eid === bid) continue; // skip self
        const et = core.getComponent(eid, "Transform");
        const eh = core.getComponent(eid, "Health");
        if (!et || !eh || eh.hp <= 0) continue;
        if (Math.hypot(et.u - t.u, et.v - t.v) < SLAM_FRIENDLY_DIST) {
          eh.hp = Math.max(0, eh.hp - SLAM_FRIENDLY_DMG);
        }
      }
    }
  }

  return system;
}

export default {
  createBossSlamSystem,
  SLAM_TRIGGER_DIST, SLAM_RADIUS, SLAM_DMG,
  SLAM_FRIENDLY_DIST, SLAM_FRIENDLY_DMG,
  SLAM_CD_NORMAL, SLAM_CD_ENRAGED,
};
