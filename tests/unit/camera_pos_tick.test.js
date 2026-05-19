import { it, expect, describe } from "vitest";
import { mountCameraPosTick } from "../../src/systems/camera_pos_tick.js";

function makeVec3(x = 0, y = 0, z = 0) {
  const v = { x, y, z };
  v.set = (a, b, c) => { v.x = a; v.y = b; v.z = c; return v; };
  v.copy = (o) => { v.x = o.x; v.y = o.y; v.z = o.z; return v; };
  v.add  = (o) => { v.x += o.x; v.y += o.y; v.z += o.z; return v; };
  v.multiplyScalar = (s) => { v.x *= s; v.y *= s; v.z *= s; return v; };
  return v;
}

function makeCamera() {
  const log = [];
  const pos = makeVec3();
  pos.copy = (o) => { log.push({ fn: "copy", o }); pos.x = o.x; pos.y = o.y; pos.z = o.z; return pos; };
  pos.set  = (x, y, z) => { log.push({ fn: "set", x, y, z }); pos.x = x; pos.y = y; pos.z = z; return pos; };
  pos.add  = (o) => { pos.x += o.x; pos.y += o.y; pos.z += o.z; return pos; };
  return {
    position: pos,
    lookAt:  (v) => log.push({ fn: "lookAt", v }),
    rotateZ: (a) => log.push({ fn: "rotateZ", a }),
    _log: log,
  };
}

function makeVectors() {
  return {
    camTarget:    makeVec3(),
    camOff:       makeVec3(),
    camLook:      makeVec3(),
    camAimTarget: makeVec3(),
    camBuildLook: makeVec3(),
  };
}

function makeSys() {
  const vectors = makeVectors();
  const camera  = makeCamera();
  const sys = mountCameraPosTick({
    vectors,
    actions: { getCamera: () => camera },
  });
  return { sys, camera, vectors };
}

const HERO_POS    = { x: 5, y: 0, z: 3 };
const FREE_POS    = { x: 10, y: 4, z: 7 };
const BASE_COMMON = {
  heroPos: HERO_POS, freeCamPos: FREE_POS, freeCamYaw: 0, freeCamPitch: 0,
  camYaw: 0, camPitch: 0, dist: 4, crouchAmt: 0, gunBobPhase: 0,
  aiming: false, canSprint: false, camSide: 1, strafeRollAmt: 0,
};

describe("camera_pos_tick — build mode", () => {
  it("buildMode → camera.position.copy(freeCamPos)", () => {
    const { sys, camera } = makeSys();
    sys.tick(0.016, { ...BASE_COMMON, buildMode: true, firstPerson: false });
    expect(camera._log.some(l => l.fn === "copy")).toBe(true);
  });

  it("buildMode → camera.lookAt called", () => {
    const { sys, camera } = makeSys();
    sys.tick(0.016, { ...BASE_COMMON, buildMode: true, firstPerson: false });
    expect(camera._log.some(l => l.fn === "lookAt")).toBe(true);
  });
});

describe("camera_pos_tick — first-person", () => {
  it("firstPerson → camera.position.set (not copy)", () => {
    const { sys, camera } = makeSys();
    sys.tick(0.016, { ...BASE_COMMON, buildMode: false, firstPerson: true });
    expect(camera._log.some(l => l.fn === "set")).toBe(true);
    expect(camera._log.some(l => l.fn === "copy")).toBe(false);
  });

  it("firstPerson → camera.lookAt called", () => {
    const { sys, camera } = makeSys();
    sys.tick(0.016, { ...BASE_COMMON, buildMode: false, firstPerson: true });
    expect(camera._log.some(l => l.fn === "lookAt")).toBe(true);
  });

  it("firstPerson → camera.rotateZ called", () => {
    const { sys, camera } = makeSys();
    sys.tick(0.016, { ...BASE_COMMON, buildMode: false, firstPerson: true, strafeRollAmt: 0.5 });
    expect(camera._log.some(l => l.fn === "rotateZ")).toBe(true);
  });

  it("firstPerson + crouchAmt=0.5 → Y reduced by 0.5*0.75=0.375", () => {
    const { sys, camera } = makeSys();
    sys.tick(0.016, { ...BASE_COMMON, buildMode: false, firstPerson: true, crouchAmt: 0.5, gunBobPhase: 0 });
    const setCall = camera._log.find(l => l.fn === "set");
    // Eye height = 1.78 - 0.5*0.75 = 1.405; position.y = heroPos.y + eyeH = 0 + 1.405
    expect(setCall.y).toBeCloseTo(1.405, 3);
  });

  it("firstPerson + aiming → bob amplitude scaled down (aiming = 0.15 scale)", () => {
    const { sys, camera: cam1 } = makeSys();
    const { sys: sys2, camera: cam2 } = makeSys();
    const phase = Math.PI / 2; // sin = 1, so bobY = amplitude
    sys.tick(0.016, { ...BASE_COMMON, buildMode: false, firstPerson: true, gunBobPhase: phase, aiming: true });
    sys2.tick(0.016, { ...BASE_COMMON, buildMode: false, firstPerson: true, gunBobPhase: phase, aiming: false });
    const y1 = cam1._log.find(l => l.fn === "set").y;
    const y2 = cam2._log.find(l => l.fn === "set").y;
    // Aiming bob should be much smaller
    expect(Math.abs(y1 - 1.78)).toBeLessThan(Math.abs(y2 - 1.78));
  });
});

describe("camera_pos_tick — third-person", () => {
  it("third-person → camera.position.copy(camTarget) then .add(camOff)", () => {
    const { sys, camera } = makeSys();
    sys.tick(0.016, { ...BASE_COMMON, buildMode: false, firstPerson: false });
    expect(camera._log.some(l => l.fn === "copy")).toBe(true);
    expect(camera._log.some(l => l.fn === "lookAt")).toBe(true);
  });

  it("third-person + dist=6 → camOff uses dist=6", () => {
    const { sys, vectors } = makeSys();
    // camYaw=0 → fx=0, fz=1; camPitch=0 → cos=1, sin=0; so camOff.z = -dist
    sys.tick(0.016, { ...BASE_COMMON, buildMode: false, firstPerson: false, dist: 6, camYaw: 0, camPitch: 0, camSide: 0 });
    expect(vectors.camOff.z).toBeCloseTo(-6, 4);
  });
});

describe("camera_pos_tick — camTarget set from heroPos", () => {
  it("camTarget.y = heroPos.y + eyeH (stand, no crouch)", () => {
    const { sys, vectors } = makeSys();
    sys.tick(0.016, { ...BASE_COMMON, buildMode: false, firstPerson: false, crouchAmt: 0 });
    // EYE_H_TP=1.2, CROUCH_TP=0.4, crouchAmt=0 → eyeH=1.2
    expect(vectors.camTarget.y).toBeCloseTo(0 + 1.2, 3); // heroPos.y=0
  });
});
