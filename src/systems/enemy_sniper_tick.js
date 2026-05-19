// Sniper AI: stays 10-18m, 4s fire cycle (2.8s lock-on, fires at 3.95s), backs off <9m.
// THREE, scene, enemyBullets, resolveMove, getEnemyPos, setEnemyPos are raw materials.
// Magic numbers: backoffDist=9, hitboxW=0.5, hitboxD=0.5, backoffSpeedMul=2,
//   cycleLen=4.0, lockPhase=2.8, firePhase=3.95, shotCooldown=3.5, muzzleY=1.4,
//   bulletW=0.04, bulletH=0.04, bulletLen=0.5, bulletSpeed=30, bulletRange=25,
//   laserOpacity=0.7, laserRenderOrder=999, flashMul=0.9, flashDesatG=0.6, flashDesatB=0.6,
//   alertDist=22, bulletTime=0.38.
export function mountEnemySniperTick({ THREE, scene, enemyBullets, resolveMove, getEnemyPos, setEnemyPos, actions }) {
  function tick(dt, en, { canSee, dist, ep, nowMs, nowSec, heroU, heroV }) {
    if (en.type !== "sniper" || !canSee) return;

    // Back away if hero too close
    if (dist < 9) {
      const fAng = Math.atan2(ep.u - heroU, ep.v - heroV);
      const mover = { u: ep.u, v: ep.v, hitbox: { w: 0.5, d: 0.5 } };
      resolveMove(mover, Math.sin(fAng) * en.moveSpeed * 2 * dt, Math.cos(fAng) * en.moveSpeed * 2 * dt);
      setEnemyPos(en.id, ep.x, 0, 0, mover.u, mover.v);
    }

    if (!en._sniperPhaseT) en._sniperPhaseT = nowSec;
    const snPhase = (nowSec - en._sniperPhaseT) % 4.0;
    const isLockon = snPhase >= 2.8;

    // Flash mesh red during lock-on
    if (en._meshChildren && en._meshChildren.length) {
      const flash = isLockon ? (0.5 + 0.5 * Math.sin(nowMs / (isLockon ? 60 : 200))) : 0;
      for (const ch of en._meshChildren) {
        if (ch.material) {
          if (!ch._origColor) ch._origColor = ch.material.color.clone();
          ch.material.color.setRGB(
            Math.min(1, ch._origColor.r + flash * 0.9),
            ch._origColor.g * (1 - flash * 0.6),
            ch._origColor.b * (1 - flash * 0.6),
          );
        }
      }
    }

    if (isLockon && !en._sniperLockSnd) { en._sniperLockSnd = true; actions.playSfx("tone:1800:40:sine", 0.2); }
    if (!isLockon) en._sniperLockSnd = false;

    // Lazy-create laser sight line
    if (!en._laserLine) {
      const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 1)]);
      en._laserLine = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.7 }));
      en._laserLine.renderOrder = 999;
      scene.add(en._laserLine);
    }
    if (isLockon) {
      const arr = en._laserLine.geometry.attributes.position.array;
      arr[0] = ep.u; arr[1] = ep.y + 1.4; arr[2] = ep.v;
      arr[3] = heroU; arr[4] = 1.0; arr[5] = heroV;
      en._laserLine.geometry.attributes.position.needsUpdate = true;
      en._laserLine.material.opacity = 0.5 + 0.4 * Math.sin(nowMs / 45);
      en._laserLine.visible = true;
    } else {
      en._laserLine.visible = false;
    }

    // Fire at end of cycle
    if (snPhase >= 3.95 && (!en._sniperShotT || nowSec - en._sniperShotT > 3.5)) {
      en._sniperShotT = nowSec;
      en._sniperPhaseT = nowSec;
      const ang = Math.atan2(heroU - ep.u, heroV - ep.v);
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 0.04, 0.5),
        new THREE.MeshBasicMaterial({ color: 0xffffff }),
      );
      mesh.position.set(ep.u, ep.y + 1.4, ep.v);
      scene.add(mesh);
      enemyBullets.push({
        mesh, posU: ep.u, posV: ep.v, posY: ep.y + 1.4,
        dirU: Math.sin(ang), dirV: Math.cos(ang), dirY: 0,
        speed: 30, damage: en.damage, traveled: 0, range: 25,
      });
      actions.playSfx("tone:2000:80:sawtooth", 0.65);
      actions.playSfx("tone:800:60:sawtooth", 0.4);
      actions.screenShake(0.15);
      if (dist < 22) actions.alertShot();
    }
  }
  return { tick };
}
