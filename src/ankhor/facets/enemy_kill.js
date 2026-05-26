/** enemy_kill — full death state + SFX/decal intents from legacy mountBulletEnemyKillTick */
export default {
  priority: 38,
  tick(_t, data, dt, _r) {
    if (!data.killed) return;
    const en = data;
    const nowMs = data.nowMs || Date.now();
    en.hp = 0; en.dead = true;
    en.respawnT = nowMs / 1000;
    en._wasChasing = false;

    if (data.headshot) data.bulletTimeBonus = 0.22;
    data.killMarkerUntil = nowMs + 300;
    data.killMarkerHs = data.headshot || false;

    // Type-specific SFX intents (adapter plays these)
    data.sfxIntents = data.sfxIntents || [];
    switch (en.type) {
      case "boss":
        data.sfxIntents.push({tone:"260:200:sine", vol:0.6}, {tone:"330:180:sine", vol:0.5}, {tone:"440:220:sine", vol:0.45});
        data.bossDefeated = true; data.liveBossCleared = true;
        break;
      case "heavy":
        data.sfxIntents.push({tone:"55:400:sawtooth", vol:0.5}, {tone:"80:200:sawtooth", vol:0.3});
        break;
      case "robot":
        data.sfxIntents.push({tone:"180:120:square", vol:0.3}, {tone:"360:80:square", vol:0.2});
        break;
      case "sniper":
        data.sfxIntents.push({tone:"500:80:sine", vol:0.25}, {tone:"250:120:sine", vol:0.2});
        break;
      default:
        data.sfxIntents.push({tone:"90:180:sawtooth", vol:0.22});
    }

    // Decal intent
    data.decalIntent = { u: en.u, v: en.v, type: en.type === "robot" ? "oil" : "blood" };

    // Spawn intents
    if (en.type === "incendiary") data.firePatchSpawn = { u: en.u, v: en.v };
    if (en.type === "poisoner") data.poisonPuddleSpawn = { u: en.u, v: en.v };

    // Kill counters
    data.enemyKills = (data.enemyKills || 0) + 1;
    data.killStreak = (data.killStreak || 0) + 1;
    const streakBonus = { 3:3, 5:5, 10:10 };
    if (streakBonus[data.killStreak]) data.streakCoins = streakBonus[data.killStreak];

    // Level up thresholds
    const kills = data.enemyKills;
    if (kills === 5) data.levelUp = 2;
    else if (kills === 15) data.levelUp = 3;
    else if (kills === 30) data.levelUp = 4;
  }
};
