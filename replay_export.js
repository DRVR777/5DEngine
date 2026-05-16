// replay_export.js — serialize/deserialize ride_along buffers.
// Wraps a ride_along buffer (iter 79) into a portable bundle that can
// be written to disk, shared, and later re-played. Includes:
//   - Delta-encoded frames (pos/look diff against previous frame) to
//     shrink file size for long replays
//   - Header with {version, sessionId, hostId, fps, capturedAt, totalFrames}
//   - Optional gzip (Node) via zlib if requested
//   - Roundtrip: replay.import(bundle) → reconstructs full frames
//
// Format v1 (JSON):
//   { header: {...}, frames: [first_full_frame, delta1, delta2, ...] }
// Each delta: { seq, dts:Δms, dPos:{du,dv,dy}, dLook:{dyaw,dpitch}, vel?, action? }
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTAReplayExport = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const FORMAT_VERSION = 1;
  const _EPS = 1e-6;
  function _round(n, d) { const k = Math.pow(10, d != null ? d : 4); return Math.round(n * k) / k; }

  // Serialize a ride_along buffer snapshot → portable bundle.
  // bufferOrSnapshot can be either a buffer (with snapshot()) or an array of frames.
  function exportBundle(bufferOrFrames, opts) {
    opts = opts || {};
    const frames = Array.isArray(bufferOrFrames)
      ? bufferOrFrames
      : (typeof bufferOrFrames.snapshot === "function" ? bufferOrFrames.snapshot() : []);
    if (frames.length === 0) {
      return {
        ok: false, reason: "empty_buffer",
        bundle: { header: _header(opts, 0, 0), frames: [] },
      };
    }
    const first = _normalizeFrame(frames[0]);
    const out = [first];
    let prev = first;
    for (let i = 1; i < frames.length; i++) {
      const cur = _normalizeFrame(frames[i]);
      out.push(_delta(prev, cur));
      prev = cur;
    }
    const bundle = {
      header: _header(opts, frames.length, frames[frames.length - 1].seq - frames[0].seq),
      frames: out,
    };
    return { ok: true, bundle, originalCount: frames.length };
  }

  function _normalizeFrame(f) {
    return {
      seq: f.seq, ts: f.ts,
      pos: { u: _round(f.pos.u), v: _round(f.pos.v), y: _round(f.pos.y || 0) },
      look: { yaw: _round(f.look.yaw || 0), pitch: _round(f.look.pitch || 0) },
      vel: f.vel ? { u: _round(f.vel.u || 0), v: _round(f.vel.v || 0), y: _round(f.vel.y || 0) } : null,
      action: f.action || null,
    };
  }

  function _delta(prev, cur) {
    const d = {
      seq: cur.seq,
      dts: cur.ts - prev.ts,
      dPos: {
        du: _round(cur.pos.u - prev.pos.u),
        dv: _round(cur.pos.v - prev.pos.v),
        dy: _round((cur.pos.y || 0) - (prev.pos.y || 0)),
      },
      dLook: {
        dyaw:   _round(cur.look.yaw - prev.look.yaw),
        dpitch: _round(cur.look.pitch - prev.look.pitch),
      },
    };
    if (cur.vel) d.vel = cur.vel;
    if (cur.action !== prev.action) d.action = cur.action;
    return d;
  }

  function _header(opts, total, seqSpan) {
    return {
      formatVersion: FORMAT_VERSION,
      sessionId: opts.sessionId || null,
      hostId: opts.hostId || null,
      fps: opts.fps || 60,
      capturedAt: opts.capturedAt || Date.now(),
      totalFrames: total,
      seqSpan,
      meta: opts.meta || {},
    };
  }

  // Reconstruct full frames from a bundle. Returns {ok, frames, header}.
  function importBundle(bundle) {
    if (!bundle || !bundle.header || !Array.isArray(bundle.frames)) {
      return { ok: false, reason: "bad_bundle" };
    }
    if (bundle.header.formatVersion !== FORMAT_VERSION) {
      return { ok: false, reason: "format_mismatch", version: bundle.header.formatVersion };
    }
    if (bundle.frames.length === 0) return { ok: true, header: bundle.header, frames: [] };
    const first = bundle.frames[0];
    if (!first.pos || !first.look) return { ok: false, reason: "first_not_full" };
    const out = [first];
    let prev = first;
    for (let i = 1; i < bundle.frames.length; i++) {
      const d = bundle.frames[i];
      const cur = {
        seq: d.seq,
        ts: prev.ts + (d.dts || 0),
        pos: {
          u: prev.pos.u + (d.dPos ? d.dPos.du : 0),
          v: prev.pos.v + (d.dPos ? d.dPos.dv : 0),
          y: (prev.pos.y || 0) + (d.dPos ? d.dPos.dy : 0),
        },
        look: {
          yaw:   prev.look.yaw   + (d.dLook ? d.dLook.dyaw : 0),
          pitch: prev.look.pitch + (d.dLook ? d.dLook.dpitch : 0),
        },
        vel: d.vel || prev.vel || null,
        action: d.action !== undefined ? d.action : prev.action,
      };
      out.push(cur);
      prev = cur;
    }
    return { ok: true, header: bundle.header, frames: out };
  }

  // Convert bundle ↔ JSON string
  function toJSON(bundle) { return JSON.stringify(bundle); }
  function fromJSON(s) {
    try { return JSON.parse(s); } catch (e) { return null; }
  }

  // Optional gzip in Node — caller can opt in
  function toGzip(bundle) {
    try {
      const zlib = require("zlib");
      return zlib.gzipSync(Buffer.from(JSON.stringify(bundle)));
    } catch (e) {
      throw new Error("gzip requires Node zlib");
    }
  }
  function fromGzip(buf) {
    try {
      const zlib = require("zlib");
      const json = zlib.gunzipSync(buf).toString("utf8");
      return JSON.parse(json);
    } catch (e) {
      return null;
    }
  }

  // Stats helper
  function describe(bundle) {
    if (!bundle || !bundle.header) return null;
    return {
      formatVersion: bundle.header.formatVersion,
      sessionId: bundle.header.sessionId,
      hostId: bundle.header.hostId,
      totalFrames: bundle.header.totalFrames,
      fps: bundle.header.fps,
      durationMs: bundle.header.totalFrames * (1000 / bundle.header.fps),
      bytesJSON: JSON.stringify(bundle).length,
    };
  }

  return {
    FORMAT_VERSION,
    exportBundle,
    importBundle,
    toJSON, fromJSON,
    toGzip, fromGzip,
    describe,
  };
});
