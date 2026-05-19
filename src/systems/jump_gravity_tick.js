export function mountJumpGravityTick({ jumpV, gravity, get, set, actions }) {
  function tick(dt, { spaceDown, buildMode }) {
    if (buildMode) return { onGround: false };
    const pos = actions.getPos();
    const support = actions.getSupport(pos.u, pos.v, pos.y);
    const onSupport = pos.y <= support.topY + 0.001;
    let onGround = onSupport;
    const spaceRising = spaceDown && !get.spaceWasDown();
    if (spaceDown && onSupport) {
      set.velocityY(jumpV);
      set.canDoubleJump(true);
    } else if (spaceRising && !onSupport && get.canDoubleJump() && get.stamina() >= 20 && !actions.heroDead()) {
      set.velocityY(jumpV * 0.85);
      set.canDoubleJump(false);
      set.stamina(Math.max(0, get.stamina() - 20));
      actions.spawnDoubleJumpFx(pos.u, pos.y, pos.v);
    }
    set.spaceWasDown(spaceDown);
    set.velocityY(get.velocityY() + gravity * dt);
    let newY = pos.y + get.velocityY() * dt;
    const supportAfter = actions.getSupport(pos.u, pos.v, Math.max(newY, pos.y));
    if (newY < supportAfter.topY) {
      const impact = get.velocityY();
      newY = supportAfter.topY;
      set.velocityY(0);
      onGround = true;
      actions.onLand(impact);
    }
    if (newY < 0) { newY = 0; set.velocityY(0); onGround = true; }
    actions.setPos(pos.x, newY, pos.z, pos.u, pos.v);
    return { onGround };
  }
  return { tick };
}
