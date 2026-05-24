/** cam-shake facet — native Ankhor replacement for mountCamShakeTick.
 *
 * Legacy contract (src/systems/cam_shake_tick.js):
 *   if amt > 0.005:
 *     offset camera by two random signed impulses scaled by amt * 0.18
 *     amt *= exp(-dt * 14)
 *   else:
 *     amt = 0
 */

export default {
  priority: 18,

  tick(_thing, data, dt, registry) {
    const amt = readAmount(data);
    if (amt > 0.005) {
      const dx = (Math.random() - 0.5) * amt * 0.18;
      const dy = (Math.random() - 0.5) * amt * 0.18;
      offsetCamera(registry, dx, dy);
      data.lastOffsetDx = dx;
      data.lastOffsetDy = dy;
      writeAmount(data, amt * Math.exp(-dt * 14));
    } else {
      data.lastOffsetDx = 0;
      data.lastOffsetDy = 0;
      writeAmount(data, 0);
    }
  },
};

function readAmount(data) {
  if (typeof data.amount === "number") return data.amount;
  if (typeof data.camShakeAmt === "number") return data.camShakeAmt;
  if (typeof data._camShakeAmt === "number") return data._camShakeAmt;
  return 0;
}

function writeAmount(data, value) {
  data.amount = value;
  data.camShakeAmt = value;
  data._camShakeAmt = value;
}

function offsetCamera(registry, dx, dy) {
  const ctxThing = registry.byKind("render-context")[0];
  if (!ctxThing) return;
  const ctx = registry.facetData(ctxThing.id, "render-context");
  const camera = ctx?.camera;
  if (!camera?.position) return;
  camera.position.x += dx;
  camera.position.y += dy;
}
