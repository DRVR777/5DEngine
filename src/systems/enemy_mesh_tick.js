const COLLAPSE_DUR   = 0.6;   // seconds for death-fall animation
const BLEED_INTERVAL = 0.12;  // seconds between blood/oil drips
const BLEED_HP_FRAC  = 0.30;  // threshold below which dripping starts
const FLASH_DUR_MAX  = 2.0;   // emissive intensity during hit flash
const SPAWN_DUR      = 0.4;   // seconds for spawn-in scale animation
const FLINCH_SPRING  = 14;    // spring constant for flinch pitch recovery
const BOB_FREQ_MUL   = 3.5;   // walk-bob phase increment per unit of moveSpeed
const GEM_SPIN_RATE  = 2.5;   // radians/second for type-gem spin
const HP_BAR_SHOW_T  = 2.5;   // seconds to keep HP bar visible after hit

// Amplitude per enemy type
const BOB_AMP = { boss: 0.06, heavy: 0.05, fast: 0.04 };
const BOB_AMP_DEFAULT = 0.035;

// HP bar color thresholds
function hpColor(frac) {
  return frac > 0.6 ? 0x00cc44 : frac > 0.3 ? 0xff8800 : 0xff2222;
}

export function mountEnemyMeshTick({ actions }) {
  function tickAlive(en, em, dt, nowMs) {
    const nowSec = nowMs / 1000;
    const camYaw = actions.getCamYaw();
    const ep2 = actions.getPos(en.id);

    // Walk bob
    const moving = en._wasChasing || (en._heardShot > 0);
    if (moving) {
      if (!en._walkBobPhase) en._walkBobPhase = Math.random() * Math.PI * 2;
      en._walkBobPhase += (en.moveSpeed || 2.5) * BOB_FREQ_MUL * dt;
      const amp = BOB_AMP[en.type] ?? BOB_AMP_DEFAULT;
      em.group.position.set(ep2.u, Math.abs(Math.sin(en._walkBobPhase)) * amp, ep2.v);
    } else {
      em.group.position.set(ep2.u, 0, ep2.v);
    }
    em.group.rotation.y = en.heading;

    // Flinch spring — pitch backward on hit, spring back to 0
    if (en._flinchX == null) en._flinchX = 0;
    en._flinchX += (0 - en._flinchX) * Math.min(1, dt * FLINCH_SPRING);
    em.group.rotation.x = en._flinchX;

    // Spawn-in scale animation: scale from 0.05 → 1 over SPAWN_DUR seconds
    if (en._spawnT && (nowSec - en._spawnT) < SPAWN_DUR) {
      const sf = Math.min(1, (nowSec - en._spawnT) / SPAWN_DUR);
      em.group.scale.setScalar(0.05 + sf * 0.95);
      if (sf < 0.25) {
        const fl = 1 - sf / 0.25;
        for (const ch of (en._meshChildren || [])) {
          if (ch.material && ch.material.emissive) ch.material.emissiveIntensity = fl * FLASH_DUR_MAX * 1.25;
        }
      }
    } else {
      em.group.scale.setScalar(1);
      if (en._spawnT) {
        for (const ch of (en._meshChildren || [])) {
          if (ch.material && ch.material.emissive) ch.material.emissiveIntensity = 0;
        }
        en._spawnT = null;
      }
    }
    em.group.visible = true;

    // HP bar: width, position, color, visibility
    const hpFrac = en.hp / en.maxHp;
    em.hpFg.scale.x = Math.max(0.001, hpFrac);
    em.hpFg.position.x = -(1 - hpFrac) / 2;
    em.hpFg.material.color.setHex(hpColor(hpFrac));
    const barVisible = hpFrac < 1.0 && (!en._hpBarShowT || (nowSec - en._hpBarShowT) < HP_BAR_SHOW_T);
    if (em.hpPivot) { em.hpPivot.visible = barVisible; em.hpPivot.rotation.y = camYaw - en.heading; }

    // Detection "!" alert bubble
    const ab = em._alertBubble;
    if (ab) {
      if (en._alertT > 0) {
        en._alertT -= dt;
        ab.visible = true;
        const ps = 0.45 + 0.15 * Math.sin(nowMs / 90);
        ab.scale.set(ps, ps, 1);
      } else {
        ab.visible = false;
      }
    }

    // Spin type-indicator gem
    if (em._typeGem) em._typeGem.rotation.y += dt * GEM_SPIN_RATE;

    // Hit flash — white emissive burst while _hitFlashT > 0
    if (en._hitFlashT > 0) {
      en._hitFlashT -= dt;
      en._hitFlashWas = true;
      for (const ch of (en._meshChildren || [])) {
        if (!ch.material || !ch.material.emissive) continue;
        if (ch._origEmissive === undefined) {
          ch._origEmissive = ch.material.emissive.getHex();
          ch._origEmissiveInt = ch.material.emissiveIntensity || 0;
        }
        ch.material.emissive.setHex(0xffffff);
        ch.material.emissiveIntensity = FLASH_DUR_MAX;
      }
    } else if (en._hitFlashWas) {
      en._hitFlashWas = false;
      for (const ch of (en._meshChildren || [])) {
        if (ch._origEmissive !== undefined) {
          ch.material.emissive.setHex(ch._origEmissive);
          ch.material.emissiveIntensity = ch._origEmissiveInt;
        }
      }
    }

    // Blood/oil drip trail below 30% HP
    if (en.hp / en.maxHp < BLEED_HP_FRAC) {
      if (!en._bleedT || nowSec - en._bleedT > BLEED_INTERVAL) {
        en._bleedT = nowSec;
        const pos = actions.getPos(en.id);
        const isBot = en.type === "robot";
        actions.spawnParticles(
          pos.u + (Math.random() - 0.5) * 0.3, 0.05, pos.v + (Math.random() - 0.5) * 0.3,
          1, isBot ? "cyan" : "red", 0.5, 0.6
        );
      }
    }
  }

  // Returns true when the caller should `continue` to the next enemy.
  function tickDead(en, em, nowMs, enemyRespawnDelay) {
    const nowSec = nowMs / 1000;
    if (en._laserLine) en._laserLine.visible = false;
    const elapsed = nowSec - en.respawnT;
    if (elapsed < COLLAPSE_DUR) {
      const f = elapsed / COLLAPSE_DUR;
      const pos = actions.getPos(en.id);
      if (!pos) { em.group.visible = false; return true; }
      em.group.position.set(pos.u, -f * 0.5, pos.v);
      em.group.rotation.y = en.heading;
      em.group.rotation.x = f * Math.PI * 0.5;
      em.group.scale.setScalar(1 - f * 0.5);
      em.group.visible = true;
      if (em.hpPivot) em.hpPivot.visible = false;
      if (em._alertBubble) em._alertBubble.visible = false;
    } else {
      em.group.visible = false;
      em.group.rotation.x = 0;
      em.group.scale.setScalar(1);
    }
    if (elapsed > enemyRespawnDelay && !en.id.startsWith("en_spawned_")) {
      en.dead = false; en.hp = en.maxHp; en._fireDmgT = 0;
      actions.markHudDirty();
      const rsp = actions.spawnClearPos(12, 20);
      en.u = rsp.u; en.v = rsp.v;
      actions.setPos(en.id, 0, 0, 0, rsp.u, rsp.v);
    }
    return false;
  }

  // Call once per enemy per frame — returns true if caller should continue
  function tickEntry(en, em, dt, nowMs, enemyRespawnDelay) {
    if (!en.dead) { tickAlive(en, em, dt, nowMs); return false; }
    return tickDead(en, em, nowMs, enemyRespawnDelay);
  }

  return { tickEntry, tickAlive, tickDead };
}
