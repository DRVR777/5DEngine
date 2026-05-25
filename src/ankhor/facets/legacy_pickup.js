/** legacy_pickup — magic numbers: BOB_BASE=1.0, BOB_AMP=0.15, BOB_PERIOD=300, SPIN_SPEED=2 */
export default {
  priority: 72,
  tick(_t, data, dt, _r) {
    const ps = data.pickups; if (!ps || !ps.length) return;
    for (const pk of ps) {
      if (pk.collected) continue;
      pk.bobY = 1.0 + Math.sin(Date.now() / 300 + (pk.u || 0)) * 0.15;
      pk.spin = (pk.spin || 0) + dt * 2;
    }
  }
};
