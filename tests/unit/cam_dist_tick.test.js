import { it, expect, describe, vi } from "vitest";
import { mountCamDistTick } from "../../src/systems/cam_dist_tick.js";

function makeState({ camDist = 7, snapZoomTarget = null, computerEntering = false, computerEntryT = 0, camDistBeforeEntry = 7, computerEntryDur = 0.45 } = {}) {
  let _camDist = camDist, _snap = snapZoomTarget, _entering = computerEntering, _entryT = computerEntryT;
  return {
    get: {
      camDist:          () => _camDist,
      snapZoomTarget:   () => _snap,
      computerEntering: () => _entering,
      computerEntryT:   () => _entryT,
      camDistBeforeEntry: () => camDistBeforeEntry,
      computerEntryDur:   () => computerEntryDur,
    },
    set: {
      camDist:         v => { _camDist = v; },
      snapZoomTarget:  v => { _snap = v; },
      computerEntryT:  v => { _entryT = v; },
    },
    _get: () => ({ camDist: _camDist, snapZoomTarget: _snap, computerEntryT: _entryT }),
  };
}

describe("mountCamDistTick — snap-zoom", () => {
  it("no snapZoomTarget → lerpZoom not called, camDist unchanged", () => {
    const lerpZoom = vi.fn();
    const s = makeState({ camDist: 7, snapZoomTarget: null });
    const sys = mountCamDistTick({ get: s.get, set: s.set, actions: { lerpZoom, finishComputerEntry: vi.fn() } });
    sys.tick(0.016);
    expect(lerpZoom).not.toHaveBeenCalled();
    expect(s._get().camDist).toBe(7);
  });

  it("lerpZoom returns null (no CameraSpine) → camDist unchanged", () => {
    const s = makeState({ camDist: 7, snapZoomTarget: 3 });
    const sys = mountCamDistTick({ get: s.get, set: s.set, actions: { lerpZoom: () => null, finishComputerEntry: vi.fn() } });
    sys.tick(0.016);
    expect(s._get().camDist).toBe(7); // unchanged
    expect(s._get().snapZoomTarget).toBe(3); // still set
  });

  it("lerpZoom returns value → camDist updated", () => {
    const s = makeState({ camDist: 7, snapZoomTarget: 3 });
    const sys = mountCamDistTick({ get: s.get, set: s.set, actions: { lerpZoom: () => 6.5, finishComputerEntry: vi.fn() } });
    sys.tick(0.016);
    expect(s._get().camDist).toBeCloseTo(6.5);
    expect(s._get().snapZoomTarget).toBe(3); // still active (not close enough)
  });

  it("within 0.05 of target → clamp and clear snapZoomTarget", () => {
    const s = makeState({ camDist: 7, snapZoomTarget: 7.03 });
    const sys = mountCamDistTick({ get: s.get, set: s.set, actions: { lerpZoom: () => 7.03, finishComputerEntry: vi.fn() } });
    sys.tick(0.016);
    expect(s._get().camDist).toBeCloseTo(7.03);
    expect(s._get().snapZoomTarget).toBeNull();
  });

  it("lerpZoom receives current camDist, snapTarget, dt, speed=8", () => {
    const lerpZoom = vi.fn(() => 5.5);
    const s = makeState({ camDist: 6, snapZoomTarget: 3 });
    const sys = mountCamDistTick({ get: s.get, set: s.set, actions: { lerpZoom, finishComputerEntry: vi.fn() } });
    sys.tick(0.1);
    expect(lerpZoom).toHaveBeenCalledWith(6, 3, 0.1, 8);
  });
});

describe("mountCamDistTick — computer entry dolly", () => {
  it("not entering → computerEntryT unchanged", () => {
    const s = makeState({ computerEntering: false, computerEntryT: 0.3 });
    const sys = mountCamDistTick({ get: s.get, set: s.set, actions: { lerpZoom: vi.fn(), finishComputerEntry: vi.fn() } });
    sys.tick(0.016);
    expect(s._get().computerEntryT).toBeCloseTo(0.3);
  });

  it("entering → computerEntryT increases by dt/dur", () => {
    const s = makeState({ computerEntering: true, computerEntryT: 0, computerEntryDur: 0.5 });
    const sys = mountCamDistTick({ get: s.get, set: s.set, actions: { lerpZoom: vi.fn(), finishComputerEntry: vi.fn() } });
    sys.tick(0.1);
    expect(s._get().computerEntryT).toBeCloseTo(0.2, 5); // 0.1 / 0.5
  });

  it("t >= 1 → clamps to 1 and calls finishComputerEntry", () => {
    const finish = vi.fn();
    const s = makeState({ computerEntering: true, computerEntryT: 0.9, computerEntryDur: 0.45 });
    const sys = mountCamDistTick({ get: s.get, set: s.set, actions: { lerpZoom: vi.fn(), finishComputerEntry: finish } });
    sys.tick(0.1); // 0.9 + 0.1/0.45 > 1
    expect(s._get().computerEntryT).toBe(1);
    expect(finish).toHaveBeenCalledOnce();
  });

  it("t < 1 → camDist eased from camDistBeforeEntry to 0.35", () => {
    // t = 0.5, ease = 0.5*0.5*(3-2*0.5) = 0.25*2 = 0.5
    // camDist = 10 * 0.5 + 0.35 * 0.5 = 5.175
    const s = makeState({ computerEntering: true, computerEntryT: 0.5, computerEntryDur: 1.0, camDistBeforeEntry: 10 });
    const sys = mountCamDistTick({ get: s.get, set: s.set, actions: { lerpZoom: vi.fn(), finishComputerEntry: vi.fn() } });
    sys.tick(0); // dt=0 so entryT doesn't move
    expect(s._get().camDist).toBeCloseTo(5.175, 3);
  });
});
