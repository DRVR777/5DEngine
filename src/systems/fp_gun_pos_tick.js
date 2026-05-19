const SW_DUR = 0.30;

export function mountFpGunPosTick({ get, set, actions }) {
  function tick(dt, now, { active, aiming, reloading, reloadStart, reloadDur, canSprint, gunBobPhase, gunKickZ, gunReloadX, meleeSwing }) {
    if (!active) return;

    const aimShift = aiming ? -0.08 : 0;

    let rdAmt = 0;
    if (reloading) {
      const rdPct = Math.min(1, (now - reloadStart) / reloadDur);
      rdAmt = rdPct < 0.2 ? rdPct / 0.2 : rdPct < 0.8 ? 1.0 : 1 - (rdPct - 0.8) / 0.2;
    }

    let switchT = get.weaponSwitchT();
    if (switchT > 0) { switchT = Math.max(0, switchT - dt); set.weaponSwitchT(switchT); }
    const swapDrop = switchT > 0
      ? (switchT > SW_DUR / 2
        ? (((SW_DUR - switchT) / (SW_DUR / 2)) * -0.44)
        : ((switchT / (SW_DUR / 2)) * -0.44))
      : 0;

    const bobScale = aiming ? 0.25 : 1;
    const bobY = Math.sin(gunBobPhase) * (canSprint ? 0.022 : 0.013) * bobScale;
    const bobX = Math.sin(gunBobPhase * 0.5) * (canSprint ? 0.014 : 0.008) * bobScale;

    actions.setPosition(
      0.22 + aimShift + rdAmt * 0.10 + bobX,
      -0.24 - rdAmt * 0.30 + swapDrop + bobY,
      -0.45 + gunKickZ * 0.6 + rdAmt * 0.05
    );
    actions.setRotation(rdAmt * 0.42 + gunReloadX * 0.05, rdAmt * -0.22, meleeSwing * 0.9);
  }
  return { tick };
}
