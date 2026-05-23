export function mountCamShakeTick({ get, set, actions }) {
  function tick(dt) {
    const amt = get.camShakeAmt();
    if (amt > 0.005) {
      actions.offsetCamera(
        (Math.random() - 0.5) * amt * 0.18,
        (Math.random() - 0.5) * amt * 0.18
      );
      set.camShakeAmt(amt * Math.exp(-dt * 14));
    } else {
      set.camShakeAmt(0);
    }
  }
  return { tick };
}
