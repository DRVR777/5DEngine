import { describe, it, expect, beforeEach, vi } from "vitest";
import { createAgentDispatch } from "../../src/systems/ecs_agent_dispatch.js";
import Core from "../../src/core/core.js";

function makeSocket() {
  const emitted = [];
  return {
    emit: (ev, data) => emitted.push({ ev, data }),
    _log: emitted,
  };
}

describe("createAgentDispatch", () => {
  beforeEach(() => { Core._reset(); });

  it("does nothing when getSocket returns null (no server)", () => {
    const sys = createAgentDispatch({ getSocket: () => null });
    expect(() => sys(0, Core)).not.toThrow();
    expect(sys.isConnected()).toBe(false);
  });

  it("wires Core listeners after socket becomes available on first tick", () => {
    let sock = null;
    const sys = createAgentDispatch({ getSocket: () => sock });
    sys(0, Core); // no socket yet
    expect(sys.isConnected()).toBe(false);

    sock = makeSocket();
    sys(0, Core); // socket available — wire listeners
    expect(sys.isConnected()).toBe(true);
  });

  it("relays wave:start to socket as bridge_frame", () => {
    const sock = makeSocket();
    const sys = createAgentDispatch({ getSocket: () => sock });
    sys(0, Core); // wire

    Core.emit("wave:start", { wave: 1, total: 5 });
    expect(sock._log.length).toBe(1);
    expect(sock._log[0].ev).toBe("bridge_frame");
    expect(sock._log[0].data.channel).toBe(1);
    expect(sock._log[0].data.data.type).toBe("wave:start");
    expect(sock._log[0].data.data.wave).toBe(1);
  });

  it("includes ts timestamp on every packet", () => {
    const sock = makeSocket();
    const sys = createAgentDispatch({ getSocket: () => sock });
    sys(0, Core);

    const before = Date.now();
    Core.emit("wave:end", { wave: 2 });
    const after = Date.now();

    expect(sock._log[0].data.data.ts).toBeGreaterThanOrEqual(before);
    expect(sock._log[0].data.data.ts).toBeLessThanOrEqual(after);
  });

  it("relays hero:damaged with payload intact", () => {
    const sock = makeSocket();
    const sys = createAgentDispatch({ getSocket: () => sock });
    sys(0, Core);

    Core.emit("hero:damaged", { damage: 15, enemyId: 42 });
    const pkt = sock._log[0].data.data;
    expect(pkt.type).toBe("hero:damaged");
    expect(pkt.damage).toBe(15);
    expect(pkt.enemyId).toBe(42);
  });

  it("relays pickup:collected", () => {
    const sock = makeSocket();
    const sys = createAgentDispatch({ getSocket: () => sock });
    sys(0, Core);

    Core.emit("pickup:collected", { kind: "coin", entityId: 7 });
    expect(sock._log[0].data.data.kind).toBe("coin");
  });

  it("relays perk:applied", () => {
    const sock = makeSocket();
    const sys = createAgentDispatch({ getSocket: () => sock });
    sys(0, Core);

    Core.emit("perk:applied", { perkId: "dmg", heroId: 1 });
    expect(sock._log[0].data.data.perkId).toBe("dmg");
  });

  it("relays shop:bought", () => {
    const sock = makeSocket();
    const sys = createAgentDispatch({ getSocket: () => sock });
    sys(0, Core);

    Core.emit("shop:bought", { itemId: "armor", remainingCoins: 3, heroId: 1 });
    expect(sock._log[0].data.data.itemId).toBe("armor");
  });

  it("uses custom channel when specified", () => {
    const sock = makeSocket();
    const sys = createAgentDispatch({ getSocket: () => sock, channel: 2 });
    sys(0, Core);

    Core.emit("hero:died", {});
    expect(sock._log[0].data.channel).toBe(2);
  });

  it("does not throw when socket.emit throws (bridge offline)", () => {
    const brokenSock = { emit: () => { throw new Error("ECONNREFUSED"); } };
    const sys = createAgentDispatch({ getSocket: () => brokenSock });
    sys(0, Core);
    expect(() => Core.emit("wave:start", { wave: 1 })).not.toThrow();
  });

  it("does not re-wire listeners on subsequent ticks", () => {
    const sock = makeSocket();
    const sys = createAgentDispatch({ getSocket: () => sock });
    sys(0, Core);
    sys(0, Core); // second tick — must not double-wire
    sys(0, Core); // third tick

    Core.emit("wave:end", { wave: 1 });
    expect(sock._log.length).toBe(1); // only ONE packet, not 3
  });
});
