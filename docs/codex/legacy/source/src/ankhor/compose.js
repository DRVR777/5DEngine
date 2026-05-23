/** Recursive Thinga loader. Walks {ref} children from a root id, fetching
 *  each data/<id>.json once. Returns the flat depth-first load order. */
export async function composeFromRoot(rootId, dataDir) {
  const cache = new Map(), order = [];
  async function visit(id) {
    if (cache.has(id)) return;
    const thinga = await loadJson(`${dataDir}${id}.json`);
    if (!thinga) { console.warn(`[ankhor] missing Thinga ${id}`); return; }
    cache.set(id, thinga); order.push(thinga);
    for (const child of thinga.children || []) {
      if (child && child.ref) await visit(child.ref);
    }
  }
  await visit(rootId);
  return order;
}

/** Convert a Thinga's facets[] into a name→data object for ergonomic access. */
export function facetMap(thinga) {
  const out = {};
  for (const f of thinga.facets || []) out[f.name] = f.data;
  return out;
}

async function loadJson(url) {
  try { const r = await fetch(url); if (!r.ok) return null; return await r.json(); }
  catch (e) { console.warn(`[ankhor] fetch ${url}:`, e); return null; }
}
