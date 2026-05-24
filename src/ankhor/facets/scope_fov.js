/** scope-fov facet - native Ankhor replacement for mountScopeFovTick. */

const AIM_RATE = 12;
const SPRINT_RATE = 8;
const SNIPER_FOV = 20;
const BASE_FOV = 60;
const SCOPE_DIST = 0.01;

export default {
  priority: 20,

  tick(_thing, data, dt, registry) {
    const input = readInput(registry);
    const keys = input.keys || {};
    const aiming = input.mouseHeld === true;
    const computerOpen = data.computerOpen === true;
    const computerEntering = data.computerEntering === true;
    const isSprinting = keys.ShiftLeft === true;
    const heroDead = data.heroDead === true;
    const buildMode = data.buildMode === true;
    const inCar = data.inCar === true;
    const currentWeaponId = currentWeapon(registry, data);

    const aimTarget = aiming && !computerOpen && !computerEntering ? 1 : 0;
    data.aimAmt = value(data.aimAmt) + (aimTarget - value(data.aimAmt)) * Math.min(1, dt * AIM_RATE);

    const sprintTarget = (isSprinting && !aiming && !heroDead && !buildMode && !inCar) ? 1 : 0;
    data.sprintFovAmt = value(data.sprintFovAmt) + (sprintTarget - value(data.sprintFovAmt)) * Math.min(1, dt * SPRINT_RATE);

    const isSniperScope = aiming && currentWeaponId === "sniper" && !buildMode && !computerOpen;
    const wasSniperScope = data.wasSniperScope === true;
    if (isSniperScope && !wasSniperScope) {
      data.sniperSavedCamDist = value(data.camDist, 6);
      data.camDist = SCOPE_DIST;
    }
    if (!isSniperScope && wasSniperScope) data.camDist = value(data.sniperSavedCamDist, 6);
    if (isSniperScope) data.camDist = SCOPE_DIST;
    data.wasSniperScope = isSniperScope;

    data.fov = isSniperScope ? SNIPER_FOV : BASE_FOV + value(data.sprintFovAmt) * 8;
    const camera = renderCamera(registry);
    if (camera) {
      camera.fov = data.fov;
      if (typeof camera.updateProjectionMatrix === "function") camera.updateProjectionMatrix();
    }
    data.isSniperScope = isSniperScope;
  },
};

function readInput(registry) {
  const inputThing = registry.byKind("input")[0];
  return inputThing ? registry.facetData(inputThing.id, "input-state") || {} : {};
}

function currentWeapon(registry, data) {
  if (typeof data.currentWeaponId === "string") return data.currentWeaponId;
  const hero = registry.byKind("hero")[0];
  const inv = hero ? registry.facetData(hero.id, "inventory") : null;
  return typeof inv?.currentWeaponId === "string" ? inv.currentWeaponId : "pistol";
}

function renderCamera(registry) {
  const ctxThing = registry.byKind("render-context")[0];
  const ctx = ctxThing ? registry.facetData(ctxThing.id, "render-context") : null;
  return ctx?.camera || null;
}

function value(v, fallback = 0) {
  return typeof v === "number" ? v : fallback;
}
