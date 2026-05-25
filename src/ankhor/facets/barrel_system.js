/** barrel_system — RADIUS=5, MAX_DMG=60, chain reaction from legacy */
const RADIUS = 5;
const MAX_DMG = 60;
const CHAIN_RADIUS = RADIUS * 0.8;

export default {
  priority: 60,
  tick(_t, data, dt, _r) {
    const barrels = data.barrels; if (!barrels || !barrels.length) return;
    const heroU = data.heroU || 0, heroV = data.heroV || 0;
    const enemies = data.enemies || [];
    const newExplosions = [];

    for (const b of barrels) {
      if (b.exploded) continue;
      // Check if hp depleted (from fire_patch, bullet hits, etc.)
      if ((b.hp || 40) <= 0 && !b._exploding) {
        b._exploding = true;
        newExplosions.push({ u: b.u, v: b.v });

        // Hero damage
        const hd = Math.hypot(heroU - b.u, heroV - b.v);
        if (hd < RADIUS && (data.heroHp || 100) > 0 && (data.dodgeT || 0) <= 0 && !data.godMode) {
          const sd = Math.round(MAX_DMG * (1 - hd / RADIUS));
          let finalDmg = sd;
          const armor = data.heroArmor || 0;
          if (armor > 0) {
            const absorbed = Math.min(armor, finalDmg * (data.armorAbsorb || 0.5));
            data.heroArmor = Math.max(0, armor - absorbed);
            finalDmg -= absorbed;
          }
          data.heroHp = Math.max(0, (data.heroHp || 100) - finalDmg);
          data.hitEvents = data.hitEvents || [];
          data.hitEvents.push({ dmg: finalDmg, source: "barrel", u: b.u, v: b.v });
          if (data.heroHp <= 0) data.heroDead = true;
        }

        // Enemy damage
        for (const en of enemies) {
          if (en.dead || en.hp <= 0) continue;
          const d = Math.hypot((en.u || 0) - b.u, (en.v || 0) - b.v);
          if (d < RADIUS) {
            en.hp = Math.max(0, en.hp - Math.round(MAX_DMG * (1 - d / RADIUS)));
            if (en.hp <= 0) {
              en.dead = true;
              data.kills = data.kills || [];
              data.kills.push({ enemyId: en.id, u: en.u, v: en.v, source: "barrel" });
            }
          }
        }

        // Chain reaction: nearby barrels
        for (const b2 of barrels) {
          if (b2.exploded || b2 === b || b2._exploding) continue;
          if (Math.hypot(b2.u - b.u, b2.v - b.v) < CHAIN_RADIUS) {
            b2.hp = 0;
            b2._exploding = true;
            newExplosions.push({ u: b2.u, v: b2.v, chain: true });
          }
        }
      }
    }

    // Mark all processed explosions
    for (const b of barrels) {
      if (b._exploding && !b.exploded) {
        b.exploded = true;
        data.barrelExplosions = data.barrelExplosions || [];
        data.barrelExplosions.push({ u: b.u, v: b.v });
      }
    }
  }
};
