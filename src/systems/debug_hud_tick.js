const BLDG_NAMES = { 2:"shop", 3:"tower", 4:"house", 5:"garage", 6:"diner", 7:"bank", 8:"park", 9:"studio" };
const HP_BAR_LEN = 16;

export function mountDebugHudTick({ actions }) {
  let _lastEnemyHpStr = "";

  function tick(_dt, {
    heroPos, heroU, heroV, worldLayerId, insideNow,
    inCar, activeVehicleId, activeVehicleType, carSpeed, vehicleInteractDist,
    vehicleDefs,
    score, pickupsLen, heroHp, heroMaxHp, perkMaxHpBonus, enemyKills,
    enemies, nowSec, enemyRespawnDelay, enemyHpDirty,
    nearNpc, nearComputer, computerOpen, spine, mouseMode, buildMode,
    reloadMsgUntil, performanceNow, reloadMsg,
  }) {
    // Find nearest vehicle
    let nearVehDist = Infinity, nearVehDef = null;
    for (const v of vehicleDefs) {
      const d = actions.getVehDist(v.id);
      if (d < nearVehDist) { nearVehDist = d; nearVehDef = v; }
    }
    const bldgName = id => BLDG_NAMES[id] || `L${id}`;

    // HP bar
    const hpMax  = (heroMaxHp + (perkMaxHpBonus || 0)) || 1;
    const hpFrac = Math.max(0, Math.min(1, heroHp / hpMax));
    const filled = Math.round(HP_BAR_LEN * hpFrac);
    const hpBar  = "▰".repeat(filled) + "▱".repeat(HP_BAR_LEN - filled);
    const hpColor = hpFrac > 0.5 ? "#5dff5d" : (hpFrac > 0.25 ? "#ffd166" : "#ff5d5d");

    // Enemy HP string — only recompute when dirty
    if (enemyHpDirty) {
      const alive = enemies.filter(e => !e.dead);
      if (alive.length) {
        _lastEnemyHpStr = alive.map(e =>
          `<b style="color:#ff${(e.color || 0xff0044).toString(16).slice(2)}">${e.hp}/${e.maxHp}</b>`
        ).join(" | ");
      } else {
        const nextRespawn = Math.max(0,
          enemyRespawnDelay - (nowSec - Math.max(...enemies.map(e => e.respawnT)))
        );
        _lastEnemyHpStr = `<span style="color:#888">all dead — respawn in ${nextRespawn.toFixed(0)}s</span>`;
      }
      actions.clearEnemyHpDirty();
    }

    const html =
      `pos <b>(${heroPos.x.toFixed(1)}, ${heroPos.y.toFixed(1)}, ${heroPos.z.toFixed(1)})</b>` +
      `<br>engine.uv <b>(${heroU.toFixed(2)}, ${heroV.toFixed(2)})</b>` +
      `<br>layer <b>${worldLayerId}</b>` +
      (insideNow ? `<br>inside <b>${bldgName(insideNow.targetLayerId)}</b>` : "") +
      (inCar && activeVehicleId
        ? `<br><b>IN ${activeVehicleType.toUpperCase()}</b> speed=${carSpeed.toFixed(1)} m/s`
        : (nearVehDist < vehicleInteractDist
            ? `<br>press <b>E</b> to enter ${nearVehDef.type}`
            : "")) +
      `<br>coins <b style="color:#ffd166">${score}</b> <span style="color:#666;font-size:9px">[Tab=shop]</span>` +
      (score === pickupsLen && pickupsLen > 0 ? `<br><span style="color:#0f0">★ ALL COLLECTED</span>` : "") +
      `<br>hp <b style="color:${hpColor}">${heroHp.toFixed(0)}/${heroMaxHp}</b> ` +
      `<span style="color:${hpColor};font-family:monospace">${hpBar}</span>` +
      `<br>kills <b style="color:#ff6666">${enemyKills}</b>` +
      `<br>enemies: ${_lastEnemyHpStr}` +
      (nearNpc ? `<br><b style="color:#00ffaa">[E] talk to ${nearNpc.id.replace("npc_", "").toUpperCase()}</b>` : "") +
      (nearComputer ? `<br><b style="color:#44ccff">[E] use computer</b>` : "") +
      (computerOpen ? `<br><span style="color:#44ccff">★ computer open</span>` : "") +
      (spine ? `<br>cam <b style="color:#88ddff">${spine.zone}</b> <span style="color:#888">(${(spine.localT * 100).toFixed(0)}%)</span>` : "") +
      (mouseMode ? `<br><b style="color:#ffff00">🖱 MOUSE MODE</b> <span style="color:#888">— ESC or M to exit</span>` : "") +
      (buildMode ? `<br><b style="color:#00ccff">BUILD MODE</b> <span style="color:#556677">WASD fly · R=lock mouse · P=char · K=config · N=spawn point · Tab=library</span>` : "") +
      (reloadMsgUntil > performanceNow ? `<br><b style="color:#ffd166">↻ ${reloadMsg}</b>` : "");

    actions.setHudHtml(html);
    return { nearVehDef, nearVehDist };
  }

  return { tick };
}
