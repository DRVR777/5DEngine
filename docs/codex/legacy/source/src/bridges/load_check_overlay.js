// Extracted from index.html load-check/git overlay.
// Behavior-preservation phase: keep API URLs, button behavior, timers, and toast strings.

export function mountLoadCheckOverlay({
  documentRef = document,
  windowRef = window,
  locationRef = location,
  fetchFn = fetch,
  confirmFn = confirm,
  actions,
  gitApi = "http://localhost:3001/api/git",
}) {
  const overlay = documentRef.getElementById("loadCheckOverlay");
  const pullBtn = documentRef.getElementById("pullWorkingBtn");

  function hideOverlay() {
    if (overlay) overlay.style.display = "none";
  }

  function showLoadCheck() {
    if (!overlay) return;
    overlay.style.display = "block";
    documentRef.getElementById("loadCheckYes").onclick = async function() {
      hideOverlay();
      try {
        const r = await fetchFn(gitApi + "/verify", { method: "POST" });
        const d = await r.json();
        if (d.ok) actions.showToast("Marked as working build ✓ (" + d.sha + ")", "success", 3000);
        else actions.showToast("Could not tag: " + (d.error || "?"), "danger", 3000);
      } catch {
        actions.showToast("Server not running — tag skipped", "danger", 2500);
      }
    };
    documentRef.getElementById("loadCheckNo").onclick = hideOverlay;
  }

  async function pullWorkingVersion() {
    if (!confirmFn("Pull last verified working build? Page will reload.")) return;
    actions.showToast("Fetching working build…", "info", 5000);
    try {
      const r = await fetchFn(gitApi + "/pull-working", { method: "POST" });
      const d = await r.json();
      if (d.ok) {
        actions.showToast("Switched to working build " + d.sha + " — reloading…", "success", 2000);
        actions.setTimeout(() => locationRef.reload(), 1800);
      } else {
        actions.showToast("Pull failed: " + (d.error || "?"), "danger", 4000);
      }
    } catch {
      actions.showToast("Server not running — cannot pull", "danger", 3000);
    }
  }

  if (pullBtn) {
    pullBtn.onclick = pullWorkingVersion;
    fetchFn(gitApi + "/status").then(r => r.json()).then(d => {
      pullBtn.style.display = "block";
      if (d.workingSha) pullBtn.title = "Pull last working build: " + d.workingSha;
    }).catch(() => {});
  }

  let loadCheckTimer = null;
  const loadCheckObserver = actions.setInterval(function() {
    if (windowRef._loadingDismissed) {
      actions.clearInterval(loadCheckObserver);
      if (loadCheckTimer) return;
      loadCheckTimer = actions.setTimeout(showLoadCheck, 4000);
    }
  }, 500);

  return {
    hideOverlay,
    showLoadCheck,
    pullWorkingVersion,
    loadCheckObserver,
    getLoadCheckTimer: () => loadCheckTimer,
  };
}
