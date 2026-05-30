/**
 * agent_channel_handler.js — Channel 4 (AGENT) handler
 *
 * This is the hivemind's distributed AI substrate.
 *
 * Channel 4 in network_bridge.js is defined as:
 *   "AGENT — dworld:// identity + payload (on-demand)"
 * But it has no handler on the consumer side. This module is that handler.
 *
 * ARCHITECTURE:
 *   Peer A (needs inference)         Peer B (has GPU/model)
 *   ─────────────────────────────────────────────────────
 *   sendAgentRequest(prompt, type)    ←→   handleAgentRequest(packet)
 *   → Ch4 packet → relay              ←→   → local AI → Ch4 response
 *   ← Ch4 response ← relay           ←→   ← sendAgentResponse(id, result)
 *
 * PACKET SCHEMA (Channel 4):
 *   {
 *     type: "request" | "response" | "broadcast" | "identity",
 *     id:   string,          — uuid for request/response pairing
 *     from: string,          — dworld:// node ID (Ed25519 pub key short)
 *     to:   string | "any",  — target peer ID or "any" for broadcast
 *     ts:   number,          — timestamp ms
 *     ttl:  number,          — max hops (default 1)
 *     payload: {
 *       // for type:"request":
 *       prompt:     string,  — the question/task
 *       modelHint:  string,  — "fast"|"smart"|"vision" — capability request
 *       context:    object,  — game state context (facets snapshot)
 *       // for type:"response":
 *       requestId:  string,  — echoes the request id
 *       text:       string,  — the AI response
 *       model:      string,  — which model actually responded
 *       latency:    number,  — ms to generate
 *       // for type:"broadcast":
 *       event:      string,  — event name
 *       data:       object,  — event data
 *       // for type:"identity":
 *       nodeName:   string,
 *       capabilities: string[], — ["inference:fast", "storage:1gb", "relay"]
 *       modelList:  string[],
 *     }
 *   }
 *
 * HOW THE AI RUNS:
 *   By default, connects to localhost:11434 (ollama).
 *   Falls back to Anthropic API if ollama unavailable (requires API key facet).
 *   Council agents (CLAUDE.md) can be invoked directly via the agent_bus_adapter
 *   that's already running in the 7D daemon on quandaleServer.
 *
 * @author SCHIZOPHRENIC_ACELLERATOR
 */

const CHANNEL_AGENT = 4;
const OLLAMA_DEFAULT = "http://localhost:11434";

export class AgentChannelHandler {
  /**
   * @param {object} bridge     — NetworkBridge instance
   * @param {object} registry   — Ankhor ThingRegistry
   * @param {object} [opts]
   * @param {string}  [opts.ollamaBase]    — ollama base URL
   * @param {string}  [opts.defaultModel]  — default ollama model
   * @param {boolean} [opts.acceptAny]     — accept requests from any peer
   * @param {number}  [opts.maxConcurrent] — max concurrent inference jobs
   * @param {string[]} [opts.capabilities] — what this node advertises
   */
  constructor(bridge, registry, opts = {}) {
    this._bridge     = bridge;
    this._registry   = registry;
    this._ollamaBase = opts.ollamaBase    ?? OLLAMA_DEFAULT;
    this._model      = opts.defaultModel  ?? "llama3";
    this._acceptAny  = opts.acceptAny     ?? true;
    this._maxConcurrent = opts.maxConcurrent ?? 2;
    this._capabilities  = opts.capabilities ?? ["inference:fast"];
    this._pending    = new Map(); // id → { resolve, reject, timeoutHandle }
    this._running    = 0;
    this._nodeId     = null;
    this._handlers   = new Map(); // event → fn[]
    this._ollamaAvailable = null; // cached availability check
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  start() {
    this._wireChannelListener();
    this._checkOllama();
    this._broadcastIdentity();
    console.log("[AgentCh4] started, capabilities:", this._capabilities);
  }

  stop() {
    // Reject all pending requests
    for (const [id, p] of this._pending) {
      clearTimeout(p.timeoutHandle);
      p.reject(new Error("AgentChannelHandler stopped"));
    }
    this._pending.clear();
  }

  // ── Public: send a request to the hivemind ─────────────────────────────────

  /**
   * Ask the hivemind (or a specific peer) for AI inference.
   * Returns a Promise that resolves with the response text.
   *
   * @param {string} prompt — the question/task
   * @param {object} [opts]
   * @param {string}  [opts.to="any"]       — target peer or "any"
   * @param {string}  [opts.modelHint]      — "fast"|"smart"|"vision"
   * @param {object}  [opts.context]        — game state facets to include
   * @param {number}  [opts.timeout=10000]  — ms before rejecting
   * @returns {Promise<string>}
   */
  async request(prompt, opts = {}) {
    const id = crypto.randomUUID?.() ?? `req-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    // If we have ollama locally and the request is for "any", try local first
    if ((opts.to ?? "any") === "any" && this._ollamaAvailable) {
      try {
        const result = await this._inferLocal(prompt, opts.context);
        return result;
      } catch (e) {
        console.warn("[AgentCh4] local inference failed, routing to network:", e.message);
      }
    }

    // Route via network
    return new Promise((resolve, reject) => {
      const timeout = opts.timeout ?? 10000;
      const handle  = setTimeout(() => {
        this._pending.delete(id);
        reject(new Error(`AgentCh4 request ${id} timed out after ${timeout}ms`));
      }, timeout);

      this._pending.set(id, { resolve, reject, timeoutHandle: handle });

      this._sendPacket({
        type: "request",
        id,
        to:   opts.to ?? "any",
        payload: {
          prompt,
          modelHint: opts.modelHint ?? "fast",
          context:   opts.context ?? this._snapshotContext(),
        }
      });
    });
  }

  /**
   * Broadcast an event to all peers via Channel 4.
   * @param {string} event — event name
   * @param {object} data  — event data
   */
  broadcast(event, data) {
    this._sendPacket({
      type: "broadcast",
      id: crypto.randomUUID?.() ?? Date.now().toString(),
      to: "any",
      payload: { event, data },
    });
  }

  /**
   * Listen for Channel 4 broadcast events from peers.
   * @param {string} event
   * @param {function} fn
   */
  on(event, fn) {
    if (!this._handlers.has(event)) this._handlers.set(event, []);
    this._handlers.get(event).push(fn);
  }

  // ── Internal: channel listener ─────────────────────────────────────────────

  _wireChannelListener() {
    const core = this._bridge?._core;
    if (!core) {
      console.warn("[AgentCh4] no bridge core — using window.EventBus fallback");
      window.EventBus?.on?.("net:recv", (frame) => {
        if (frame.channel === CHANNEL_AGENT) this._handlePacket(frame);
      });
      return;
    }
    core.on("net:recv", (frame) => {
      if (frame.channel === CHANNEL_AGENT) this._handlePacket(frame);
    });
  }

  async _handlePacket(frame) {
    let packet;
    try {
      packet = typeof frame.data === "string" ? JSON.parse(frame.data) : frame.data;
    } catch (e) {
      console.warn("[AgentCh4] bad packet:", e.message);
      return;
    }

    const { type, id, from, to, payload } = packet;

    // Not for us?
    if (to && to !== "any" && to !== this._nodeId) return;

    switch (type) {
      case "request":
        await this._handleInferenceRequest(packet);
        break;

      case "response":
        this._handleInferenceResponse(packet);
        break;

      case "broadcast":
        this._dispatchBroadcast(payload?.event, payload?.data, from);
        break;

      case "identity":
        this._handlePeerIdentity(packet);
        break;

      default:
        console.warn("[AgentCh4] unknown packet type:", type);
    }
  }

  // ── Internal: inference request handling ──────────────────────────────────

  async _handleInferenceRequest(packet) {
    if (!this._acceptAny && packet.to === "any") return;
    if (this._running >= this._maxConcurrent) return; // too busy

    this._running++;
    const { id, from, payload } = packet;

    try {
      const text = await this._inferLocal(payload.prompt, payload.context);
      const model = this._model;

      this._sendPacket({
        type: "response",
        id: crypto.randomUUID?.() ?? Date.now().toString(),
        to: from,
        payload: {
          requestId: id,
          text,
          model,
          latency: 0, // TODO: track actual latency
        }
      });
    } catch (e) {
      console.warn("[AgentCh4] inference failed:", e.message);
    } finally {
      this._running--;
    }
  }

  _handleInferenceResponse(packet) {
    const requestId = packet.payload?.requestId;
    if (!requestId) return;
    const pending = this._pending.get(requestId);
    if (!pending) return;
    clearTimeout(pending.timeoutHandle);
    this._pending.delete(requestId);
    pending.resolve(packet.payload?.text ?? "");
  }

  // ── Internal: local AI inference (ollama) ─────────────────────────────────

  async _inferLocal(prompt, context) {
    const systemPrompt = context
      ? `You are an AI assistant embedded in a 5DEngine node. Current game context:\n${JSON.stringify(context, null, 2)}\n\nRespond helpfully and concisely.`
      : "You are an AI assistant embedded in a 5DEngine P2P node. Respond helpfully and concisely.";

    const resp = await fetch(`${this._ollamaBase}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model:  this._model,
        prompt: `${systemPrompt}\n\nUser: ${prompt}\nAssistant:`,
        stream: false,
        options: { temperature: 0.7, num_predict: 512 },
      }),
    });
    if (!resp.ok) throw new Error(`ollama HTTP ${resp.status}`);
    const data = await resp.json();
    return data.response ?? "";
  }

  async _checkOllama() {
    try {
      const r = await fetch(`${this._ollamaBase}/api/tags`, { signal: AbortSignal.timeout(2000) });
      const data = await r.json();
      const models = data.models?.map(m => m.name) ?? [];
      this._ollamaAvailable = models.length > 0;
      // Update capabilities based on available models
      if (models.some(m => m.includes("llama3") || m.includes("mistral"))) {
        if (!this._capabilities.includes("inference:smart")) {
          this._capabilities.push("inference:smart");
        }
      }
      console.log(`[AgentCh4] ollama available, models: ${models.join(", ")}`);
    } catch (e) {
      this._ollamaAvailable = false;
      console.log("[AgentCh4] ollama unavailable — will route requests to network");
    }
  }

  // ── Internal: peer identity ───────────────────────────────────────────────

  _broadcastIdentity() {
    // Get node ID from worldWideComms identity if available
    this._nodeId = window.WWCIdentity?.nodeId
      ?? window._wwcNodeId
      ?? `local-${Math.random().toString(36).slice(2, 8)}`;

    this._sendPacket({
      type: "identity",
      id: crypto.randomUUID?.() ?? Date.now().toString(),
      to: "any",
      payload: {
        nodeName:     this._nodeId,
        capabilities: this._capabilities,
        modelList:    [this._model],
      }
    });
  }

  _handlePeerIdentity(packet) {
    const { from, payload } = packet;
    if (!from || !payload) return;
    // Store peer capabilities in registry
    const peerId = `peer:${from}`;
    const reg = this._registry;
    if (reg.setFacet) {
      reg.setFacet(peerId, "peer-identity", {
        nodeId:       from,
        capabilities: payload.capabilities ?? [],
        models:       payload.modelList    ?? [],
        lastSeen:     Date.now(),
      });
    }
    this._dispatchBroadcast("peer:identity", payload, from);
  }

  // ── Internal: broadcast dispatch ─────────────────────────────────────────

  _dispatchBroadcast(event, data, from) {
    if (!event) return;
    // Fire on local EventBus too
    window.EventBus?.emit?.(event, { ...data, _from: from });
    // Fire on registered handlers
    const handlers = this._handlers.get(event) ?? [];
    for (const fn of handlers) {
      try { fn(data, from); } catch (e) { console.warn("[AgentCh4] handler error:", e); }
    }
  }

  // ── Internal: context snapshot ───────────────────────────────────────────

  _snapshotContext() {
    const reg = this._registry;
    const snap = {};
    try {
      // Hero state
      const heroId = reg.byKind?.("hero")?.[0]?.id;
      if (heroId) {
        snap.hero = {
          hp:       reg.facetData?.(heroId, "health")?.hp,
          position: reg.facetData?.(heroId, "position5d"),
          weapon:   reg.facetData?.(heroId, "weapon")?.id,
        };
      }
      // World state
      const worldId = reg.byKind?.("world")?.[0]?.id;
      if (worldId) {
        snap.world = {
          mode:  reg.facetData?.(worldId, "world-state")?.mode,
          wave:  reg.facetData?.(worldId, "wave-state")?.wave,
          hour:  reg.facetData?.(worldId, "day-night")?.hour,
        };
      }
    } catch (e) {
      // Context snapshot is best-effort
    }
    return snap;
  }

  // ── Internal: send packet ─────────────────────────────────────────────────

  _sendPacket(packet) {
    const full = {
      from: this._nodeId ?? "unknown",
      ts:   Date.now(),
      ttl:  1,
      ...packet,
    };
    const data = JSON.stringify(full);
    const core = this._bridge?._core;
    if (core) {
      core.emit("net:send", { channel: CHANNEL_AGENT, data });
    } else {
      window.EventBus?.emit?.("net:send", { channel: CHANNEL_AGENT, data });
    }
  }
}

/**
 * Quick install: creates handler, wires it up, starts it.
 * @param {object} bridge   — NetworkBridge instance
 * @param {object} registry — Ankhor ThingRegistry
 * @param {object} [opts]
 * @returns {AgentChannelHandler}
 */
export function installAgentChannel(bridge, registry, opts = {}) {
  const handler = new AgentChannelHandler(bridge, registry, opts);
  handler.start();
  return handler;
}

if (typeof window !== "undefined") {
  window.AgentChannelHandler = AgentChannelHandler;
  window.installAgentChannel  = installAgentChannel;
}
