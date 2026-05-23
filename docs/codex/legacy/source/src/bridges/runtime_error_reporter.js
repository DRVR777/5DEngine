// Extracted from index.html runtime error reporter.
// Behavior-preservation phase: keep API URL, event types, wave annotation, and fire-and-forget reporting.

export function mountRuntimeErrorReporter({
  windowRef = window,
  fetchFn = fetch,
  nowIso = () => new Date().toISOString(),
  errorApi = "http://localhost:3001/api/errors",
} = {}) {
  let waveHint = 0;
  windowRef._5DErrorWave = function(w) { waveHint = w; };

  function reportError(entry) {
    try {
      fetchFn(errorApi, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...entry, wave: waveHint, timestamp: nowIso() }),
      }).catch(() => {});
    } catch {}
  }

  windowRef.addEventListener("error", function(e) {
    reportError({ type: "uncaught", message: e.message, filename: e.filename, lineno: e.lineno, stack: e.error?.stack });
  });
  windowRef.addEventListener("unhandledrejection", function(e) {
    reportError({ type: "unhandledrejection", message: String(e.reason?.message || e.reason || "") });
  });

  return { reportError, getWaveHint: () => waveHint };
}
