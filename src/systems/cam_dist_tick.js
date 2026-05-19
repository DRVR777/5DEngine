// Snap-zone zoom lerp (Q/Z/V keybinds) + computer-entry camera dolly.
// Both manipulate camDist each frame.
export function mountCamDistTick({ get, set, actions }) {
  function tick(dt) {
    const snapTarget = get.snapZoomTarget();
    if (snapTarget != null) {
      const newDist = actions.lerpZoom(get.camDist(), snapTarget, dt, 8);
      if (newDist != null) {
        if (Math.abs(newDist - snapTarget) < 0.05) {
          set.camDist(snapTarget);
          set.snapZoomTarget(null);
        } else {
          set.camDist(newDist);
        }
      }
    }

    if (get.computerEntering()) {
      const t = get.computerEntryT() + dt / get.computerEntryDur();
      if (t >= 1) {
        set.computerEntryT(1);
        actions.finishComputerEntry();
      } else {
        set.computerEntryT(t);
        const ease = t * t * (3 - 2 * t); // smoothstep
        set.camDist(get.camDistBeforeEntry() * (1 - ease) + 0.35 * ease);
      }
    }
  }

  return { tick };
}
