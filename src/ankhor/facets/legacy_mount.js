/** legacy-mount facet — the BASE LAYER for hosting game.html's legacy
 *  mount* subsystems inside the Ankhor substrate.
 *
 *  Premise (per user 2026-05-23): "the game actually plays cuz of what
 *  happens in the game.html — nothing youve done is playable yet."
 *  Right. So instead of reimplementing 165 mount* subsystems as native
 *  facets, the substrate HOSTS the legacy modules unchanged. Each
 *  mount* call becomes one Thinga of kind `legacy-system` whose
 *  `legacy-mount` facet declares HOW to bind the legacy module's
 *  {get, set, actions} object to substrate state.
 *
 *  The legacy modules' uniform shape is:
 *      export function mountX({ get, set, actions }) { return { tick }; }
 *  This handler synthesizes the {get, set, actions} object from the
 *  spec's `bindings`, calls the export, captures the returned `tick`,
 *  and invokes it each frame with the args declared in `tick_args`.
 *
 *  As a native facet replacement ships for a given mount, swap the
 *  legacy-system Thinga for native kinds/facets and delete this row.
 *  Authority-flip per CLAUDE.md.
 *
 *  Spec shape (the facet's data):
 *    {
 *      module_url:   "/src/systems/hero_regen_tick.js"  // relative to substrate page
 *      export:       "mountHeroRegenTick"               // named export to call
 *      tick_args:    [ "@dt", { "nowSec": "@nowSec" } ] // resolved each frame
 *      bindings:     { "get.heroHp": "$kind:hero[0]/health/hp", ... }
 *      enabled?:     true   // optional: defaults true
 *    }
 *
 *  Binding DSL (strings, resolved at bridge build time):
 *    $kind:<kind>[<i>]/<facet>/<field>   Nth Thing of kind, facet field
 *    $tuning:<name>/<facet>/<field>      tuning Thinga by name
 *    $thing:<id>/<facet>/<field>         exact id
 *    $const:<jsonValue>                  literal (parsed as JSON)
 *    $noop                               no-op function
 *    $log:<prefix>                       console.log with a prefix
 *    $global:<expr>                      limited window expressions
 *                                        (document, performance, Audio)
 *
 *  Tick-arg atoms (strings starting with @, resolved each tick):
 *    @dt        the dt the registry passed this frame
 *    @nowSec    Date.now() / 1000
 *    @perfMs    performance.now()
 *    @hero      first hero Thing id, or null
 *    @scene     render-context THREE.Scene
 *    @THREE     render-context THREE namespace
 *    Object/Array recurse — useful for `{ nowSec: "@nowSec" }` shape.
 *
 *  Priority 50: between core combat (45) and HUD (95). Adjust per
 *  spec by setting `priority_override` on the facet data if needed
 *  for ordering — not implemented yet; uniform 50 for now.
 *
 *  Data: { _import_promise?, _ready?, _tick?, _bridge?, _failed? } */
const LEGACY_NS = "[legacy-mount]";

export default {
  priority: 50,
  init(thing, data, registry) {
    if (!data || data._import_promise) return;
    if (typeof window === "undefined") return;
    if (typeof data.module_url !== "string" || !data.module_url) {
      console.warn(`${LEGACY_NS} ${thing.id}: missing module_url`); data._failed = true; return;
    }
    if (typeof data.export !== "string" || !data.export) {
      console.warn(`${LEGACY_NS} ${thing.id}: missing export name`); data._failed = true; return;
    }
    if (data.enabled === false) return;
    data._import_promise = importAndBind(thing, data, registry);
  },

  tick(thing, data, dt, registry) {
    if (!data || data._failed || !data._ready || !data._tick) return;
    try {
      const args = (data.tick_args || ["@dt"]).map((a) => resolveTickArg(a, dt, registry));
      data._tick(...args);
    } catch (e) {
      console.warn(`${LEGACY_NS} ${thing.id} tick error:`, e.message);
      data._failed = true;
    }
  },
};

async function importAndBind(thing, data, registry) {
  try {
    const mod = await import(/* @vite-ignore */ data.module_url);
    const mount = mod[data.export];
    if (typeof mount !== "function") {
      console.warn(`${LEGACY_NS} ${thing.id}: export "${data.export}" is not a function`);
      data._failed = true; return;
    }
    const bridge = buildBridge(data.bindings || {}, registry);
    // Constructor-level params: anything in spec.params is merged into the
    // bridge as a sibling of get/set/actions. Strings starting with $ are
    // resolved through parseSpec; everything else passes through literally.
    if (data.params && typeof data.params === "object") {
      for (const [pkey, pval] of Object.entries(data.params)) {
        bridge[pkey] = resolveAtBuildTime(pval, registry);
      }
    }
    data._bridge = bridge;
    const result = mount(bridge);
    const tickFn = result && typeof result.tick === "function" ? result.tick : null;
    if (!tickFn) {
      console.warn(`${LEGACY_NS} ${thing.id}: mount did not return { tick }`);
      data._failed = true; return;
    }
    data._tick = tickFn;
    data._ready = true;
    console.info(`${LEGACY_NS} ${thing.id} → ${data.export} bound`);
  } catch (e) {
    console.warn(`${LEGACY_NS} ${thing.id}: import failed —`, e.message);
    data._failed = true;
  }
}

/* ---------- bridge build (from "get.X" / "set.X" / "actions.X") ---------- */

function buildBridge(bindings, registry) {
  const get = {}, set = {}, actions = {};
  for (const [key, spec] of Object.entries(bindings)) {
    const dot = key.indexOf(".");
    if (dot < 0) continue;
    const cat = key.slice(0, dot);
    const name = key.slice(dot + 1);
    if (cat === "get")          get[name]     = makeGetter(spec, registry);
    else if (cat === "set")     set[name]     = makeSetter(spec, registry);
    else if (cat === "actions") actions[name] = makeAction (spec, registry);
  }
  // legacy modules expect these props to exist even when empty
  return { get, set, actions, THREE: getRenderContextField(registry, "THREE"),
           scene: getRenderContextField(registry, "scene"),
           camera: getRenderContextField(registry, "camera") };
}

function makeGetter(spec, registry) {
  const noop = () => undefined;
  const resolver = parseSpec(spec, registry);
  if (!resolver) return noop;
  if (resolver.kind === "const")  return () => resolver.value;
  if (resolver.kind === "log")    return () => undefined;
  if (resolver.kind === "noop")   return noop;
  if (resolver.kind === "global") return () => resolveGlobalExpr(resolver.expr);
  if (resolver.kind === "facet")  return () => {
    const fd = registry.facetData(resolver.id(), resolver.facet);
    return fd ? fd[resolver.field] : undefined;
  };
  if (resolver.kind === "input-key")        return () => readInputKey(registry, resolver.code);
  if (resolver.kind === "input-any")        return () => resolver.codes.some((c) => readInputKey(registry, c));
  if (resolver.kind === "input-mouse")      return () => readInputState(registry)?.mouseHeld === true;
  if (resolver.kind === "input-yaw")        return () => readInputState(registry)?.yaw || 0;
  if (resolver.kind === "input-pointerlock") return () => typeof document !== "undefined" && !!document.pointerLockElement;
  if (resolver.kind === "kind-pos")         return resolver.get;
  if (resolver.kind === "input-keys")       return () => readInputState(registry)?.keys || {};
  return noop;
}

function makeSetter(spec, registry) {
  const resolver = parseSpec(spec, registry);
  if (!resolver || resolver.kind === "noop" || resolver.kind === "const") return () => {};
  if (resolver.kind === "log") return (v) => console.log(`${resolver.prefix} ←`, v);
  if (resolver.kind === "facet") return (v) => {
    const id = resolver.id();
    if (!id) return;
    const fd = registry.facetData(id, resolver.facet);
    if (fd) fd[resolver.field] = v;
  };
  if (resolver.kind === "global") return () => {};
  return () => {};
}

function makeAction(spec, registry) {
  const resolver = parseSpec(spec, registry);
  if (!resolver) return () => {};
  if (resolver.kind === "noop") return () => {};
  if (resolver.kind === "log")  return (...args) => console.log(resolver.prefix, ...args);
  if (resolver.kind === "const" && typeof resolver.value === "function") return resolver.value;
  if (resolver.kind === "emit") return (...args) => {
    const filled = substituteArgs(resolver.template, args, registry);
    if (!filled || !filled.id || !filled.kind) {
      console.warn(`${LEGACY_NS} $emit: template missing id/kind after substitution`);
      return;
    }
    // make ids unique per call so repeated emits don't collide
    if (filled.id.includes("<seq>")) {
      filled.id = filled.id.replace(/<seq>/g, String((registry._emitSeq = (registry._emitSeq || 0) + 1)));
      if (filled.name && filled.name.includes("<seq>")) filled.name = filled.id;
    }
    try { registry.spawn(filled); }
    catch (e) { console.warn(`${LEGACY_NS} $emit spawn failed: ${e.message}`); }
  };
  if (resolver.kind === "write") return (v) => {
    const id = resolver.id();
    if (!id) return;
    const fd = registry.facetData(id, resolver.facet);
    if (fd) fd[resolver.field] = v;
  };
  if (resolver.kind === "add") return (delta) => {
    const id = resolver.id();
    if (!id) return;
    const fd = registry.facetData(id, resolver.facet);
    if (!fd) return;
    const prev = typeof fd[resolver.field] === "number" ? fd[resolver.field] : 0;
    fd[resolver.field] = prev + (typeof delta === "number" ? delta : 0);
  };
  if (resolver.kind === "facet") return (v) => {
    // makeSetter shape: legacy passes a single value to write
    const id = resolver.id();
    if (!id) return;
    const fd = registry.facetData(id, resolver.facet);
    if (fd) fd[resolver.field] = v;
  };
  if (resolver.kind === "write-pos") return resolver.write;
  return () => {};
}

/** Recursively substitute `$arg0`, `$arg1`, ... and other binding atoms
 *  inside a JSON template (used by $emit). Plain strings starting with
 *  $arg<N> are replaced by the Nth argument; other $-strings go through
 *  resolveAtBuildTime. */
function substituteArgs(node, args, registry) {
  if (Array.isArray(node)) return node.map((n) => substituteArgs(n, args, registry));
  if (node && typeof node === "object") {
    const out = {};
    for (const [k, v] of Object.entries(node)) out[k] = substituteArgs(v, args, registry);
    return out;
  }
  if (typeof node !== "string") return node;
  const argMatch = node.match(/^\$arg(\d+)$/);
  if (argMatch) {
    const idx = Number(argMatch[1]);
    return idx < args.length ? args[idx] : undefined;
  }
  if (node.startsWith("$")) return resolveAtBuildTime(node, registry);
  return node;
}

/** Resolve a spec value once, at bridge-build time (used for `params`).
 *  Strings starting with $ go through parseSpec then collapse to a value;
 *  others are returned as-is. */
function resolveAtBuildTime(value, registry) {
  if (typeof value !== "string" || !value.startsWith("$")) return value;
  const r = parseSpec(value, registry);
  if (!r) return null;
  if (r.kind === "const")  return r.value;
  if (r.kind === "noop")   return () => {};
  if (r.kind === "log")    return (...args) => console.log(r.prefix, ...args);
  if (r.kind === "global") return resolveGlobalExpr(r.expr);
  if (r.kind === "facet")  {
    const id = r.id(); if (!id) return null;
    const fd = registry.facetData(id, r.facet);
    return fd ? fd[r.field] : null;
  }
  if (r.kind === "input-key")        return readInputKey(registry, r.code);
  if (r.kind === "input-any")        return r.codes.some((c) => readInputKey(registry, c));
  if (r.kind === "input-mouse")      return readInputState(registry)?.mouseHeld === true;
  if (r.kind === "input-yaw")        return readInputState(registry)?.yaw || 0;
  if (r.kind === "input-pointerlock") return typeof document !== "undefined" && !!document.pointerLockElement;
  if (r.kind === "kind-pos")         return r.get();
  if (r.kind === "input-keys")       return readInputState(registry)?.keys || {};
  return null;
}

function readInputState(registry) {
  const inputs = registry.byKind("input");
  if (inputs.length === 0) return null;
  return registry.facetData(inputs[0].id, "input-state");
}

function readInputKey(registry, code) {
  const st = readInputState(registry);
  if (!st || !st.keys) return false;
  return st.keys[code] === true;
}

/* ---------- spec parser ---------- */

function parseSpec(spec, registry) {
  if (typeof spec !== "string") return null;
  if (spec === "$noop") return { kind: "noop" };
  if (spec === "$pointerHeld")   return { kind: "input-mouse" };
  if (spec === "$pointerLocked") return { kind: "input-pointerlock" };
  if (spec === "$inputYaw")      return { kind: "input-yaw" };
  if (spec === "$inputKeys")     return { kind: "input-keys" };
  if (spec.startsWith("$writePos:")) return parseWritePos(spec.slice(10), registry);
  if (spec.startsWith("$log:"))      return { kind: "log",      prefix: spec.slice(5) };
  if (spec.startsWith("$const:"))    return parseConst(spec.slice(7));
  if (spec.startsWith("$global:"))   return { kind: "global",   expr:    spec.slice(8) };
  if (spec.startsWith("$kind:"))     return parseKind  (spec.slice(6),  registry);
  if (spec.startsWith("$tuning:"))   return parseTuning(spec.slice(8),  registry);
  if (spec.startsWith("$thing:"))    return parseThing (spec.slice(7),  registry);
  if (spec.startsWith("$input:"))    return { kind: "input-key", code: spec.slice(7) };
  if (spec.startsWith("$inputAny:")) return { kind: "input-any", codes: spec.slice(10).split(",").map(s => s.trim()).filter(Boolean) };
  if (spec.startsWith("$emit:"))     return parseEmit(spec.slice(6));
  if (spec.startsWith("$write:"))    return parseWriteOrAdd(spec.slice(7), "write", registry);
  if (spec.startsWith("$add:"))      return parseWriteOrAdd(spec.slice(5),  "add",   registry);
  if (spec.startsWith("$kindPos:"))  return parseKindPos(spec.slice(9), registry);
  console.warn(`${LEGACY_NS} unknown binding spec: ${spec}`);
  return null;
}

function parseKindPos(rest, registry) {
  // <kind>[<i>]  — legacy modules expect {u, y, v}; substrate is {x, y, z}.
  const m = rest.match(/^([^\/\[]+)(?:\[(\d+)\])?$/);
  if (!m) { console.warn(`${LEGACY_NS} bad $kindPos spec: ${rest}`); return null; }
  const kindName = m[1], idx = m[2] ? Number(m[2]) : 0;
  return {
    kind: "kind-pos",
    get: () => {
      const list = registry.byKind(kindName);
      if (!list[idx]) return null;
      const pos = registry.facetData(list[idx].id, "position");
      if (!pos) return null;
      return { u: pos.x, y: pos.y, v: pos.z };
    },
  };
}

/** $writePos:<kind>[<i>] — action atom that writes a Thing's position,
 *  accepting the legacy 5-arg shape `(x, y, z, u, v)`. The substrate
 *  uses {x, y, z}; the legacy code's (x,y,z) and (u,v) refer to the
 *  SAME 2D place from different schemas. Most callers pass either
 *  3D world (x,z) OR 5D phase (u,v), not both. Prefer (u,v) when set,
 *  fall back to (x,z). y always passes through. */
function parseWritePos(rest, registry) {
  const m = rest.match(/^([^\/\[]+)(?:\[(\d+)\])?$/);
  if (!m) { console.warn(`${LEGACY_NS} bad $writePos spec: ${rest}`); return null; }
  const kindName = m[1], idx = m[2] ? Number(m[2]) : 0;
  return {
    kind: "write-pos",
    write: (x, y, z, u, v) => {
      const list = registry.byKind(kindName);
      if (!list[idx]) return;
      const pos = registry.facetData(list[idx].id, "position");
      if (!pos) return;
      const writeX = (typeof u === "number") ? u : x;
      const writeZ = (typeof v === "number") ? v : z;
      if (typeof writeX === "number") pos.x = writeX;
      if (typeof y      === "number") pos.y = y;
      if (typeof writeZ === "number") pos.z = writeZ;
    },
  };
}

function parseEmit(rest) {
  // rest is a JSON object template. Throws clear if it isn't.
  try { return { kind: "emit", template: JSON.parse(rest) }; }
  catch (e) { console.warn(`${LEGACY_NS} bad $emit JSON: ${e.message}`); return null; }
}

function parseWriteOrAdd(rest, kind, registry) {
  // <id>/<facet>/<field>   — same shape as $thing
  const parts = rest.split("/");
  if (parts.length < 3) { console.warn(`${LEGACY_NS} bad $${kind} spec: ${rest}`); return null; }
  const field = parts.pop();
  const facet = parts.pop();
  const id    = parts.join("/");
  return { kind, facet, field, id: () => id };
}

function parseConst(rest) {
  try { return { kind: "const", value: JSON.parse(rest) }; }
  catch { return { kind: "const", value: rest }; }
}

function parseKind(rest, registry) {
  // <kind>[<i>]/<facet>/<field>   or   <kind>/<facet>/<field>  (defaults i=0)
  const m = rest.match(/^([^\/\[]+)(?:\[(\d+)\])?\/([^\/]+)\/(.+)$/);
  if (!m) { console.warn(`${LEGACY_NS} bad $kind spec: ${rest}`); return null; }
  const kindName = m[1], idx = m[2] ? Number(m[2]) : 0, facet = m[3], field = m[4];
  return {
    kind: "facet", facet, field,
    id: () => { const list = registry.byKind(kindName); return list[idx] ? list[idx].id : null; },
  };
}

function parseTuning(rest, registry) {
  // <name>/<facet>/<field>
  const m = rest.match(/^([^\/]+)\/([^\/]+)\/(.+)$/);
  if (!m) { console.warn(`${LEGACY_NS} bad $tuning spec: ${rest}`); return null; }
  const tName = m[1], facet = m[2], field = m[3];
  return {
    kind: "facet", facet, field,
    id: () => { for (const t of registry.byKind("tuning")) if (t.name === tName) return t.id; return null; },
  };
}

function parseThing(rest, registry) {
  // <id>/<facet>/<field>  — id may contain slashes; split on first "/" after the kind/id-with-slashes is ambiguous. Use last 2 "/" segments as facet/field.
  const parts = rest.split("/");
  if (parts.length < 3) { console.warn(`${LEGACY_NS} bad $thing spec: ${rest}`); return null; }
  const field = parts.pop();
  const facet = parts.pop();
  const id    = parts.join("/");
  return {
    kind: "facet", facet, field,
    id: () => id,
  };
}

/* ---------- tick-arg resolver ---------- */

function resolveTickArg(spec, dt, registry) {
  if (Array.isArray(spec)) return spec.map((s) => resolveTickArg(s, dt, registry));
  if (spec && typeof spec === "object") {
    const out = {};
    for (const [k, v] of Object.entries(spec)) out[k] = resolveTickArg(v, dt, registry);
    return out;
  }
  if (typeof spec === "string" && spec.startsWith("$")) {
    return resolveAtBuildTime(spec, registry);  // re-resolve each tick for binding refs
  }
  if (typeof spec !== "string" || !spec.startsWith("@")) return spec;
  switch (spec) {
    case "@dt":     return dt;
    case "@nowSec": return Date.now() / 1000;
    case "@perfMs": return (typeof performance !== "undefined" ? performance.now() : Date.now());
    case "@hero":   { const h = registry.byKind("hero")[0]; return h ? h.id : null; }
    case "@scene":  return getRenderContextField(registry, "scene");
    case "@THREE":  return getRenderContextField(registry, "THREE");
    case "@camera": return getRenderContextField(registry, "camera");
    default:
      console.warn(`${LEGACY_NS} unknown tick-arg atom: ${spec}`);
      return null;
  }
}

/* ---------- globals + render context ---------- */

function getRenderContextField(registry, key) {
  const ctxThing = registry.byKind("render-context")[0];
  if (!ctxThing) return null;
  const ctx = registry.facetData(ctxThing.id, "render-context");
  return ctx ? ctx[key] : null;
}

const ALLOWED_GLOBALS = ["document", "window", "performance", "innerWidth", "innerHeight"];
function resolveGlobalExpr(expr) {
  if (typeof window === "undefined") return null;
  if (ALLOWED_GLOBALS.includes(expr)) return window[expr];
  // attribute access: "document.body", "document.getElementById"
  const parts = expr.split(".");
  if (!ALLOWED_GLOBALS.includes(parts[0])) {
    console.warn(`${LEGACY_NS} disallowed global expr: ${expr}`); return null;
  }
  let cur = window[parts[0]];
  for (let i = 1; i < parts.length; i++) {
    if (cur == null) return null;
    const next = cur[parts[i]];
    cur = (typeof next === "function") ? next.bind(cur) : next;
  }
  return cur;
}
