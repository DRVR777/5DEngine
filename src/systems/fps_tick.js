export function mountFpsTick({ get, set, actions }) {
  function tick(now, el) {
    set.fpsFrames(get.fpsFrames() + 1);
    const elapsed = now - get.fpsWindowT();
    if (elapsed >= 1000) {
      const fps = Math.round(get.fpsFrames() * 1000 / elapsed);
      set.fpsDisplay(fps);
      set.fpsFrames(0);
      set.fpsWindowT(now);
      actions.onNewFps(fps);
    }
    if (el) el.textContent = get.fpsDisplay() + " FPS";
  }
  return { tick };
}
