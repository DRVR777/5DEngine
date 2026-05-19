// Per-enemy AI scaffold: BT init, knockback, canSee, alert bark, enrage, panic flee,
// heard-shot converge, grenade stagger, BT dispatch (chase/patrol/attack), arena clamp.
// Magic numbers: sightRangeDef=12, attackRangeDef=1.8, attackCD=1.0, loseRangeMul=2.5,
//   crouchSightMul=0.6, alertBarkDist=6, alertBarkDur=1.6, broadcastWindow=1.5,
//   enrageThreshold=0.25, enrageSpeedMul=1.35, slowSpeedMul=0.55,
//   panicSpeedMul=1.3, heardShotRadius=9, heardConvergeThresh=1.2,
//   convergeSpeed=0.7, staggerRotRate=Math.PI*4, staggerSpeed=0.35,
//   arenaHalfSize=27.5, pathWpRadius=0.8, pathRecomputeInterval=0.6, patrolDtMul=0.35.
export function mountEnemyAiScaffoldTick({
  getEnemyPos,
  setEnemyPos,
  resolveMove,
  hasLOS,
  makeBt,
  runBt,
  pathfind,
  getAlertBroadcastT,
  setAlertBroadcastT,
  robotPlasmaTick, empTick, heavyGrenadeTick, bossRockTick,
  poisonerSpitTick, incendiaryTick, bossSlamTick,
  poisonerRangedSpitTick, fastChargeTick, sniperTick, strafeMeleeTick,
  getHeroDead, getGodMode, getDodgeT, getHeroHp, getHeroArmor,
  actions: { playSfx, showToast, spawnParticles },
}) {
  function tick(dt, en, { heroU, heroV, nowMs, crouching, smokeZones, heroShotAlertT, heroShotAlertU, heroShotAlertV, em }) {
    if (!en._bt && makeBt) {
      en._bt = makeBt({
        sightRange:  en.sightRange  || 12,
        attackRange: en.attackRange || 1.8,
        attackCD:    1.0,
        loseRange:   (en.sightRange || 12) * 2.5,
      });
      en._patrolAngle = Math.random() * Math.PI * 2;
    }

    if (en._kbT > 0) {
      en._kbT -= dt;
      const kbEp = getEnemyPos(en.id);
      if (kbEp) setEnemyPos(en.id, kbEp.x, kbEp.y, kbEp.z, kbEp.u + en._kbU * dt, kbEp.v + en._kbV * dt);
    }

    const ep = getEnemyPos(en.id);
    if (!ep) return;

    const dx = heroU - ep.u, dz = heroV - ep.v;
    const dist = Math.hypot(dx, dz);
    const _effSight = (en.sightRange || 12) * (crouching ? 0.6 : 1.0);
    const _smokeBlind = smokeZones.some(sz =>
      Math.hypot(ep.u - sz.u, ep.v - sz.v) < sz.radius ||
      Math.hypot(heroU - sz.u, heroV - sz.v) < sz.radius
    );
    if (en._blindT > 0) en._blindT -= dt;
    const canSee = !_smokeBlind && !(en._blindT > 0) && dist <= _effSight && hasLOS(ep.u, ep.v, heroU, heroV);

    if (!canSee && !en._wasChasing && heroShotAlertT > 0) {
      const _adist = Math.hypot(ep.u - heroShotAlertU, ep.v - heroShotAlertV);
      if (_adist < 9) { en._heardShot = heroShotAlertT; en._alertU = heroShotAlertU; en._alertV = heroShotAlertV; }
    }
    if (canSee) { en._lastSightT = nowMs / 1000; en._lastHeroPos = { u: heroU, v: heroV }; }

    if (canSee && !en._wasChasing && dist < 6) {
      const alertFreq = en.type === "robot" ? 280 : en.type === "heavy" ? 90 : 160;
      playSfx(`tone:${alertFreq}:120:sawtooth`, 0.22);
      en._wasChasing = true;
      en._alertT = 1.6;
      setAlertBroadcastT(nowMs / 1000);
    } else if (!canSee) {
      en._wasChasing = false;
    }
    if (!en._wasChasing && (nowMs / 1000 - getAlertBroadcastT()) < 1.5) en._alertT = 1.0;

    const _hpFrac = en.hp / en.maxHp;
    const _isEnrageable = (en.type === "boss" || en.type === "heavy");
    const _enSpeedMul = _hpFrac < 0.25 ? (_isEnrageable ? 1.35 : 0.55) : 1;
    if (_isEnrageable && !en._enraged && _hpFrac < 0.25 && en.hp > 0) {
      en._enraged = true;
      spawnParticles(ep.u, 1.0, ep.v, 40, "red", 9, 1.2);
      playSfx("tone:60:350:sawtooth", 0.75);
      showToast(en.type === "boss" ? "★ BOSS ENRAGED!" : "HEAVY ENRAGED!", "danger", 2500);
    }
    if (en._meshChildren && en._meshChildren.length) {
      const _pulse = _hpFrac < 0.25 ? (0.5 + 0.5 * Math.sin(nowMs / (_isEnrageable ? 70 : 120))) : 0;
      for (const ch of en._meshChildren) {
        if (ch.material) {
          if (!ch._origColor) ch._origColor = ch.material.color.clone();
          ch.material.color.setRGB(
            Math.min(1, ch._origColor.r + _pulse * (_isEnrageable ? 0.9 : 0.6)),
            ch._origColor.g * (1 - _pulse * (_isEnrageable ? 0.7 : 0.4)),
            ch._origColor.b * (1 - _pulse * (_isEnrageable ? 0.7 : 0.4))
          );
        }
      }
    }

    if (en._panicT > 0) {
      en._panicT -= dt;
      const _fAng = Math.atan2(ep.u - heroU, ep.v - heroV);
      const _pm = { u: ep.u, v: ep.v, hitbox: { w: 0.7, d: 0.7 } };
      resolveMove(_pm, Math.sin(_fAng)*en.moveSpeed*1.3*_enSpeedMul*dt, Math.cos(_fAng)*en.moveSpeed*1.3*_enSpeedMul*dt);
      setEnemyPos(en.id, ep.x, 0, 0, _pm.u, _pm.v);
      en.heading = _fAng;
      if (en.mesh && en.mesh.children) {
        const _yFlash = 0.5 + 0.5 * Math.sin(nowMs / 70);
        for (const ch of (en._meshChildren || [])) {
          if (ch.material) {
            if (!ch._origColor) ch._origColor = ch.material.color.clone();
            ch.material.color.setRGB(
              Math.min(1, ch._origColor.r + _yFlash * 0.7),
              Math.min(1, ch._origColor.g + _yFlash * 0.6),
              ch._origColor.b * (1 - _yFlash * 0.4)
            );
          }
        }
      }
      return;
    }

    if (en._heardShot > 0 && !canSee) {
      en._heardShot -= dt;
      const _adx = (en._alertU || 0) - ep.u, _adz = (en._alertV || 0) - ep.v;
      if (Math.hypot(_adx, _adz) > 1.2) {
        const _aAng = Math.atan2(_adx, _adz);
        en.heading = _aAng;
        const _aem = { u: ep.u, v: ep.v, hitbox: { w: 0.7, d: 0.7 } };
        resolveMove(_aem, Math.sin(_aAng)*en.moveSpeed*0.7*_enSpeedMul*dt, Math.cos(_aAng)*en.moveSpeed*0.7*_enSpeedMul*dt);
        setEnemyPos(en.id, ep.x, 0, 0, _aem.u, _aem.v);
        return;
      } else { en._heardShot = 0; }
    }

    if (en._staggerT > 0) {
      en._staggerT -= dt;
      en._staggerAngle = ((en._staggerAngle || 0) + dt * (Math.PI * 4));
      en.heading = en._staggerAngle;
      const _sem = { u: ep.u, v: ep.v, hitbox: { w: 0.7, d: 0.7 } };
      resolveMove(_sem, Math.sin(en._staggerAngle) * en.moveSpeed * 0.35 * dt, Math.cos(en._staggerAngle) * en.moveSpeed * 0.35 * dt);
      setEnemyPos(en.id, ep.x, 0, 0, _sem.u, _sem.v);
      if (em) em.group.rotation.z = Math.sin(nowMs / 70) * 0.35;
      return;
    }
    if (em) em.group.rotation.z = 0;

    const nowSec = nowMs / 1000;
    const heroDead = getHeroDead();
    const godMode  = getGodMode();
    const dodgeT   = getDodgeT();
    const heroHp   = getHeroHp();
    const heroArmor = getHeroArmor();

    if (en._bt && runBt) {
      runBt(en._bt, {
        enemy: en, hero: { u: heroU, v: heroV }, dt, now: nowSec,
        distToHero: dist, canSeeHero: canSee,
        onChase: (ctx, pos) => {
          const target = pos || { u: heroU, v: heroV };
          if (pathfind) {
            if (!en._pathT || nowSec - en._pathT > 0.6 || !en._path || en._path.length === 0) {
              en._path = pathfind(ep.u, ep.v, target.u, target.v);
              en._pathT = nowSec;
            }
            while (en._path && en._path.length > 1) {
              const wp = en._path[0];
              if (Math.hypot(wp.u - ep.u, wp.v - ep.v) < 0.8) en._path.shift();
              else break;
            }
            const wp = (en._path && en._path.length > 0) ? en._path[0] : target;
            const ddx = wp.u - ep.u, ddz = wp.v - ep.v;
            const m = Math.hypot(ddx, ddz) || 1;
            en.heading = Math.atan2(ddx, ddz);
            { const _em = { u: ep.u, v: ep.v, hitbox: { w: 0.7, d: 0.7 } };
              resolveMove(_em, (ddx/m)*en.moveSpeed*_enSpeedMul*dt, (ddz/m)*en.moveSpeed*_enSpeedMul*dt);
              setEnemyPos(en.id, ep.x, 0, 0, _em.u, _em.v); }
          } else {
            const ddx = target.u - ep.u, ddz = target.v - ep.v;
            const m = Math.hypot(ddx, ddz) || 1;
            en.heading = Math.atan2(ddx, ddz);
            { const _em = { u: ep.u, v: ep.v, hitbox: { w: 0.7, d: 0.7 } };
              resolveMove(_em, (ddx/m)*en.moveSpeed*_enSpeedMul*dt, (ddz/m)*en.moveSpeed*_enSpeedMul*dt);
              setEnemyPos(en.id, ep.x, 0, 0, _em.u, _em.v); }
          }
          const cc = { canSee, dist, ep, nowSec, heroU, heroV };
          if (robotPlasmaTick)       robotPlasmaTick.tick(dt, en, cc);
          if (empTick)               empTick.tick(dt, en, { ...cc, heroDead, godMode });
          if (heavyGrenadeTick)      heavyGrenadeTick.tick(dt, en, cc);
          if (bossRockTick)          bossRockTick.tick(dt, en, cc);
          if (poisonerSpitTick)      poisonerSpitTick.tick(dt, en, cc);
          if (incendiaryTick)        incendiaryTick.tick(dt, en, cc);
          if (bossSlamTick)          bossSlamTick.tick(dt, en, { ...cc, dodgeT, heroDead, godMode, heroHp, heroArmor });
          if (poisonerRangedSpitTick) poisonerRangedSpitTick.tick(dt, en, cc);
          if (fastChargeTick)        fastChargeTick.tick(dt, en, { ...cc, dx, dz });
          if (sniperTick)            sniperTick.tick(dt, en, { ...cc, nowMs });
        },
        onPatrol: (ctx) => {
          en._patrolAngle = (en._patrolAngle || 0) + dt * 0.35;
          const r = 4 + ((en._patrolR = en._patrolR || (4 + Math.random() * 4)));
          const pu = en.u + Math.cos(en._patrolAngle) * r;
          const pv = en.v + Math.sin(en._patrolAngle) * r;
          const ddx = pu - ep.u, ddz = pv - ep.v;
          const m = Math.hypot(ddx, ddz) || 1;
          const wanderSpd = (en.wanderSpeed || 1.0);
          { const _em = { u: ep.u, v: ep.v, hitbox: { w: 0.7, d: 0.7 } };
            resolveMove(_em, (ddx/m)*wanderSpd*_enSpeedMul*dt, (ddz/m)*wanderSpd*_enSpeedMul*dt);
            setEnemyPos(en.id, ep.x, 0, 0, _em.u, _em.v); }
        },
        onAttack: (ctx) => {
          if (strafeMeleeTick) strafeMeleeTick.tick(dt, en, { nowSec: ctx.now, nowMs, ep, heroU, heroV, heroHp, heroArmor, godMode });
        },
      });
    } else {
      en.heading = Math.atan2(dx, dz);
      if (dist <= (en.sightRange || 12) && dist > (en.attackRange || 1.8)) {
        const m = dist || 1;
        { const _em = { u: ep.u, v: ep.v, hitbox: { w: 0.7, d: 0.7 } };
          resolveMove(_em, (dx/m)*en.moveSpeed*_enSpeedMul*dt, (dz/m)*en.moveSpeed*_enSpeedMul*dt);
          setEnemyPos(en.id, ep.x, 0, 0, _em.u, _em.v); }
      }
    }

    { const _epc = getEnemyPos(en.id); const _AR = 27.5;
      if (_epc && (Math.abs(_epc.u) > _AR || Math.abs(_epc.v) > _AR))
        setEnemyPos(en.id, _epc.x, 0, 0, Math.max(-_AR, Math.min(_AR, _epc.u)), Math.max(-_AR, Math.min(_AR, _epc.v))); }
  }
  return { tick };
}
