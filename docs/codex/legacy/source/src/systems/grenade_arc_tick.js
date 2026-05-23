const DOT_COUNT       = 16;
const DOT_RADIUS      = 0.06;
const DOT_COLOR       = 0xff8800;
const DOT_DANGER_COLOR = 0xff2200;
const DOT_OPACITY_BASE = 0.7;
const ARC_STEP        = 0.08;
const THROW_SPEED_UV  = 13;
const THROW_SPEED_Y   = 6;
const THROW_GRAVITY   = 9.8;
const THROW_OFFSET_UV = 0.5;
const THROW_OFFSET_Y  = 1.2;
const COOK_MAX_SEC    = 4.0;
const COOK_DANGER_SEC = 3.0;
const FUSE_DEFAULT    = 2.5;
const COOK_DAMAGE     = 50;

export function mountGrenadeArcTick({ THREE, get, set, actions }) {
  const mat = new THREE.MeshBasicMaterial({ color: DOT_COLOR, transparent: true, opacity: DOT_OPACITY_BASE });
  const geo = new THREE.SphereGeometry(DOT_RADIUS, 6, 4);
  const dots = Array.from({ length: DOT_COUNT }, () => {
    const m = new THREE.Mesh(geo, mat.clone());
    m.visible = false;
    actions.addToScene(m);
    return m;
  });

  function tick(_dt, { buildMode, computerOpen, heroDead, grenadeCount, keyG, heroU, heroV, heroY, camYaw, grenadePressT, performanceNow }) {
    // Cook safety — auto-detonate if held > 4s
    if (grenadePressT && !heroDead && (performanceNow - grenadePressT) / 1000 >= COOK_MAX_SEC) {
      set.grenadePressT(0);
      set.grenadeCount(Math.max(0, grenadeCount - 1));
      const hp = get.heroHp();
      set.heroHp(Math.max(0, hp - COOK_DAMAGE));
      actions.flashDamage();
      actions.applyScreenShake(0.6);
      actions.spawnParticles(heroU, heroY + 1.0, heroV, 100, "orange", 18, 2.0);
      actions.playSfx("tone:80:350:sawtooth", 0.9);
      actions.showToast("GRENADE COOKED — OUCH! -50 HP", "danger", 1800);
      if (get.heroHp() <= 0) actions.showDeathScreen();
    }

    const showArc = !buildMode && !computerOpen && !heroDead && grenadeCount > 0 && keyG;
    if (showArc) {
      const fx = Math.sin(camYaw), fz = Math.cos(camYaw);
      let au = heroU + fx * THROW_OFFSET_UV, ay = heroY + THROW_OFFSET_Y, av = heroV + fz * THROW_OFFSET_UV;
      let vU = fx * THROW_SPEED_UV, vY = THROW_SPEED_Y, vV = fz * THROW_SPEED_UV;
      const cookSec = grenadePressT ? (performanceNow - grenadePressT) / 1000 : 0;
      const fuseLeft = Math.max(0, FUSE_DEFAULT - cookSec);
      const cookDanger = cookSec >= COOK_DANGER_SEC;

      for (let i = 0; i < DOT_COUNT; i++) {
        au += vU * ARC_STEP; ay += vY * ARC_STEP; av += vV * ARC_STEP;
        vY -= THROW_GRAVITY * ARC_STEP;
        if (ay < 0) ay = 0;
        dots[i].position.set(au, ay, av);
        dots[i].visible = true;
        dots[i].material.color.set(cookDanger ? DOT_DANGER_COLOR : DOT_COLOR);
        dots[i].material.opacity = DOT_OPACITY_BASE * (1 - i / DOT_COUNT);
      }

      const timerEl = actions.getTimerEl();
      if (timerEl) {
        timerEl.style.display = "block";
        timerEl.textContent = cookDanger ? `COOK: ${fuseLeft.toFixed(1)}s ⚠` : `FUSE: ${fuseLeft.toFixed(1)}s`;
        timerEl.style.color = cookDanger ? "#ff2222" : "#ffd166";
      }
    } else {
      dots.forEach(d => { d.visible = false; });
      const timerEl = actions.getTimerEl();
      if (timerEl) timerEl.style.display = "none";
    }
  }

  return { tick };
}
