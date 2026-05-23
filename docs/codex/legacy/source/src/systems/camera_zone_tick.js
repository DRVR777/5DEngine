const AIM_PULL_FRAC   = 0.4;  // how much aiming pulls camera in
const CAR_CAM_MIN     = 6;    // minimum camera dist when inside a vehicle
const FP_DIST_THRESH  = 0.5;  // dist below this forces first-person

export function mountCameraZoneTick({ get, actions }) {
  function tick(_dt, { buildMode, inCar, computerOpen, heroDead }) {
    const camDist    = get.camDist();
    const aimAmt     = get.aimAmt();
    const camDistMax = get.camDistMax();
    const aimMul     = 1 - AIM_PULL_FRAC * aimAmt;
    const spineZoom  = Math.max(0, Math.min(1, camDist / camDistMax)) * aimMul;
    const spine      = actions.evaluateSpine(spineZoom, camDistMax);
    const dist       = inCar ? Math.max(camDist, CAR_CAM_MIN) : camDist * aimMul;
    const spineZone  = spine ? spine.zone : null;
    const firstPerson = !inCar && (spineZone === "INSIDE" || spineZone === "FIRST_PERSON" || dist < FP_DIST_THRESH);
    const isDrone     = actions.isActiveDrone(inCar);
    const heroVisible = buildMode || (isDrone ? false : (!inCar && (spine ? spine.params.heroVisible : !firstPerson)));
    actions.setHeroGroupVisible(heroVisible);
    actions.setShadowBlobVisible(!inCar && !firstPerson && !buildMode);
    const fpGunActive = firstPerson && !buildMode && !inCar && !computerOpen && !heroDead;
    actions.setFpGunGroupVisible(fpGunActive);
    return { firstPerson, spineZone, dist, spine, fpGunActive };
  }

  return { tick };
}
