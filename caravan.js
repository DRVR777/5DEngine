// caravan.js — NPC merchant trade caravan AI.
// A caravan = {id, routeId, guards[], cargo[], speed, position,
//              routeProgress, state, hostility}.
// Routes are sequences of waypoints; caravans patrol from one to the
// next. State machine: idle → travelling → at_waypoint → ambushed →
// fleeing → arrived → travelling.
//
// Ambushes trigger when a threat enters the danger radius. Caller-
// driven: caravan.threatNearby(pos, level) → may flip to ambushed
// state. Escort missions auto-emit "rescue_caravan" events for the
// mission_dsl to pick up.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTACaravan = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const STATES = ["idle", "travelling", "at_waypoint", "ambushed", "fleeing", "arrived", "destroyed"];

  function _dist(a, b) { return Math.hypot(a.u - b.u, a.v - b.v); }

  function createSystem(opts) {
    opts = opts || {};
    const config = Object.assign({
      defaultSpeed: 3.0,           // m/s
      arriveRadius: 2,
      waypointPauseMs: 5000,
      ambushDangerRadius: 30,
      fleeDistance: 50,
    }, opts.config || {});

    const routes = new Map();
    const caravans = new Map();
    const escortRequests = [];   // pending escort missions to emit
    let nextCaravanId = 1;
    const events = [];

    function _log(kind, detail) {
      events.push({ kind, detail, ts: Date.now() });
      if (events.length > 500) events.shift();
    }

    function defineRoute(opts2) {
      opts2 = opts2 || {};
      if (!opts2.id) return { ok: false, reason: "missing_id" };
      if (routes.has(opts2.id)) return { ok: false, reason: "duplicate" };
      if (!Array.isArray(opts2.waypoints) || opts2.waypoints.length < 2) {
        return { ok: false, reason: "needs_2_waypoints" };
      }
      routes.set(opts2.id, {
        id: opts2.id,
        waypoints: opts2.waypoints.slice(),
        loop: opts2.loop !== false,
      });
      _log("route", { id: opts2.id, wps: opts2.waypoints.length });
      return { ok: true };
    }

    function spawnCaravan(opts2) {
      opts2 = opts2 || {};
      const route = routes.get(opts2.routeId);
      if (!route) return { ok: false, reason: "no_route" };
      const id = "carv_" + (nextCaravanId++);
      const startWP = route.waypoints[0];
      const caravan = {
        id, routeId: opts2.routeId,
        position: { u: startWP.u, v: startWP.v, y: startWP.y || 0 },
        speed: opts2.speed || config.defaultSpeed,
        guards: opts2.guards || [],
        cargo: (opts2.cargo || []).slice(),
        hp: opts2.hp || 100,
        hostility: opts2.hostility || "neutral",
        currentWpIdx: 0,
        nextWpIdx: 1,
        state: "travelling",
        stateSince: Date.now(),
        ambushedBy: null,
      };
      caravans.set(id, caravan);
      _log("spawn", { id, routeId: opts2.routeId });
      return { ok: true, id, caravan };
    }

    function despawnCaravan(id) {
      if (!caravans.has(id)) return { ok: false };
      caravans.delete(id);
      _log("despawn", { id });
      return { ok: true };
    }

    function _advance(caravan, dt) {
      const route = routes.get(caravan.routeId);
      if (!route) return;
      const target = route.waypoints[caravan.nextWpIdx];
      if (!target) return;
      const du = target.u - caravan.position.u;
      const dv = target.v - caravan.position.v;
      const d = Math.hypot(du, dv);
      const step = caravan.speed * dt;
      if (d <= step + config.arriveRadius) {
        caravan.position.u = target.u;
        caravan.position.v = target.v;
        caravan.currentWpIdx = caravan.nextWpIdx;
        caravan.state = "at_waypoint";
        caravan.stateSince = caravan._tickNow || Date.now();
        const isLast = caravan.nextWpIdx >= route.waypoints.length - 1;
        if (isLast && !route.loop) {
          caravan.state = "arrived";
          _log("arrived", { id: caravan.id });
        } else {
          caravan.nextWpIdx = (caravan.nextWpIdx + 1) % route.waypoints.length;
          _log("waypoint", { id: caravan.id, wp: caravan.currentWpIdx });
        }
      } else {
        caravan.position.u += (du / d) * step;
        caravan.position.v += (dv / d) * step;
      }
    }

    function tick(dt, now) {
      now = now != null ? now : Date.now();
      for (const c of caravans.values()) {
        c._tickNow = now;
        if (c.stateSince > now) c.stateSince = now;   // clock injection auto-correct
        if (c.state === "destroyed" || c.state === "arrived") continue;
        if (c.state === "ambushed") {
          // Ambushed caravans don't move; they emit escort requests
          continue;
        }
        if (c.state === "at_waypoint") {
          if (now - c.stateSince >= config.waypointPauseMs) {
            c.state = "travelling";
            c.stateSince = now;
          }
          continue;
        }
        if (c.state === "fleeing") {
          // Move away from fleeFrom point
          if (c.fleeFrom) {
            const du = c.position.u - c.fleeFrom.u;
            const dv = c.position.v - c.fleeFrom.v;
            const d = Math.hypot(du, dv);
            if (d >= config.fleeDistance) {
              c.state = "travelling";
              c.stateSince = now;
              c.fleeFrom = null;
              continue;
            }
            const step = c.speed * 1.5 * dt;
            if (d > 0) {
              c.position.u += (du / d) * step;
              c.position.v += (dv / d) * step;
            } else {
              c.position.u += step;
            }
          }
          continue;
        }
        if (c.state === "travelling") {
          _advance(c, dt);
        }
      }
    }

    // Caller-driven threat sensor
    function threatNearby(caravanId, threatPos, threatLevel) {
      const c = caravans.get(caravanId);
      if (!c) return { ok: false, reason: "missing" };
      if (c.state === "destroyed" || c.state === "ambushed" || c.state === "fleeing") {
        return { ok: false, reason: "wrong_state" };
      }
      const d = _dist(c.position, threatPos);
      if (d > config.ambushDangerRadius) return { ok: false, reason: "out_of_range" };
      // Hostile or armed: ambushed (stationary); peaceful or weak guard: flee
      const guardStrength = (c.guards || []).reduce((s, g) => s + (g.strength || 1), 0);
      if (threatLevel > guardStrength) {
        c.state = "ambushed";
        c.ambushedBy = { pos: { u: threatPos.u, v: threatPos.v }, level: threatLevel };
        c.stateSince = Date.now();
        escortRequests.push({
          caravanId, ambushPos: c.position,
          threatLevel, ts: Date.now(),
        });
        _log("ambushed", { id: caravanId, threatLevel, guardStrength });
        return { ok: true, state: "ambushed", escortRequested: true };
      } else {
        c.state = "fleeing";
        c.fleeFrom = { u: threatPos.u, v: threatPos.v };
        c.stateSince = Date.now();
        _log("fleeing", { id: caravanId });
        return { ok: true, state: "fleeing" };
      }
    }

    // Apply damage to a caravan
    function applyDamage(id, damage) {
      const c = caravans.get(id);
      if (!c) return { ok: false };
      c.hp = Math.max(0, c.hp - damage);
      _log("damaged", { id, damage, hp: c.hp });
      if (c.hp <= 0) {
        c.state = "destroyed";
        _log("destroyed", { id, lostCargo: c.cargo.length });
        return { ok: true, destroyed: true, lostCargo: c.cargo };
      }
      return { ok: true, hp: c.hp };
    }

    // Player rescues caravan from ambush — clears state, returns reward
    function rescueCaravan(id) {
      const c = caravans.get(id);
      if (!c) return { ok: false, reason: "missing" };
      if (c.state !== "ambushed") return { ok: false, reason: "not_ambushed" };
      c.state = "travelling";
      c.ambushedBy = null;
      c.stateSince = Date.now();
      _log("rescued", { id });
      return {
        ok: true,
        reward: { ccy: "coin", amount: 50 * c.cargo.length },
      };
    }

    // Caller drains the escort-requests queue (mission spawner reads this)
    function drainEscortRequests() {
      const out = escortRequests.slice();
      escortRequests.length = 0;
      return out;
    }

    function getCaravan(id) { return caravans.get(id) || null; }
    function listCaravans(state) {
      const out = [];
      for (const c of caravans.values()) {
        if (!state || c.state === state) out.push(c);
      }
      return out;
    }
    function listRoutes() { return Array.from(routes.values()); }
    function recentEvents(n) { return events.slice(-(n || 50)); }

    return {
      STATES,
      defineRoute, spawnCaravan, despawnCaravan,
      tick, threatNearby, applyDamage, rescueCaravan,
      drainEscortRequests,
      getCaravan, listCaravans, listRoutes,
      recentEvents,
    };
  }

  return { STATES, createSystem };
});
