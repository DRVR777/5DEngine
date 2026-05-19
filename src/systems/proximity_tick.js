const INTERACT_DIST     = 2.5;
const SCREEN_HUE_PERIOD = 2000; // ms per full hue revolution

export function mountProximityTick({ get, set, actions }) {
  function tick(_dt, { heroU, heroV, nowMs }) {
    // Computer proximity
    const cp = actions.getComputerPos();
    set.nearComputer(Math.hypot(heroU - cp.u, heroV - cp.v) < INTERACT_DIST);

    // Pulse the computer screen color so the player notices it
    const sf = actions.getScreenFront();
    if (sf) sf.material.color.setHSL((nowMs / SCREEN_HUE_PERIOD) % 1, 0.5, 0.55);

    // NPC proximity — find the first NPC within range (skip when dialog/computer is open)
    set.nearNpc(null);
    if (!get.dialogOpen() && !get.computerOpen()) {
      for (const n of actions.getNpcDefs()) {
        const np = actions.getNpcPos(n.id);
        if (np && Math.hypot(heroU - np.u, heroV - np.v) < INTERACT_DIST) {
          set.nearNpc(n);
          break;
        }
      }
    }
  }

  return { tick };
}
