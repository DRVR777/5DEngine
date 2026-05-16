// trigger_zones.js — 5DEngine area triggers
// Axis-aligned box and sphere triggers that fire events when entities enter/exit.
//
// API (window.TriggerZones):
//   addBox(id, {minU,maxU,minV,maxV,minY,maxY}, callbacks, opts)
//   addSphere(id, {u,v,y}, radius, callbacks, opts)
//   remove(id)
//   tick(entities)     — call every frame with [{id, u, v, y}, ...]
//   getAll()           — returns array of zone descriptors
//   clear()            — remove all zones
//
// callbacks: { onEnter(entityId, zoneId), onExit(entityId, zoneId), onStay(entityId, zoneId, dt) }
// opts: { label, color, debug }   — debug shows a wire box in the scene (requires THREE+scene)
//
// Fires window CustomEvents: "zoneEnter" and "zoneExit" with detail {entityId, zoneId, zone}

(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.TriggerZones = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const _zones   = new Map();   // id → zone
  const _inside  = new Map();   // `${entityId}:${zoneId}` → true

  let _THREE = null;
  let _scene = null;

  function init(THREE, scene) { _THREE = THREE; _scene = scene; }

  function _debugMesh(zone) {
    if (!_THREE || !_scene) return null;
    let geo;
    if (zone.type === "box") {
      const w = zone.maxU - zone.minU;
      const h = (zone.maxY || 4) - (zone.minY || 0);
      const d = zone.maxV - zone.minV;
      geo = new _THREE.BoxGeometry(w, h, d);
    } else {
      geo = new _THREE.SphereGeometry(zone.radius, 12, 8);
    }
    const mat = new _THREE.MeshBasicMaterial({
      color: zone.opts.color || 0x00ffaa,
      wireframe: true,
      transparent: true,
      opacity: 0.35,
    });
    const mesh = new _THREE.Mesh(geo, mat);
    if (zone.type === "box") {
      mesh.position.set(
        (zone.minU + zone.maxU) / 2,
        ((zone.minY || 0) + (zone.maxY || 4)) / 2,
        (zone.minV + zone.maxV) / 2
      );
    } else {
      mesh.position.set(zone.u, zone.y || 0, zone.v);
    }
    _scene.add(mesh);
    return mesh;
  }

  function _inBox(zone, u, v, y) {
    return u >= zone.minU && u <= zone.maxU &&
           v >= zone.minV && v <= zone.maxV &&
           (y == null || (y >= (zone.minY || -Infinity) && y <= (zone.maxY || Infinity)));
  }

  function _inSphere(zone, u, v, y) {
    const dy = (y != null ? y - (zone.y || 0) : 0);
    const dist2 = (u - zone.u) ** 2 + (v - zone.v) ** 2 + dy * dy;
    return dist2 <= zone.radius * zone.radius;
  }

  function addBox(id, bounds, callbacks = {}, opts = {}) {
    if (_zones.has(id)) remove(id);
    const zone = { id, type: "box", callbacks, opts, ...bounds };
    if (opts.debug !== false) zone._mesh = _debugMesh(zone);
    _zones.set(id, zone);
    return id;
  }

  function addSphere(id, center, radius, callbacks = {}, opts = {}) {
    if (_zones.has(id)) remove(id);
    const zone = { id, type: "sphere", radius, callbacks, opts, ...center };
    if (opts.debug !== false) zone._mesh = _debugMesh(zone);
    _zones.set(id, zone);
    return id;
  }

  function remove(id) {
    const zone = _zones.get(id);
    if (!zone) return;
    if (zone._mesh && _scene) {
      _scene.remove(zone._mesh);
      zone._mesh.geometry.dispose();
      zone._mesh.material.dispose();
    }
    _zones.delete(id);
    for (const k of [..._inside.keys()]) { if (k.endsWith(`:${id}`)) _inside.delete(k); }
  }

  function clear() { for (const id of [..._zones.keys()]) remove(id); }

  function tick(entities, dt) {
    if (!entities || !entities.length) return;
    for (const [, zone] of _zones) {
      for (const ent of entities) {
        const key = `${ent.id}:${zone.id}`;
        const wasInside = _inside.has(key);
        const nowInside = zone.type === "box"
          ? _inBox(zone, ent.u, ent.v, ent.y)
          : _inSphere(zone, ent.u, ent.v, ent.y);

        if (nowInside && !wasInside) {
          _inside.set(key, true);
          if (zone.callbacks.onEnter) zone.callbacks.onEnter(ent.id, zone.id);
          window.dispatchEvent(new CustomEvent("zoneEnter", { detail: { entityId: ent.id, zoneId: zone.id, zone } }));
        } else if (!nowInside && wasInside) {
          _inside.delete(key);
          if (zone.callbacks.onExit) zone.callbacks.onExit(ent.id, zone.id);
          window.dispatchEvent(new CustomEvent("zoneExit",  { detail: { entityId: ent.id, zoneId: zone.id, zone } }));
        } else if (nowInside && wasInside && zone.callbacks.onStay) {
          zone.callbacks.onStay(ent.id, zone.id, dt);
        }
      }
    }
  }

  function getAll() {
    return [..._zones.values()].map(z => {
      const { _mesh, callbacks, ...rest } = z;
      return rest;
    });
  }

  function isInside(entityId, zoneId) { return _inside.has(`${entityId}:${zoneId}`); }

  return { init, addBox, addSphere, remove, clear, tick, getAll, isInside };
});
