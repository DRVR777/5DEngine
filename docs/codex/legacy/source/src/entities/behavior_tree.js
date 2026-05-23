// behavior_tree.js — 5DEngine AI behavior tree
// Lightweight BT engine: Sequence, Selector, Decorator nodes + leaf actions.
// Enemies can have individual behavior trees updated each tick.
//
// API (window.BehaviorTree):
//   Node types: Sequence, Selector, Invert, Repeat(n), Cooldown(s), Action(fn)
//   BehaviorTree.run(node, context)  — runs root node; returns "success"|"failure"|"running"
//   BehaviorTree.makeEnemyTree(opts) — builds a default patrol→chase→attack tree
//
// Status constants: SUCCESS, FAILURE, RUNNING

(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.BehaviorTree = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const SUCCESS = "success";
  const FAILURE = "failure";
  const RUNNING  = "running";

  // ---- Node constructors ----

  function Sequence(...children) {
    return { type: "sequence", children };
  }
  function Selector(...children) {
    return { type: "selector", children };
  }
  function Invert(child) {
    return { type: "invert", child };
  }
  function Repeat(times, child) {
    return { type: "repeat", times, child, _count: 0 };
  }
  function Cooldown(seconds, child) {
    return { type: "cooldown", seconds, child, _lastRun: -Infinity };
  }
  function Action(fn) {
    return { type: "action", fn };
  }
  function Condition(fn) {
    return { type: "condition", fn };
  }

  // ---- Runner ----

  function run(node, ctx) {
    switch (node.type) {
      case "sequence": {
        for (const child of node.children) {
          const r = run(child, ctx);
          if (r !== SUCCESS) return r;
        }
        return SUCCESS;
      }
      case "selector": {
        for (const child of node.children) {
          const r = run(child, ctx);
          if (r !== FAILURE) return r;
        }
        return FAILURE;
      }
      case "invert": {
        const r = run(node.child, ctx);
        return r === SUCCESS ? FAILURE : r === FAILURE ? SUCCESS : RUNNING;
      }
      case "repeat": {
        while (node._count < node.times) {
          const r = run(node.child, ctx);
          if (r === FAILURE) { node._count = 0; return FAILURE; }
          if (r === RUNNING) return RUNNING;
          node._count++;
        }
        node._count = 0;
        return SUCCESS;
      }
      case "cooldown": {
        const now = (ctx && ctx.now) || (Date.now() / 1000);
        if (now - node._lastRun < node.seconds) return FAILURE;
        const r = run(node.child, ctx);
        if (r === SUCCESS) node._lastRun = now;
        return r;
      }
      case "action":    return node.fn(ctx) || SUCCESS;
      case "condition": return node.fn(ctx) ? SUCCESS : FAILURE;
      default:          return FAILURE;
    }
  }

  // ---- Default enemy tree ----
  // ctx expected: { enemy, hero, dt, now, world, distToHero, canSeeHero,
  //                 onAttack, onPatrol, onChase, onIdle }

  function makeEnemyTree(opts = {}) {
    const {
      sightRange  = 18,
      attackRange = 2.0,
      attackCD    = 1.2,
      loseRange   = 28,
    } = opts;

    return Selector(
      // 1. Dead — do nothing
      Condition(ctx => ctx.enemy.dead),

      // 2. In attack range → attack
      Sequence(
        Condition(ctx => ctx.distToHero <= attackRange && ctx.canSeeHero),
        Cooldown(attackCD, Action(ctx => { if (ctx.onAttack) ctx.onAttack(ctx); return SUCCESS; }))
      ),

      // 3. Can see hero within sight range → chase
      Sequence(
        Condition(ctx => ctx.canSeeHero && ctx.distToHero <= sightRange),
        Action(ctx => { if (ctx.onChase) ctx.onChase(ctx); return RUNNING; })
      ),

      // 4. Heard hero recently (lost sight but still engaged) → keep chasing toward last pos
      Sequence(
        Condition(ctx => (ctx.now - (ctx.enemy._lastSightT || -999)) < 4),
        Action(ctx => { if (ctx.onChase) ctx.onChase(ctx, ctx.enemy._lastHeroPos); return RUNNING; })
      ),

      // 5. Patrol
      Action(ctx => { if (ctx.onPatrol) ctx.onPatrol(ctx); return RUNNING; })
    );
  }

  // ---- Patrol helper: walk a waypoint list ----
  function makePatrolTree(waypoints) {
    let wpIdx = 0;
    return Action(ctx => {
      const wp = waypoints[wpIdx % waypoints.length];
      const dx = wp.u - ctx.enemy.u;
      const dz = wp.v - ctx.enemy.v;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.4) { wpIdx++; return SUCCESS; }
      const spd = ctx.enemy.moveSpeed || 2;
      ctx.enemy.u += (dx / dist) * spd * ctx.dt;
      ctx.enemy.v += (dz / dist) * spd * ctx.dt;
      return RUNNING;
    });
  }

  return { SUCCESS, FAILURE, RUNNING, Sequence, Selector, Invert, Repeat, Cooldown, Action, Condition, run, makeEnemyTree, makePatrolTree };
});
