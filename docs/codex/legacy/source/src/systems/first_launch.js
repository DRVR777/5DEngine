// First-launch overlay — shows game mode select 500ms after startup.
// Skips if the player has already chosen a mode (_firstLaunch = false).
// BUG FIX iter 418: pointer must be explicitly released before finishComputerEntry
// or the overlay appears but is unclickable (lock stays active).
export function mountFirstLaunch({ getFirstLaunch, finishComputerEntry, getApps, getEl }) {
  const _getEl = getEl || (id => document.getElementById(id));
  setTimeout(() => {
    if (!getFirstLaunch()) return;
    if (typeof document !== "undefined" && document.pointerLockElement) {
      document.exitPointerLock();
    }
    finishComputerEntry();
    const apps    = getApps();
    const homeEl  = _getEl("appHome");
    const titleEl = _getEl("appTitle");
    const bodyEl  = _getEl("appBody");
    const winEl   = _getEl("appWindow");
    if (homeEl)  homeEl.style.display  = "none";
    if (titleEl) titleEl.textContent   = apps.gamemodes.title;
    if (bodyEl)  bodyEl.innerHTML      = apps.gamemodes.body();
    if (winEl)   winEl.classList.add("open");
  }, 500);
}
