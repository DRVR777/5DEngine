// devices.js — generic device graph for in-world hardware.
//
// Every piece of in-game hardware (computer, monitor, speaker, radio,
// CD-drive, USB-port, antenna, walkie-talkie, ...) is a "Device" with a set
// of typed Ports. Ports are wired together by Wires; a wire only connects
// when its cable kind matches both port kinds.
//
// Packets flow along wires. A packet looks like `{ kind, payload, ts }`.
// Every interaction in the game's device layer reduces to "send packet from
// port A to port B over a wire of kind K".
//
// This module is pure data + small functions — no DOM, no THREE.js. Render
// the result with `wires.js` (3D mesh) or in a DWRLD OS app (HTML).
//
// Port kinds (informal vocabulary — keep additive):
//   "video"  — frame/screen data
//   "audio"  — sound buffer
//   "data"   — generic bytes (USB, CD content, network packet, etc.)
//   "power"  — wattage (future: brown-out, surge protection)
//   "rf"     — radio frequency channel (wireless, frequency must match)
//
// Direction: "in" | "out" | "io"
//
// A wire of kind K connects A.portX to B.portY only if:
//   - A.portX.kind === K  (or "io" with K)
//   - B.portY.kind === K
//   - A.portX.direction is compatible with the wire intent
//
// For RF, instead of a physical wire, you pair two `rf` ports by frequency
// + range — virtual wire (see `radioBroadcast`).
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Devices = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // ------------------------------------------------------------------
  // Constants & utilities
  // ------------------------------------------------------------------
  const PORT_KINDS = ["video", "audio", "data", "power", "rf"];
  const DIRECTIONS = ["in", "out", "io"];

  function _now() { return Date.now(); }
  function _id(prefix) { return prefix + "_" + Math.random().toString(36).slice(2, 9); }

  function _isCompatibleKind(a, b) {
    if (a === b) return true;
    return false;
  }

  // ------------------------------------------------------------------
  // Bus — the device graph
  // ------------------------------------------------------------------
  function createBus(opts) {
    opts = opts || {};
    const config = Object.assign({
      rfDefaultRange: 50,    // metres; two radios closer than this can pair
      maxPacketQueue: 256,   // per-port inbox cap (prevents runaway)
      logEvents: true,
    }, opts.config || {});

    const devices = new Map();     // id → device
    const wires   = new Map();     // wireId → wire
    const events  = [];

    function _log(kind, detail) {
      if (!config.logEvents) return;
      events.push({ kind, detail, ts: _now() });
      if (events.length > 1000) events.shift();
    }

    // --------------------------------------------------------------
    // Device CRUD
    // --------------------------------------------------------------
    function registerDevice(spec) {
      spec = spec || {};
      if (!spec.kind) return { ok: false, reason: "no_kind" };
      if (!Array.isArray(spec.ports)) return { ok: false, reason: "no_ports" };
      for (const p of spec.ports) {
        if (!p.name || !p.kind || !p.direction) {
          return { ok: false, reason: "bad_port" };
        }
        if (PORT_KINDS.indexOf(p.kind) === -1) {
          return { ok: false, reason: "unknown_port_kind", port: p.name };
        }
        if (DIRECTIONS.indexOf(p.direction) === -1) {
          return { ok: false, reason: "unknown_direction", port: p.name };
        }
      }
      const id = spec.id || _id(spec.kind);
      if (devices.has(id)) return { ok: false, reason: "duplicate_id" };
      const ports = {};
      for (const p of spec.ports) {
        ports[p.name] = {
          name: p.name, kind: p.kind, direction: p.direction,
          inbox: [], outbox: [],   // packet queues
        };
      }
      const dev = {
        id, kind: spec.kind,
        ports,
        state: spec.state || {},   // device-specific (frequency, files, etc.)
        position: spec.position || null,  // {u, v, y} for proximity calcs
        powered: spec.powered !== false,
      };
      devices.set(id, dev);
      _log("device_added", { id, kind: spec.kind });
      return { ok: true, id, device: dev };
    }

    function getDevice(id) { return devices.get(id) || null; }
    function listDevices() { return Array.from(devices.values()); }
    function removeDevice(id) {
      if (!devices.has(id)) return false;
      // Tear down any wires touching this device
      for (const w of Array.from(wires.values())) {
        if (w.a.deviceId === id || w.b.deviceId === id) removeWire(w.id);
      }
      devices.delete(id);
      _log("device_removed", { id });
      return true;
    }

    function setDevicePosition(id, pos) {
      const d = devices.get(id);
      if (!d) return false;
      d.position = pos;
      return true;
    }

    // --------------------------------------------------------------
    // Wire CRUD
    // --------------------------------------------------------------
    function connect(aDevId, aPort, bDevId, bPort, kind) {
      const a = devices.get(aDevId);
      const b = devices.get(bDevId);
      if (!a || !b) return { ok: false, reason: "no_device" };
      const pa = a.ports[aPort], pb = b.ports[bPort];
      if (!pa || !pb) return { ok: false, reason: "no_port" };
      kind = kind || pa.kind;
      if (!_isCompatibleKind(pa.kind, kind) || !_isCompatibleKind(pb.kind, kind)) {
        return { ok: false, reason: "kind_mismatch",
                 detail: `wire=${kind}, ${aDevId}.${aPort}=${pa.kind}, ${bDevId}.${bPort}=${pb.kind}` };
      }
      // Direction sanity — at least one end must be able to drive the wire.
      // (out → in, io ↔ anything, but not in → in or out → out for unidirectional.)
      if (pa.direction === "in" && pb.direction === "in") {
        return { ok: false, reason: "both_in" };
      }
      if (pa.direction === "out" && pb.direction === "out") {
        return { ok: false, reason: "both_out" };
      }
      const id = _id("wire");
      wires.set(id, {
        id, kind,
        a: { deviceId: aDevId, port: aPort },
        b: { deviceId: bDevId, port: bPort },
      });
      _log("wire_connected", { id, kind, from: aDevId + "." + aPort, to: bDevId + "." + bPort });
      return { ok: true, wireId: id };
    }

    function removeWire(wireId) {
      const w = wires.get(wireId);
      if (!w) return false;
      wires.delete(wireId);
      _log("wire_removed", { id: wireId });
      return true;
    }

    function listWires() { return Array.from(wires.values()); }
    function wiresFor(devId) {
      return Array.from(wires.values()).filter(w => w.a.deviceId === devId || w.b.deviceId === devId);
    }
    function wireFor(devId, portName) {
      for (const w of wires.values()) {
        if (w.a.deviceId === devId && w.a.port === portName) return { wire: w, other: w.b };
        if (w.b.deviceId === devId && w.b.port === portName) return { wire: w, other: w.a };
      }
      return null;
    }

    // --------------------------------------------------------------
    // Packet flow
    // --------------------------------------------------------------
    function _push(dev, portName, packet) {
      const port = dev.ports[portName];
      if (!port) return false;
      if (port.inbox.length >= config.maxPacketQueue) port.inbox.shift();
      port.inbox.push(packet);
      return true;
    }

    function send(deviceId, portName, packet) {
      const dev = devices.get(deviceId);
      if (!dev || !dev.powered) return { ok: false, reason: "no_dev_or_unpowered" };
      const port = dev.ports[portName];
      if (!port) return { ok: false, reason: "no_port" };
      // Direction check: must be out-capable
      if (port.direction === "in") return { ok: false, reason: "port_is_in_only" };

      const wf = wireFor(deviceId, portName);
      if (!wf) {
        // RF ports can broadcast without a physical wire — handled separately
        if (port.kind === "rf") return radioBroadcast(deviceId, portName, packet);
        return { ok: false, reason: "no_wire" };
      }
      const otherDev = devices.get(wf.other.deviceId);
      if (!otherDev || !otherDev.powered) return { ok: false, reason: "other_unpowered" };
      const stamped = Object.assign({}, packet, { ts: _now(), via: wf.wire.id });
      _push(otherDev, wf.other.port, stamped);
      _log("packet_sent", { wire: wf.wire.id, kind: packet.kind });
      return { ok: true, delivered: wf.other };
    }

    // Drain a port's inbox — handler returns void
    function drain(deviceId, portName) {
      const dev = devices.get(deviceId);
      if (!dev) return [];
      const port = dev.ports[portName];
      if (!port) return [];
      const packets = port.inbox.slice();
      port.inbox.length = 0;
      return packets;
    }

    function peek(deviceId, portName) {
      const dev = devices.get(deviceId);
      if (!dev) return [];
      const port = dev.ports[portName];
      if (!port) return [];
      return port.inbox.slice();
    }

    // --------------------------------------------------------------
    // Radio frequency model — virtual wire by tuning + range
    // --------------------------------------------------------------
    function radioBroadcast(srcId, portName, packet) {
      const src = devices.get(srcId);
      if (!src || !src.position) return { ok: false, reason: "no_position" };
      const srcFreq = src.state.frequency;
      if (srcFreq == null) return { ok: false, reason: "no_frequency" };
      let delivered = 0;
      for (const d of devices.values()) {
        if (d.id === srcId) continue;
        if (!d.powered || !d.position) continue;
        if (d.state.frequency !== srcFreq) continue;
        // Find an RF in/io port on the listener
        for (const pname in d.ports) {
          const p = d.ports[pname];
          if (p.kind !== "rf") continue;
          if (p.direction === "out") continue;
          // Range check
          const du = d.position.u - src.position.u;
          const dv = d.position.v - src.position.v;
          const range = Math.min(
            src.state.txRange || config.rfDefaultRange,
            d.state.rxRange   || config.rfDefaultRange
          );
          if (Math.hypot(du, dv) > range) continue;
          const stamped = Object.assign({}, packet, { ts: _now(), via: "rf:" + srcFreq });
          _push(d, pname, stamped);
          delivered++;
        }
      }
      _log("rf_broadcast", { srcId, frequency: srcFreq, delivered });
      return { ok: true, delivered };
    }

    // --------------------------------------------------------------
    // Device factories — convenience builders for common types
    // --------------------------------------------------------------
    function makeComputer(opts) {
      opts = opts || {};
      return registerDevice({
        id: opts.id, kind: "computer",
        position: opts.position,
        state: {
          tier: opts.tier || "basic",
          cpu: opts.cpu || 1,
          ram: opts.ram || 512,
          files: opts.files || { "/boot.txt": "DWRLD OS booting…" },
          slottedMedia: null,    // CD or USB currently inserted
        },
        ports: [
          { name: "video_out", kind: "video", direction: "out" },
          { name: "audio_out", kind: "audio", direction: "out" },
          { name: "usb_a",     kind: "data",  direction: "io"  },
          { name: "usb_b",     kind: "data",  direction: "io"  },
          { name: "cd_slot",   kind: "data",  direction: "io"  },
          { name: "power_in",  kind: "power", direction: "in"  },
        ],
      });
    }

    function makeMonitor(opts) {
      opts = opts || {};
      return registerDevice({
        id: opts.id, kind: "monitor",
        position: opts.position,
        state: {
          size: opts.size || "small",  // small | big | jumbotron (50ft) | colossal (1000ft)
          frameBuffer: [],
        },
        ports: [
          { name: "video_in", kind: "video", direction: "in" },
          { name: "power_in", kind: "power", direction: "in" },
        ],
      });
    }

    function makeSpeaker(opts) {
      opts = opts || {};
      return registerDevice({
        id: opts.id, kind: "speaker",
        position: opts.position,
        state: {
          volume: opts.volume != null ? opts.volume : 0.7,
          queue: [],   // played audio packets (last N for inspection)
        },
        ports: [
          { name: "audio_in", kind: "audio", direction: "in" },
          { name: "power_in", kind: "power", direction: "in" },
        ],
      });
    }

    function makeRadio(opts) {
      opts = opts || {};
      return registerDevice({
        id: opts.id, kind: "radio",
        position: opts.position,
        state: {
          frequency: opts.frequency != null ? opts.frequency : 94.7,
          txRange: opts.txRange || 50,
          rxRange: opts.rxRange || 50,
          received: [],
        },
        ports: [
          { name: "rf",        kind: "rf",    direction: "io"  },
          { name: "audio_in",  kind: "audio", direction: "in"  },
          { name: "audio_out", kind: "audio", direction: "out" },
          { name: "power_in",  kind: "power", direction: "in"  },
        ],
      });
    }

    function makeAntenna(opts) {
      opts = opts || {};
      return registerDevice({
        id: opts.id, kind: "antenna",
        position: opts.position,
        state: { gain: opts.gain || 2, frequency: opts.frequency || 100.0 },
        ports: [
          { name: "rf",       kind: "rf",    direction: "io" },
          { name: "power_in", kind: "power", direction: "in" },
        ],
      });
    }

    function makeStorageMedia(opts) {
      // CD or USB stick. Not a "device" so much as removable inventory — but
      // we model it as a tiny device so it can be wired/inserted uniformly.
      opts = opts || {};
      const kind = opts.mediaKind === "usb" ? "usb" : "cd";
      return registerDevice({
        id: opts.id, kind: kind,
        position: opts.position,
        state: {
          mediaKind: kind,
          files: opts.files || {},     // path → bytes (string for now)
          writable: kind === "usb",
          label: opts.label || (kind === "cd" ? "BLANK_CD" : "DWRLD_USB"),
        },
        ports: [
          { name: "data_io", kind: "data", direction: "io" },
        ],
      });
    }

    // Slot a media device into a host's port (computer's cd_slot / usb_a).
    // Auto-wires them and emits a "media_inserted" packet so the host can
    // mount the filesystem.
    function insertMedia(hostId, hostPort, mediaId) {
      const host = devices.get(hostId);
      const media = devices.get(mediaId);
      if (!host || !media) return { ok: false, reason: "no_device" };
      if (host.state.slottedMedia) return { ok: false, reason: "slot_full" };
      // Auto-wire data port
      const wire = connect(hostId, hostPort, mediaId, "data_io", "data");
      if (!wire.ok) return wire;
      host.state.slottedMedia = { mediaId, hostPort, wireId: wire.wireId };
      // Notify host of mount
      send(mediaId, "data_io", {
        kind: "data",
        payload: { op: "media_inserted", mediaId, files: media.state.files, label: media.state.label },
      });
      _log("media_inserted", { hostId, mediaId, hostPort });
      return { ok: true, wireId: wire.wireId };
    }

    function ejectMedia(hostId) {
      const host = devices.get(hostId);
      if (!host || !host.state.slottedMedia) return { ok: false, reason: "no_media" };
      const { mediaId, wireId } = host.state.slottedMedia;
      removeWire(wireId);
      host.state.slottedMedia = null;
      _log("media_ejected", { hostId, mediaId });
      return { ok: true, mediaId };
    }

    // --------------------------------------------------------------
    // Inspection helpers
    // --------------------------------------------------------------
    function recentEvents(n) { return events.slice(-(n || 50)); }
    function stats() {
      return {
        deviceCount: devices.size,
        wireCount: wires.size,
        kinds: Array.from(devices.values()).reduce((acc, d) => {
          acc[d.kind] = (acc[d.kind] || 0) + 1; return acc;
        }, {}),
      };
    }
    function getConfig() { return Object.assign({}, config); }

    return {
      // CRUD
      registerDevice, getDevice, listDevices, removeDevice, setDevicePosition,
      // Wiring
      connect, removeWire, listWires, wiresFor, wireFor,
      // Packet flow
      send, drain, peek, radioBroadcast,
      // Factories
      makeComputer, makeMonitor, makeSpeaker, makeRadio, makeAntenna, makeStorageMedia,
      insertMedia, ejectMedia,
      // Inspection
      recentEvents, stats, getConfig,
      // Constants (for tests / introspection)
      PORT_KINDS: PORT_KINDS.slice(),
      DIRECTIONS: DIRECTIONS.slice(),
    };
  }

  return { createBus, VERSION: "0.1.0-iter130" };
});
