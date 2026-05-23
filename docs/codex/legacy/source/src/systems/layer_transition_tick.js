export function mountLayerTransitionTick({ get, actions }) {
  function tick(dt, { heroU, heroV, buildings }) {
    const insideNow = actions.boundaryAt(heroU, heroV, buildings);
    const targetLayer = insideNow ? insideNow.targetLayerId : 1;
    if (targetLayer !== get.layerId()) {
      actions.logTransition(get.layerId(), targetLayer);
      if (insideNow) actions.showToast(`Entered ${actions.bldgName(insideNow.targetLayerId)}`, "info", 1800);
      else actions.showToast("Outside", "info", 1200);
      actions.playSfx(`tone:${insideNow ? 320 : 180}:200:sine`, 0.12);
    }
    return { insideNow };
  }
  return { tick };
}
