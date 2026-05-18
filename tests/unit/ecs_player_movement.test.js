import { describe, it, expect, beforeEach } from "vitest";
import {
  createPlayerMovementSystem,
  PLAYER_WALK_SPEED, PLAYER_SPRINT_SPEED, PLAYER_GRAVITY, PLAYER_JUMP_V,
  PLAYER_DODGE_DUR, PLAYER_DODGE_SPEED, PLAYER_DODGE_CD, PLAYER_DODGE_COST,
  PLAYER_STAMINA_LOCKOUT,
} from "../../src/systems/ecs_player_movement.js";
import Core from "../../src/core/core.js";

function makeHero(overrides = {}) {
  const id = Core.createEntity();
  Core.addComponent(id, "PlayerControl", { active: true });
  Core.addComponent(id, "Transform",     { u: 0, v: 0, y: 0 });
  Core.addComponent(id, "Input", {
    forward: false, back: false, left: false, right: false,
    sprint: false, jump: false, dodge: false,
    heading: overrides.heading ?? 0,
    ...overrides.input,
  });
  if (overrides.stamina !== undefined) {
    Core.addComponent(id, "Stamina", { stamina: overrides.stamina, extraMax: 0 });
  }
  return id;
}

// ── Constants parity ──────────────────────────────────────────────────────────
describe("player movement constants — monolith parity", () => {
  it("PLAYER_WALK_SPEED = 5 (line 5652)",     () => expect(PLAYER_WALK_SPEED).toBe(5));
  it("PLAYER_SPRINT_SPEED = 9 (line 5653)",   () => expect(PLAYER_SPRINT_SPEED).toBe(9));
  it("PLAYER_GRAVITY = -25 (line 5650)",      () => expect(PLAYER_GRAVITY).toBe(-25));
  it("PLAYER_JUMP_V = 13 (line 5651)",        () => expect(PLAYER_JUMP_V).toBe(13));
  it("PLAYER_DODGE_DUR = 0.25 (line 5985)",   () => expect(PLAYER_DODGE_DUR).toBe(0.25));
  it("PLAYER_DODGE_SPEED = 18 (line 5986)",   () => expect(PLAYER_DODGE_SPEED).toBe(18));
  it("PLAYER_DODGE_CD = 1.1 (line 5987)",     () => expect(PLAYER_DODGE_CD).toBe(1.1));
  it("PLAYER_DODGE_COST = 20",                () => expect(PLAYER_DODGE_COST).toBe(20));
  it("PLAYER_STAMINA_LOCKOUT = 15",           () => expect(PLAYER_STAMINA_LOCKOUT).toBe(15));
});

// ── WASD movement ─────────────────────────────────────────────────────────────
describe("createPlayerMovementSystem — WASD movement", () => {
  beforeEach(() => Core._reset());

  it("W (forward) moves in +fU, +fV direction when heading=0", () => {
    // heading=0: sin(0)=0, cos(0)=1 → forward=(0,1) in UV
    const sys = createPlayerMovementSystem();
    const id = makeHero({ heading: 0, input: { forward: true } });
    sys(1, Core);
    const t = Core.getComponent(id, "Transform");
    expect(t.u).toBeCloseTo(0);  // sin(0)*5=0
    expect(t.v).toBeCloseTo(5);  // cos(0)*5=5
  });

  it("S (back) moves in -fU, -fV direction when heading=0", () => {
    const sys = createPlayerMovementSystem();
    const id = makeHero({ heading: 0, input: { back: true } });
    sys(1, Core);
    const t = Core.getComponent(id, "Transform");
    expect(t.u).toBeCloseTo(0);
    expect(t.v).toBeCloseTo(-5);
  });

  it("D (right) moves in +rU, +rV direction when heading=0", () => {
    // heading=0: right=(cos(0), -sin(0))=(1, 0)
    const sys = createPlayerMovementSystem();
    const id = makeHero({ heading: 0, input: { right: true } });
    sys(1, Core);
    const t = Core.getComponent(id, "Transform");
    expect(t.u).toBeCloseTo(5);  // cos(0)*5=5
    expect(t.v).toBeCloseTo(0);  // -sin(0)*5=0
  });

  it("A (left) moves in -rU, -rV direction when heading=0", () => {
    const sys = createPlayerMovementSystem();
    const id = makeHero({ heading: 0, input: { left: true } });
    sys(1, Core);
    const t = Core.getComponent(id, "Transform");
    expect(t.u).toBeCloseTo(-5);
    expect(t.v).toBeCloseTo(0);
  });

  it("heading=PI/2 changes forward direction to +U axis", () => {
    // heading=PI/2: sin(PI/2)=1, cos(PI/2)=0 → forward=(1,0)
    const sys = createPlayerMovementSystem();
    const id = makeHero({ heading: Math.PI / 2, input: { forward: true } });
    sys(1, Core);
    const t = Core.getComponent(id, "Transform");
    expect(t.u).toBeCloseTo(5);
    expect(t.v).toBeCloseTo(0);
  });

  it("no movement when no keys pressed", () => {
    const sys = createPlayerMovementSystem();
    const id = makeHero({ heading: 0 });
    sys(1, Core);
    const t = Core.getComponent(id, "Transform");
    expect(t.u).toBe(0);
    expect(t.v).toBe(0);
  });

  it("inactive hero (PlayerControl.active=false) is skipped", () => {
    const sys = createPlayerMovementSystem();
    const id = makeHero({ heading: 0, input: { forward: true } });
    Core.getComponent(id, "PlayerControl").active = false;
    sys(1, Core);
    const t = Core.getComponent(id, "Transform");
    expect(t.v).toBe(0); // no movement
  });

  it("walk speed = 5 u/s over 1s", () => {
    const sys = createPlayerMovementSystem();
    const id = makeHero({ heading: 0, input: { forward: true } });
    sys(1, Core);
    expect(Core.getComponent(id, "Transform").v).toBeCloseTo(PLAYER_WALK_SPEED);
  });

  it("moves at half speed over 0.5s", () => {
    const sys = createPlayerMovementSystem();
    const id = makeHero({ heading: 0, input: { forward: true } });
    sys(0.5, Core);
    expect(Core.getComponent(id, "Transform").v).toBeCloseTo(PLAYER_WALK_SPEED * 0.5);
  });
});

// ── Sprint ────────────────────────────────────────────────────────────────────
describe("createPlayerMovementSystem — sprint", () => {
  beforeEach(() => Core._reset());

  it("sprints at 9 u/s when stamina >= LOCKOUT and sprint=true", () => {
    const sys = createPlayerMovementSystem();
    const id = makeHero({ heading: 0, stamina: 100, input: { forward: true, sprint: true } });
    sys(1, Core);
    expect(Core.getComponent(id, "Transform").v).toBeCloseTo(PLAYER_SPRINT_SPEED);
  });

  it("walks when stamina < LOCKOUT and not already sprinting", () => {
    const sys = createPlayerMovementSystem();
    const id = makeHero({ heading: 0, stamina: 10, input: { forward: true, sprint: true } });
    sys(1, Core);
    expect(Core.getComponent(id, "Transform").v).toBeCloseTo(PLAYER_WALK_SPEED);
  });

  it("walks when sprint=false", () => {
    const sys = createPlayerMovementSystem();
    const id = makeHero({ heading: 0, stamina: 100, input: { forward: true, sprint: false } });
    sys(1, Core);
    expect(Core.getComponent(id, "Transform").v).toBeCloseTo(PLAYER_WALK_SPEED);
  });

  it("sprints when no Stamina component (infinite stamina)", () => {
    const sys = createPlayerMovementSystem();
    const id = makeHero({ heading: 0, input: { forward: true, sprint: true } }); // no stamina
    sys(1, Core);
    expect(Core.getComponent(id, "Transform").v).toBeCloseTo(PLAYER_SPRINT_SPEED);
  });
});

// ── Gravity + jump ────────────────────────────────────────────────────────────
describe("createPlayerMovementSystem — gravity + jump", () => {
  beforeEach(() => Core._reset());

  it("applies gravity: vy decreases by 25/s² each tick", () => {
    const sys = createPlayerMovementSystem();
    const id = makeHero();
    // Force hero into the air by setting y > 0
    const t = Core.getComponent(id, "Transform");
    t.y = 100;
    const motion = { vy: 0, dodgeT: 0, dodgeCooldown: 0, dodgeVU: 0, dodgeVV: 0, grounded: false };
    Core.addComponent(id, "Motion", motion);
    sys(1, Core); // vy = 0 + (-25 * 1) = -25; y = 100 + (-25 * 1) = 75
    expect(t.y).toBeCloseTo(75);
  });

  it("jump sets vy near 13 when grounded", () => {
    // Use tiny dt (1/1000s) so player lifts off slightly and doesn't re-ground immediately.
    // After 1ms: vy = 13 + (-25 * 0.001) = 12.975; y = 0.013 > 0 → still airborne.
    const sys = createPlayerMovementSystem();
    const id = makeHero({ input: { jump: true } });
    const motion = { vy: 0, dodgeT: 0, dodgeCooldown: 0, dodgeVU: 0, dodgeVV: 0, grounded: true };
    Core.addComponent(id, "Motion", motion);
    sys(1 / 1000, Core);
    expect(motion.vy).toBeCloseTo(PLAYER_JUMP_V + PLAYER_GRAVITY / 1000, 1);
    expect(motion.grounded).toBe(false);
  });

  it("cannot jump when not grounded", () => {
    const sys = createPlayerMovementSystem();
    const id = makeHero({ input: { jump: true } });
    const t  = Core.getComponent(id, "Transform");
    t.y = 5;
    const motion = { vy: 0, dodgeT: 0, dodgeCooldown: 0, dodgeVU: 0, dodgeVV: 0, grounded: false };
    Core.addComponent(id, "Motion", motion);
    sys(0, Core);
    expect(motion.vy).toBe(0); // no jump
  });

  it("emits player:jumped on jump", () => {
    const sys = createPlayerMovementSystem();
    const id = makeHero({ input: { jump: true } });
    Core.addComponent(id, "Motion", { vy: 0, dodgeT: 0, dodgeCooldown: 0, dodgeVU: 0, dodgeVV: 0, grounded: true });

    const jumps = [];
    Core.on("player:jumped", e => jumps.push(e));
    sys(0, Core);
    expect(jumps.length).toBe(1);
    expect(jumps[0].entityId).toBe(id);
  });

  it("entity lands when y reaches 0, emits player:landed", () => {
    const sys = createPlayerMovementSystem();
    const id = makeHero();
    const t  = Core.getComponent(id, "Transform");
    t.y = 0.5;
    const motion = { vy: -100, dodgeT: 0, dodgeCooldown: 0, dodgeVU: 0, dodgeVV: 0, grounded: false };
    Core.addComponent(id, "Motion", motion);

    const landed = [];
    Core.on("player:landed", e => landed.push(e));
    sys(0.1, Core); // large downward velocity → lands

    expect(t.y).toBe(0);
    expect(motion.grounded).toBe(true);
    expect(motion.vy).toBe(0);
    expect(landed.length).toBe(1);
  });

  it("no player:landed event if already grounded", () => {
    const sys = createPlayerMovementSystem();
    const id = makeHero();
    Core.addComponent(id, "Motion", { vy: 0, dodgeT: 0, dodgeCooldown: 0, dodgeVU: 0, dodgeVV: 0, grounded: true });

    const landed = [];
    Core.on("player:landed", e => landed.push(e));
    sys(0.1, Core);
    expect(landed.length).toBe(0);
  });

  it("auto-creates Motion component if missing", () => {
    const sys = createPlayerMovementSystem();
    const id = makeHero();
    sys(0, Core); // no Motion component initially
    expect(Core.getComponent(id, "Motion")).toBeDefined();
  });
});

// ── Dodge ─────────────────────────────────────────────────────────────────────
describe("createPlayerMovementSystem — dodge", () => {
  beforeEach(() => Core._reset());

  it("dodge initiates burst when X pressed with enough stamina", () => {
    const sys = createPlayerMovementSystem();
    const id = makeHero({ stamina: 100, input: { dodge: true } });
    const motion = { vy: 0, dodgeT: 0, dodgeCooldown: 0, dodgeVU: 0, dodgeVV: 0, grounded: true };
    Core.addComponent(id, "Motion", motion);

    sys(0, Core); // dt=0 to initiate but not advance

    expect(motion.dodgeT).toBeCloseTo(PLAYER_DODGE_DUR);
    expect(motion.dodgeCooldown).toBeCloseTo(PLAYER_DODGE_CD);
  });

  it("emits player:dodged on dodge initiation", () => {
    const sys = createPlayerMovementSystem();
    const id = makeHero({ stamina: 100, input: { dodge: true } });
    Core.addComponent(id, "Motion", { vy: 0, dodgeT: 0, dodgeCooldown: 0, dodgeVU: 0, dodgeVV: 0, grounded: true });

    const dodges = [];
    Core.on("player:dodged", e => dodges.push(e));
    sys(0, Core);
    expect(dodges.length).toBe(1);
  });

  it("dodge consumes DODGE_COST stamina", () => {
    const sys = createPlayerMovementSystem();
    const id = makeHero({ stamina: 100, input: { dodge: true } });
    Core.addComponent(id, "Motion", { vy: 0, dodgeT: 0, dodgeCooldown: 0, dodgeVU: 0, dodgeVV: 0, grounded: true });

    sys(0, Core);

    const stam = Core.getComponent(id, "Stamina");
    expect(stam.stamina).toBe(80); // 100 - 20
  });

  it("dodge blocked when on cooldown", () => {
    const sys = createPlayerMovementSystem();
    const id = makeHero({ stamina: 100, input: { dodge: true } });
    const motion = { vy: 0, dodgeT: 0, dodgeCooldown: 1.0, dodgeVU: 0, dodgeVV: 0, grounded: true };
    Core.addComponent(id, "Motion", motion);

    const dodges = [];
    Core.on("player:dodged", e => dodges.push(e));
    sys(0, Core);
    expect(dodges.length).toBe(0);
  });

  it("dodge blocked when insufficient stamina", () => {
    const sys = createPlayerMovementSystem();
    const id = makeHero({ stamina: 5, input: { dodge: true } });
    Core.addComponent(id, "Motion", { vy: 0, dodgeT: 0, dodgeCooldown: 0, dodgeVU: 0, dodgeVV: 0, grounded: true });

    const dodges = [];
    Core.on("player:dodged", e => dodges.push(e));
    sys(0, Core);
    expect(dodges.length).toBe(0);
  });

  it("dodge with forward input goes in forward direction (heading=0)", () => {
    const sys = createPlayerMovementSystem();
    const id = makeHero({ heading: 0, stamina: 100, input: { dodge: true, forward: true } });
    Core.addComponent(id, "Motion", { vy: 0, dodgeT: 0, dodgeCooldown: 0, dodgeVU: 0, dodgeVV: 0, grounded: true });

    sys(0, Core); // initiate dodge
    const motion = Core.getComponent(id, "Motion");
    // heading=0: forward=(0,1); dodge speed=18
    expect(motion.dodgeVU).toBeCloseTo(0);
    expect(motion.dodgeVV).toBeCloseTo(PLAYER_DODGE_SPEED);
  });

  it("emits player:dodge_ended when dodge expires", () => {
    const sys = createPlayerMovementSystem();
    const id = makeHero({ stamina: 100, input: { dodge: true } });
    Core.addComponent(id, "Motion", { vy: 0, dodgeT: 0, dodgeCooldown: 0, dodgeVU: 0, dodgeVV: 0, grounded: true });

    const ended = [];
    Core.on("player:dodge_ended", e => ended.push(e));

    sys(0, Core);  // initiate (dt=0, dodgeT set to 0.25)

    const input = Core.getComponent(id, "Input");
    input.dodge = false; // release dodge button
    sys(0.3, Core); // past DODGE_DUR=0.25

    expect(ended.length).toBe(1);
  });

  it("dodge with no movement input defaults to forward", () => {
    const sys = createPlayerMovementSystem();
    const id = makeHero({ heading: 0, stamina: 100, input: { dodge: true } }); // no W/A/S/D
    Core.addComponent(id, "Motion", { vy: 0, dodgeT: 0, dodgeCooldown: 0, dodgeVU: 0, dodgeVV: 0, grounded: true });

    sys(0, Core);
    const motion = Core.getComponent(id, "Motion");
    // forward direction at heading=0: (0, 18)
    expect(motion.dodgeVU).toBeCloseTo(0);
    expect(motion.dodgeVV).toBeCloseTo(PLAYER_DODGE_SPEED);
  });
});
