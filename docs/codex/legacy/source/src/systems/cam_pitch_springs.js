export function mountCamPitchSprings({ camPitchMax, get, set }) {
  function tick(dt) {
    if (get.recoilPitch() !== 0) {
      set.camPitch(get.camPitch() + get.recoilPitch() * dt * 8);
      const next = get.recoilPitch() + (0 - get.recoilPitch()) * Math.min(1, dt * 8);
      set.recoilPitch(Math.abs(next) < 0.0001 ? 0 : next);
    }
    if (get.hitPunchPitch() > 0.0001) {
      set.camPitch(Math.min(camPitchMax, get.camPitch() + get.hitPunchPitch() * dt * 10));
      const decayed = get.hitPunchPitch() * Math.exp(-dt * 14);
      set.hitPunchPitch(decayed < 0.0001 ? 0 : decayed);
    }
  }
  return { tick };
}
