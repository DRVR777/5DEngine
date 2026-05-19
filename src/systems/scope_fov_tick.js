const AIM_RATE   = 12;
const SPRINT_RATE = 8;
const SNIPER_FOV  = 20;
const BASE_FOV    = 60;
const SCOPE_DIST  = 0.01;

export function mountScopeFovTick({ get, set, actions }) {
  function tick(dt, { aiming, computerOpen, computerEntering, isSprinting, heroDead, buildMode, inCar, currentWeaponId }) {
    const aimTarget = aiming && !computerOpen && !computerEntering ? 1 : 0;
    set.aimAmt(get.aimAmt() + (aimTarget - get.aimAmt()) * Math.min(1, dt * AIM_RATE));

    const sprintTarget = (isSprinting && !aiming && !heroDead && !buildMode && !inCar) ? 1 : 0;
    set.sprintFovAmt(get.sprintFovAmt() + (sprintTarget - get.sprintFovAmt()) * Math.min(1, dt * SPRINT_RATE));

    const isSniperScope = aiming && currentWeaponId === "sniper" && !buildMode && !computerOpen;
    if (isSniperScope && !get.wasSniperScope())  { set.sniperSavedCamDist(get.camDist()); set.camDist(SCOPE_DIST); }
    if (!isSniperScope && get.wasSniperScope())  { set.camDist(get.sniperSavedCamDist()); }
    if (isSniperScope) set.camDist(SCOPE_DIST);
    set.wasSniperScope(isSniperScope);

    actions.setFov(isSniperScope ? SNIPER_FOV : BASE_FOV + get.sprintFovAmt() * 8);
    actions.updateProjectionMatrix();
    return { isSniperScope };
  }
  return { tick };
}
