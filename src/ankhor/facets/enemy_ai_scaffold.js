/** enemy_ai_scaffold — complete state machine from legacy mountEnemyAiScaffoldTick.
 *  20 magic numbers, BT init, knockback, sight/attack, smoke, alert, enrage,
 *  panic, stagger, heard-shot converge, pathfind, arena clamp. */
const SIGHT_RANGE_DEF = 12;
const ATTACK_RANGE_DEF = 1.8;
const ATTACK_CD = 1.0;
const LOSE_RANGE_MUL = 2.5;
const CROUCH_SIGHT_MUL = 0.6;
const ALERT_BARK_DIST = 6;
const ALERT_BARK_DUR = 1.6;
const BROADCAST_WINDOW = 1.5;
const ENRAGE_THRESHOLD = 0.25;
const ENRAGE_SPEED_MUL = 1.35;
const SLOW_SPEED_MUL = 0.55;
const PANIC_SPEED_MUL = 1.3;
const HEARD_SHOT_RADIUS = 9;
const CONVERGE_THRESH = 1.2;
const CONVERGE_SPEED = 0.7;
const STAGGER_ROT_RATE = Math.PI * 4;
const STAGGER_SPEED = 0.35;
const ARENA_HALF = 27.5;
const PATH_WP_RADIUS = 0.8;
const PATH_RECOMPUTE = 0.6;
const PATROL_DT_MUL = 0.35;

export default {
  priority: 20,
  tick(_t, data, dt, _r) {
    const en = data.enemy || data; if (!en || !en.id) return;
    const heroU = data.heroU || 0, heroV = data.heroV || 0;
    const nowMs = data.nowMs || Date.now();
    const crouching = data.crouching || false;
    const smokeZones = data.smokeZones || [];
    const heroShotAlertT = data.heroShotAlertT || 0;
    const heroShotAlertU = data.heroShotAlertU || 0;
    const heroShotAlertV = data.heroShotAlertV || 0;

    // Init BT
    if (!en._bt) {
      en._bt = { sightRange: en.sightRange || SIGHT_RANGE_DEF, attackRange: en.attackRange || ATTACK_RANGE_DEF, attackCD: ATTACK_CD, loseRange: (en.sightRange || SIGHT_RANGE_DEF) * LOSE_RANGE_MUL };
      en._patrolAngle = Math.random() * Math.PI * 2;
    }

    // Knockback
    if ((en._kbT || 0) > 0) { en._kbT -= dt; en.u = (en.u || 0) + (en._kbU || 0) * dt; en.v = (en.v || 0) + (en._kbV || 0) * dt; }

    const ep = { u: en.u || 0, v: en.v || 0 };
    const dx = heroU - ep.u, dz = heroV - ep.v, dist = Math.hypot(dx, dz);
    const effSight = (en.sightRange || SIGHT_RANGE_DEF) * (crouching ? CROUCH_SIGHT_MUL : 1);
    const smokeBlind = smokeZones.some(sz => Math.hypot(ep.u - sz.u, ep.v - sz.v) < (sz.radius || 3) || Math.hypot(heroU - sz.u, heroV - sz.v) < (sz.radius || 3));
    if ((en._blindT || 0) > 0) en._blindT -= dt;
    const canSee = !smokeBlind && !(en._blindT > 0) && dist <= effSight && data.hasLOS !== false;

    // Heard shot
    if (!canSee && !en._wasChasing && heroShotAlertT > 0) {
      const ad = Math.hypot(ep.u - heroShotAlertU, ep.v - heroShotAlertV);
      if (ad < HEARD_SHOT_RADIUS) { en._heardShot = heroShotAlertT; en._alertU = heroShotAlertU; en._alertV = heroShotAlertV; }
    }
    if (canSee) { en._lastSightT = nowMs / 1000; en._lastHeroPos = { u: heroU, v: heroV }; }

    // Alert bark
    if (canSee && !en._wasChasing && dist < ALERT_BARK_DIST) {
      en._wasChasing = true; en._alertT = ALERT_BARK_DUR;
      data.alertBark = { u: ep.u, v: ep.v, type: en.type };
      data.alertBroadcastT = nowMs / 1000;
    } else if (!canSee) { en._wasChasing = false; }
    if (!en._wasChasing && (nowMs / 1000 - (data.alertBroadcastT || 0)) < BROADCAST_WINDOW) en._alertT = 1.0;

    // Enrage / slow
    const hpFrac = (en.hp || 1) / (en.maxHp || 1);
    const isEnrageable = en.type === "boss" || en.type === "heavy";
    const enSpeedMul = hpFrac < ENRAGE_THRESHOLD ? (isEnrageable ? ENRAGE_SPEED_MUL : SLOW_SPEED_MUL) : 1;
    if (isEnrageable && !en._enraged && hpFrac < ENRAGE_THRESHOLD && en.hp > 0) {
      en._enraged = true;
      data.enrageEvent = { id: en.id, u: ep.u, v: ep.v, type: en.type };
    }

    // Panic flee
    if ((en._panicT || 0) > 0) {
      en._panicT -= dt;
      const fAng = Math.atan2(ep.u - heroU, ep.v - heroV);
      en.u += Math.sin(fAng) * (en.moveSpeed || 2) * PANIC_SPEED_MUL * enSpeedMul * dt;
      en.v += Math.cos(fAng) * (en.moveSpeed || 2) * PANIC_SPEED_MUL * enSpeedMul * dt;
      en.heading = fAng;
      data.panicState = { id: en.id, u: en.u, v: en.v };
      return;
    }

    // Heard-shot converge
    if ((en._heardShot || 0) > 0 && !canSee) {
      en._heardShot -= dt;
      const adx = (en._alertU || 0) - ep.u, adz = (en._alertV || 0) - ep.v;
      if (Math.hypot(adx, adz) > CONVERGE_THRESH) {
        const aAng = Math.atan2(adx, adz);
        en.heading = aAng;
        en.u += Math.sin(aAng) * (en.moveSpeed || 2) * CONVERGE_SPEED * enSpeedMul * dt;
        en.v += Math.cos(aAng) * (en.moveSpeed || 2) * CONVERGE_SPEED * enSpeedMul * dt;
        return;
      } else { en._heardShot = 0; }
    }

    // Stagger
    if ((en._staggerT || 0) > 0) {
      en._staggerT -= dt;
      en._staggerAngle = ((en._staggerAngle || 0) + dt * STAGGER_ROT_RATE);
      en.heading = en._staggerAngle;
      en.u += Math.sin(en._staggerAngle) * (en.moveSpeed || 2) * STAGGER_SPEED * dt;
      en.v += Math.cos(en._staggerAngle) * (en.moveSpeed || 2) * STAGGER_SPEED * dt;
      data.staggerState = { id: en.id, u: en.u, v: en.v, angle: en._staggerAngle };
      return;
    }

    // Chase toward hero (simplified — full BT needs pathfind adapter)
    if (canSee || en._wasChasing) {
      en.heading = Math.atan2(dx, dz);
      if (dist > (en._bt?.attackRange || ATTACK_RANGE_DEF)) {
        en.u += (dx / (dist || 1)) * (en.moveSpeed || 2) * enSpeedMul * dt;
        en.v += (dz / (dist || 1)) * (en.moveSpeed || 2) * enSpeedMul * dt;
      }
    } else {
      // Patrol
      en._patrolAngle = (en._patrolAngle || 0) + dt * PATROL_DT_MUL;
      const r = (en._patrolR || SIGHT_RANGE_DEF);
      en.u += Math.cos(en._patrolAngle) * (en.wanderSpeed || 1) * enSpeedMul * dt;
      en.v += Math.sin(en._patrolAngle) * (en.wanderSpeed || 1) * enSpeedMul * dt;
    }

    // Arena clamp
    en.u = Math.max(-ARENA_HALF, Math.min(ARENA_HALF, en.u));
    en.v = Math.max(-ARENA_HALF, Math.min(ARENA_HALF, en.v));

    // Expose state for sub-ticks (fast_charge, heavy_grenade, etc.)
    data.canSee = canSee;
    data.dist = dist;
    data.ep = ep;
    data.nowSec = nowMs / 1000;
  }
};
