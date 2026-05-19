// Robot EMP burst: blue ring every 8s, disables hero sprint within 4m.
// THREE, scene, shockwaves are raw materials; actions are pure verbs.
export function mountEnemyRobotEmpTick({ THREE, scene, shockwaves, actions }) {
  function tick(dt, en, { canSee, dist, ep, nowSec, heroDead, godMode }) {
    if (en.type !== "robot" || !canSee || dist >= 12) return;
    if (en._empT && nowSec - en._empT <= 8.0) return;
    en._empT = nowSec;
    const g = new THREE.TorusGeometry(1, 0.06, 6, 36);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0x00aaff, transparent: true, opacity: 0.9, depthWrite: false }));
    m.rotation.x = Math.PI / 2;
    m.position.set(ep.u, 0.12, ep.v);
    scene.add(m);
    shockwaves.push({ mesh: m, maxR: 8, t: 0, dur: 0.7 });
    actions.playSfx("tone:180:200:square", 0.55);
    actions.playSfx("tone:320:150:square", 0.35);
    if (dist < 4 && !heroDead && !godMode) {
      actions.setHeroEmpT(2.5);
      actions.showToast("EMP! Sprint disabled 2.5s", "danger", 2500);
      actions.flashDamage(0.35);
    }
  }
  return { tick };
}
