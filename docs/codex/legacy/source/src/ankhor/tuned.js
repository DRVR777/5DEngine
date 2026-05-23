/** tuned() — look up a value from a tuning Thinga by name; fall back if missing.
 *  Used by every mesh factory and any facet handler that needs to read tuning. */
export function tuned(registry, thingaName, key, fallback) {
  if (!registry?.byKind) return fallback;
  for (const t of registry.byKind("tuning")) {
    if (t.name !== thingaName) continue;
    const fd = registry.facetData(t.id, "tuning");
    if (fd && key in fd) return fd[key];
  }
  return fallback;
}
