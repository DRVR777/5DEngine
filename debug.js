// debug.js — packet replay + network logger + assert helpers.
// Wraps the Net hub so all envelopes are captured for replay/inspection.
// Used for: bug repros, regression tests, time-travel debugging.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTADebug = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Capture envelope stream into a serializable record
  function createRecorder(opts) {
    opts = opts || {};
    const events = [];
    const startedAt = Date.now();
    let recording = true;

    function record(direction, channel, env) {
      if (!recording) return;
      events.push({
        t: Date.now() - startedAt,
        direction,         // "in" | "out"
        channel,           // arbitrary tag (clientId, roomId, etc)
        env,               // CWP envelope (assumed JSON-serializable)
      });
      if (opts.maxEvents && events.length > opts.maxEvents) events.shift();
    }
    function pause() { recording = false; }
    function resume() { recording = true; }
    function clear() { events.length = 0; }
    function snapshot() {
      return {
        version: "5DEngine.replay/1",
        startedAt,
        capturedAt: Date.now(),
        events: events.slice(),
      };
    }

    return { record, pause, resume, clear, snapshot, events };
  }

  // Replay a captured stream: invokes a sink fn for each event in order.
  // Optionally honor original timing via setTimeout, or fast-forward.
  function replay(snap, sink, opts) {
    opts = opts || {};
    if (!snap || !snap.events) return { ok: false, reason: "no_events" };
    const speed = opts.speed != null ? opts.speed : 0; // 0 = no delay
    let i = 0;
    let stopped = false;
    function step() {
      if (stopped || i >= snap.events.length) return;
      const ev = snap.events[i++];
      try { sink(ev); } catch (e) { /* swallow */ }
      if (i < snap.events.length && speed > 0) {
        const next = snap.events[i];
        const wait = Math.max(0, (next.t - ev.t) / speed);
        setTimeout(step, wait);
      } else {
        // Fast-forward: synchronously chain
        while (!stopped && i < snap.events.length) {
          const e2 = snap.events[i++];
          try { sink(e2); } catch (e) {}
        }
      }
    }
    step();
    return {
      ok: true,
      stop: () => { stopped = true; },
      total: snap.events.length,
    };
  }

  // Wrap a Net hub so all sends + broadcasts are recorded
  function instrumentHub(hub, recorder) {
    if (!hub || !recorder) return null;
    const origBroadcast = hub.broadcast.bind(hub);
    hub.broadcast = function (roomId, env, exceptClientId) {
      recorder.record("out", `room:${roomId}`, env);
      return origBroadcast(roomId, env, exceptClientId);
    };
    return hub;
  }

  // Wrap a client-side handleEnvelope to record incoming
  function instrumentClient(client, recorder, channel) {
    if (!client || !recorder) return null;
    const origHandle = client.handleEnvelope.bind(client);
    client.handleEnvelope = function (env) {
      recorder.record("in", channel || "client", env);
      return origHandle(env);
    };
    return client;
  }

  // Filter events: by direction, type, channel, or vclock cmp
  function filter(events, pred) {
    return events.filter(pred);
  }

  // Stats: events/sec by type, total bytes (estimated as JSON length)
  function stats(events) {
    const byType = {};
    let totalBytes = 0;
    for (const e of events) {
      const t = e.env && e.env.type ? e.env.type : "unknown";
      byType[t] = (byType[t] || 0) + 1;
      try { totalBytes += JSON.stringify(e.env).length; } catch {}
    }
    const span = events.length > 0 ? (events[events.length - 1].t - events[0].t) : 0;
    return {
      total: events.length,
      byType,
      totalBytes,
      durationMs: span,
      eventsPerSec: span > 0 ? (events.length / (span / 1000)) : 0,
    };
  }

  // Assertions for tests
  function assertContainsType(events, type, count) {
    const matches = events.filter(e => e.env && e.env.type === type);
    if (count != null && matches.length !== count) {
      throw new Error(`expected ${count} ${type} events, got ${matches.length}`);
    }
    if (count == null && matches.length === 0) {
      throw new Error(`expected at least 1 ${type} event, got 0`);
    }
    return matches;
  }

  function assertOrdered(events, type1, type2) {
    const i1 = events.findIndex(e => e.env && e.env.type === type1);
    const i2 = events.findIndex(e => e.env && e.env.type === type2);
    if (i1 === -1 || i2 === -1 || i1 >= i2) {
      throw new Error(`expected ${type1} before ${type2} (i1=${i1}, i2=${i2})`);
    }
  }

  return {
    createRecorder, replay,
    instrumentHub, instrumentClient,
    filter, stats,
    assertContainsType, assertOrdered,
  };
});
