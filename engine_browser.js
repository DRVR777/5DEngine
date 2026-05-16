// engine_browser.js — browser-friendly subset of WorldState.
// Mirrors multi_dim_engine_skeleton/world_state.js API surface used by the demo.
// Intentionally minimal: setPlayer, players Map, layer transitions stub.
(function (root) {
  "use strict";

  class LayerBoundary {
    constructor(targetLayerId, kind, params) {
      this.targetLayerId = targetLayerId;
      this.kind = kind;     // "rect" | "circle"
      this.params = params; // rect: {u0,v0,u1,v1}; circle: {cu,cv,r}
    }
    contains(u, v) {
      if (this.kind === "rect") {
        const { u0, v0, u1, v1 } = this.params;
        return u >= u0 && u <= u1 && v >= v0 && v <= v1;
      }
      if (this.kind === "circle") {
        const { cu, cv, r } = this.params;
        const du = u - cu, dv = v - cv;
        return du * du + dv * dv <= r * r;
      }
      return false;
    }
  }

  class WorldState {
    constructor(layerId) {
      this.layerId = layerId;
      this.players = new Map();
      this.transitions = []; // {pid, from, to, kind, t}
    }
    setPlayer(id, x, y, z, u, v) {
      this.players.set(id, { x, y, z, u, v, t: Date.now() });
    }
    // Test boundaries for a player. Returns the boundary the player is inside,
    // or null. Caller decides what to do with a transition.
    boundaryAt(u, v, boundaries) {
      for (const b of boundaries) if (b.contains(u, v)) return b;
      return null;
    }
    logTransition(pid, fromLayer, toLayer, kind) {
      this.transitions.push({ pid, from: fromLayer, to: toLayer, kind, t: Date.now() });
      this.layerId = toLayer;
    }
  }

  root.GTAEngine = { WorldState, LayerBoundary };
})(typeof self !== "undefined" ? self : this);
