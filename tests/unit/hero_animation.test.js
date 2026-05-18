// Tests for src/entities/hero_animation.js state machine logic
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createHeroAnimSystem } from "../../src/entities/hero_animation.js";

// Minimal THREE stub: AnimationMixer with action tracking
function makeTHREE() {
  const mixer = {
    _actions: {},
    _updated: [],
    stopAllAction() { this._stopped = true; },
    clipAction(clip) {
      const action = {
        _name: clip.name,
        _running: false,
        isRunning() { return this._running; },
        reset() { return this; },
        play() { this._running = true; return this; },
        stop() { this._running = false; },
        crossFadeTo(other, t, warp) { other.reset().play(); },
        timeScale: 1,
      };
      this._actions[clip.name] = action;
      return action;
    },
    update(dt) { this._updated.push(dt); },
  };
  return { AnimationMixer: function(obj) { obj._mixer = mixer; return mixer; }, _mixer: mixer };
}

function makeHeroGroup(THREE) {
  const clips = [{ name: "walk" }, { name: "run" }, { name: "idle" }, { name: "jump" }, { name: "die" }];
  const obj = {
    animations: clips,
    scale: { setScalar: vi.fn() },
    position: { set: vi.fn() },
    _gltf: null,
  };
  const group = {
    children: [],
    add(o) { this.children.push(o); },
    remove(o) { this.children = this.children.filter(c => c !== o); },
  };
  return { group, obj, clips };
}

describe("createHeroAnimSystem", () => {
  let THREE, group, anim;

  beforeEach(() => {
    globalThis._heroSMMap = undefined;
    globalThis._heroSMBlend = undefined;
    globalThis._heroSMTimeScale = undefined;
    THREE = makeTHREE();
    const h = makeHeroGroup(THREE);
    group = h.group;
    anim = createHeroAnimSystem(THREE, group);
  });

  it("sets up globalThis._heroSMMap with all SM states", () => {
    expect(globalThis._heroSMMap).toBeDefined();
    expect(Object.keys(globalThis._heroSMMap)).toEqual(["idle", "walk", "run", "jump", "attack", "die"]);
  });

  it("sets globalThis._heroSMBlend default to 0.2", () => {
    expect(globalThis._heroSMBlend).toBe(0.2);
  });

  it("sets globalThis._heroSMTimeScale default to 1.0", () => {
    expect(globalThis._heroSMTimeScale).toBe(1.0);
  });

  it("tick does nothing before a GLB is loaded (no mixer)", () => {
    // Should not throw
    expect(() => anim.tick(true, false, false, false, false, 0.016)).not.toThrow();
  });

  it("returns { tick, loadGLB, refreshCharEditor }", () => {
    expect(typeof anim.tick).toBe("function");
    expect(typeof anim.loadGLB).toBe("function");
    expect(typeof anim.refreshCharEditor).toBe("function");
  });

  it("exposes globalThis._heroPlayClip and globalThis._heroStopClip", () => {
    expect(typeof globalThis._heroPlayClip).toBe("function");
    expect(typeof globalThis._heroStopClip).toBe("function");
  });
});

describe("heroAnim state machine transitions", () => {
  let THREE, group, anim, mixer;

  function loadClips(a) {
    // Simulate AssetLoader calling back with an animated object
    const h = makeHeroGroup(THREE);
    globalThis.AssetLoader = {
      loadUrl: (url, hint, cb) => cb(h.obj),
    };
    a.loadGLB("hero.glb", "hero");
    mixer = h.obj._mixer;
    // Wire SM map so transitions have targets
    globalThis._heroSMMap.idle = "idle";
    globalThis._heroSMMap.walk = "walk";
    globalThis._heroSMMap.run  = "run";
    globalThis._heroSMMap.jump = "jump";
    globalThis._heroSMMap.die  = "die";
  }

  beforeEach(() => {
    THREE = makeTHREE();
    group = { children: [], add: vi.fn(), remove: vi.fn() };
    anim  = createHeroAnimSystem(THREE, group);
    loadClips(anim);
  });

  it("selects idle when standing still", () => {
    anim.tick(true, false, false, false, false, 0.016);
    expect(mixer._actions.idle._running).toBe(true);
  });

  it("selects walk when moving but not sprinting", () => {
    anim.tick(true, true, false, false, false, 0.016);
    expect(mixer._actions.walk._running).toBe(true);
  });

  it("selects run when moving + sprinting", () => {
    anim.tick(true, true, true, false, false, 0.016);
    expect(mixer._actions.run._running).toBe(true);
  });

  it("selects jump when not on ground", () => {
    anim.tick(false, false, false, true, false, 0.016);
    expect(mixer._actions.jump._running).toBe(true);
  });

  it("selects die when dead", () => {
    anim.tick(true, false, false, false, true, 0.016);
    expect(mixer._actions.die._running).toBe(true);
  });

  it("die overrides jumping", () => {
    anim.tick(false, false, false, true, true, 0.016);
    expect(mixer._actions.die._running).toBe(true);
    expect(mixer._actions.jump._running).toBe(false);
  });

  it("calls mixer.update with dt on each tick", () => {
    anim.tick(true, false, false, false, false, 0.016);
    anim.tick(true, false, false, false, false, 0.033);
    expect(mixer._updated).toContain(0.016);
    expect(mixer._updated).toContain(0.033);
  });

  it("does not re-transition if state unchanged", () => {
    anim.tick(true, false, false, false, false, 0.016);
    const runBefore = mixer._actions.idle._running;
    // Call again with same state — no crossfade
    anim.tick(true, false, false, false, false, 0.016);
    expect(mixer._actions.idle._running).toBe(runBefore);
  });

  it("globalThis._heroPlayClip plays the named clip", () => {
    globalThis._heroPlayClip("walk");
    expect(mixer._actions.walk._running).toBe(true);
  });

  it("globalThis._heroStopClip stops the named clip", () => {
    globalThis._heroPlayClip("walk");
    globalThis._heroStopClip("walk");
    expect(mixer._actions.walk._running).toBe(false);
  });
});
