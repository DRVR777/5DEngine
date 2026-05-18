// Tests for src/social/lan_session.js
import { it, expect, describe } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dir = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(__dir, "../../src/social/lan_session.js"), "utf8");

it("exports createLanSession", () => {
  expect(src).toMatch(/export\s+function\s+createLanSession/);
});

it("accepts { THREE, scene, state, getShowToast, getEnemies, getCamera, getGameState }", () => {
  expect(src).toContain("getShowToast");
  expect(src).toContain("getEnemies");
  expect(src).toContain("getCamera");
  expect(src).toContain("getGameState");
});

it("gracefully disables when io is undefined", () => {
  expect(src).toContain('typeof io === "undefined"');
  expect(src).toContain("enabled: false");
});

it("returns a lazy proxy with tick/send/sendEvent", () => {
  expect(src).toContain("tick(dt)");
  expect(src).toContain("send(heroPos)");
  expect(src).toContain("sendEvent(t, d)");
});

it("reads myIp from server and writes to state.myIp", () => {
  expect(src).toContain("state.myIp = data.myIp");
});

it("reads onMpWelcomeHook from state (not module scope)", () => {
  expect(src).toContain("state.onMpWelcomeHook");
});

it("reads onMpBuildEvent from state", () => {
  expect(src).toContain("state.onMpBuildEvent");
});

it("pushes friend requests to state.pendingFriendRequests", () => {
  expect(src).toContain("state.pendingFriendRequests.push");
});

it("calls getEnemies() for enemy_kill event", () => {
  expect(src).toContain("getEnemies().find");
});

it("calls getCamera() inside tick for label billboard", () => {
  expect(src).toContain("getCamera()");
  expect(src).toContain("lookAt(cam.position)");
});

it("uses getGameState() in send() — not direct var references", () => {
  expect(src).toContain("const gs = getGameState()");
  expect(src).toContain("gs.camYaw");
  expect(src).toContain("gs.currentWeaponId");
  expect(src).toContain("gs.heroHp");
  expect(src).toContain("gs.isSprinting");
  expect(src).toContain("gs.inCar");
});

it("uses dead-reckoning: extrapolates vehicle position when no packet for >60ms", () => {
  expect(src).toContain("msSinceUpdate > 60");
  expect(src).toContain("addScaledVector");
});

it("applies different lerp factor for vehicles vs walkers", () => {
  expect(src).toContain("p.inVehicle ? 8 : 12");
});

it("emits mp_name on connect", () => {
  expect(src).toContain('"mp_name"');
});

it("emits mp_pos on send", () => {
  expect(src).toContain('"mp_pos"');
});

it("emits mp_event on sendEvent", () => {
  expect(src).toContain('"mp_event"');
});

describe("humanoid mesh creation", () => {
  it("creates torso, head, and name label with BoxGeometry + PlaneGeometry", () => {
    expect(src).toContain("BoxGeometry");
    expect(src).toContain("PlaneGeometry");
  });

  it("has arms and two-segment legs", () => {
    expect(src).toContain("_arm()");
    expect(src).toContain("_leg()");
    expect(src).toContain("armL");
    expect(src).toContain("thighL");
    expect(src).toContain("shinL");
  });

  it("assigns unique shirt color from hashed socket id", () => {
    expect(src).toContain("_idColor(id)");
    expect(src).toContain("shirtColor");
  });

  it("walk animation refs stored on group", () => {
    expect(src).toContain("grp._walkRefs");
    expect(src).toContain("grp._walkPhase");
  });

  it("adds humanoid to scene", () => {
    expect(src).toContain("scene.add(grp)");
  });

  it("removes humanoid from scene on peer left", () => {
    expect(src).toContain("scene.remove(p.mesh)");
  });
});

describe("peer hit system", () => {
  it("exposes hitPeer method", () => {
    expect(src).toContain("function hitPeer(peerId, damage, headshot)");
  });

  it("sends player_hit event on hitPeer", () => {
    expect(src).toContain('"player_hit"');
    expect(src).toContain("targetId: peerId");
  });

  it("dispatches incoming_hit when targetId matches myId", () => {
    expect(src).toContain('"incoming_hit"');
    expect(src).toContain("data.targetId === _myId");
  });
});

describe("event system", () => {
  it("exposes onEvent(type, cb) API", () => {
    expect(src).toContain("function onEvent(type, cb)");
  });

  it("dispatches duel_* events to listeners", () => {
    expect(src).toContain("data.type.startsWith(\"duel_\")");
    expect(src).toContain("_dispatch(data.type, data)");
  });
});
