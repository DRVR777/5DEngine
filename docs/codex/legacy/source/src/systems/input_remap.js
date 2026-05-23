// input_remap.js — key/controller bindings with conflict detection.
// Actions ("walk_forward", "jump", "fire") map to a list of acceptable
// bindings, each binding {device, key, modifiers?}. Multiple bindings
// per action are allowed (eg. WASD + arrow keys). The lookup table
// goes the other way: (device, key, modifiers) → set of actions.
//
// Conflict detection finds bindings that fire >1 action in the same
// "context" (eg. both "fire" and "honk" on left-click in "vehicle"
// context). Contexts gate which actions are even considered live.
//
// Persistable: toJSON / fromJSON round-trips losslessly.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTAInputRemap = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const DEVICES = ["keyboard", "mouse", "gamepad"];

  function _bindingKey(b) {
    const mods = (b.modifiers || []).slice().sort().join("+");
    return [b.device, b.key, mods].join("::");
  }

  function createMap(opts) {
    opts = opts || {};
    // action → { contexts:Set<string>, bindings:[{device,key,modifiers?}] }
    const actions = new Map();
    const events = [];
    let activeContext = opts.defaultContext || "default";

    function _log(kind, detail) {
      events.push({ kind, detail, ts: Date.now() });
      if (events.length > 500) events.shift();
    }

    function defineAction(name, opts2) {
      opts2 = opts2 || {};
      if (actions.has(name)) return { ok: false, reason: "duplicate" };
      actions.set(name, {
        name,
        contexts: new Set(opts2.contexts || ["default"]),
        bindings: [],
      });
      _log("defineAction", { name });
      return { ok: true };
    }

    function listActions() { return Array.from(actions.keys()); }
    function getAction(name) { return actions.get(name) || null; }

    function bind(action, binding) {
      const a = actions.get(action);
      if (!a) return { ok: false, reason: "unknown_action" };
      if (!binding || !binding.device || !binding.key) {
        return { ok: false, reason: "bad_binding" };
      }
      if (!DEVICES.includes(binding.device)) {
        return { ok: false, reason: "bad_device" };
      }
      const key = _bindingKey(binding);
      if (a.bindings.find(b => _bindingKey(b) === key)) {
        return { ok: false, reason: "already_bound" };
      }
      const stored = {
        device: binding.device, key: binding.key,
        modifiers: (binding.modifiers || []).slice().sort(),
      };
      a.bindings.push(stored);
      _log("bind", { action, binding: stored });
      return { ok: true, binding: stored };
    }

    function unbind(action, binding) {
      const a = actions.get(action);
      if (!a) return { ok: false, reason: "unknown_action" };
      const key = _bindingKey(binding);
      const before = a.bindings.length;
      a.bindings = a.bindings.filter(b => _bindingKey(b) !== key);
      if (a.bindings.length === before) return { ok: false, reason: "not_bound" };
      _log("unbind", { action, binding });
      return { ok: true };
    }

    function clearBindings(action) {
      const a = actions.get(action);
      if (!a) return { ok: false };
      a.bindings = [];
      _log("clear", { action });
      return { ok: true };
    }

    // Find all conflicts: bindings that map to >1 action in the same
    // context. Returns array of {device, key, modifiers, context, actions}.
    function detectConflicts() {
      const buckets = new Map();   // ctx::bindingKey → [action,...]
      for (const a of actions.values()) {
        for (const b of a.bindings) {
          for (const ctx of a.contexts) {
            const k = ctx + "||" + _bindingKey(b);
            if (!buckets.has(k)) buckets.set(k, { binding: b, context: ctx, actions: [] });
            buckets.get(k).actions.push(a.name);
          }
        }
      }
      const conflicts = [];
      for (const entry of buckets.values()) {
        if (entry.actions.length > 1) conflicts.push(entry);
      }
      return conflicts;
    }

    function setContext(ctx) {
      if (typeof ctx !== "string" || !ctx) return { ok: false };
      const prev = activeContext;
      activeContext = ctx;
      _log("setContext", { prev, ctx });
      return { ok: true, prev };
    }
    function getContext() { return activeContext; }

    // Resolve an input event {device, key, modifiers?} → list of actions
    // (filtered by current context).
    function resolve(input) {
      if (!input || !input.device || !input.key) return [];
      const k = _bindingKey(input);
      const matches = [];
      for (const a of actions.values()) {
        if (!a.contexts.has(activeContext) && !a.contexts.has("global")) continue;
        for (const b of a.bindings) {
          if (_bindingKey(b) === k) { matches.push(a.name); break; }
        }
      }
      return matches;
    }

    // What binds this action right now?
    function bindingsFor(action) {
      const a = actions.get(action);
      return a ? a.bindings.slice() : [];
    }

    function toJSON() {
      const out = { activeContext, actions: {} };
      for (const a of actions.values()) {
        out.actions[a.name] = {
          contexts: Array.from(a.contexts),
          bindings: a.bindings.slice(),
        };
      }
      return out;
    }

    function fromJSON(obj) {
      if (!obj || typeof obj !== "object") return { ok: false };
      actions.clear();
      activeContext = obj.activeContext || "default";
      for (const [name, spec] of Object.entries(obj.actions || {})) {
        actions.set(name, {
          name,
          contexts: new Set(spec.contexts || ["default"]),
          bindings: (spec.bindings || []).slice(),
        });
      }
      _log("fromJSON", { actions: actions.size });
      return { ok: true, loaded: actions.size };
    }

    function recentEvents(n) { return events.slice(-(n || 50)); }

    return {
      DEVICES,
      defineAction, listActions, getAction,
      bind, unbind, clearBindings,
      detectConflicts,
      setContext, getContext,
      resolve, bindingsFor,
      toJSON, fromJSON, recentEvents,
    };
  }

  // Default GTA-style bindings as a preset
  function gtaPreset() {
    const m = createMap();
    m.defineAction("walk_forward",  { contexts: ["foot"] });
    m.defineAction("walk_back",     { contexts: ["foot"] });
    m.defineAction("walk_left",     { contexts: ["foot"] });
    m.defineAction("walk_right",    { contexts: ["foot"] });
    m.defineAction("sprint",        { contexts: ["foot"] });
    m.defineAction("jump",          { contexts: ["foot"] });
    m.defineAction("fire",          { contexts: ["foot", "vehicle"] });
    m.defineAction("enter_exit",    { contexts: ["foot", "vehicle"] });
    m.defineAction("accelerate",    { contexts: ["vehicle"] });
    m.defineAction("brake",         { contexts: ["vehicle"] });
    m.defineAction("steer_left",    { contexts: ["vehicle"] });
    m.defineAction("steer_right",   { contexts: ["vehicle"] });
    m.defineAction("inventory",     { contexts: ["global"] });
    m.defineAction("photo_mode",    { contexts: ["global"] });

    m.bind("walk_forward",  { device: "keyboard", key: "w" });
    m.bind("walk_back",     { device: "keyboard", key: "s" });
    m.bind("walk_left",     { device: "keyboard", key: "a" });
    m.bind("walk_right",    { device: "keyboard", key: "d" });
    m.bind("sprint",        { device: "keyboard", key: "shift" });
    m.bind("jump",          { device: "keyboard", key: "space" });
    m.bind("fire",          { device: "mouse",    key: "left" });
    m.bind("enter_exit",    { device: "keyboard", key: "e" });
    m.bind("accelerate",    { device: "keyboard", key: "w" });
    m.bind("brake",         { device: "keyboard", key: "s" });
    m.bind("steer_left",    { device: "keyboard", key: "a" });
    m.bind("steer_right",   { device: "keyboard", key: "d" });
    m.bind("inventory",     { device: "keyboard", key: "i" });
    m.bind("photo_mode",    { device: "keyboard", key: "p" });
    return m;
  }

  return {
    DEVICES,
    createMap,
    gtaPreset,
  };
});
