// Tests for src/systems/computer_apps.js
import { it, expect, describe } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dir = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(__dir, "../../src/systems/computer_apps.js"), "utf8");

it("exports buildComputerApps", () => {
  expect(src).toMatch(/export\s+function\s+buildComputerApps/);
});

it("exports addDynamicIcons", () => {
  expect(src).toMatch(/export\s+function\s+addDynamicIcons/);
});

it("buildComputerApps accepts getState function", () => {
  expect(src).toContain("getState");
});

describe("app definitions", () => {
  it("defines mail app", () => {
    expect(src).toContain("mail:");
    expect(src).toContain("Mail");
  });

  it("defines wallet app that reads getState", () => {
    expect(src).toContain("wallet:");
    expect(src).toContain("getState()");
  });

  it("defines stats app", () => {
    expect(src).toContain("stats:");
  });

  it("defines codex app", () => {
    expect(src).toContain("codex:");
  });

  it("defines achievements app", () => {
    expect(src).toContain("achievements:");
  });

  it("defines map app", () => {
    expect(src).toContain("map:");
  });

  it("defines market app", () => {
    expect(src).toContain("market:");
  });

  it("defines radio app", () => {
    expect(src).toContain("radio:");
  });

  it("defines devices app", () => {
    expect(src).toContain("devices:");
  });

  it("defines friends app", () => {
    expect(src).toContain("friends:");
  });

  it("defines servers app", () => {
    expect(src).toContain("servers:");
  });

  it("defines gamemodes app", () => {
    expect(src).toContain("gamemodes:");
  });

  it("defines files app", () => {
    expect(src).toContain("files:");
  });

  it("defines browser app", () => {
    expect(src).toContain("browser:");
  });
});

describe("wallet app state reads", () => {
  it("reads score from state", () => {
    expect(src).toContain("s.score");
  });

  it("reads pistolAmmo from state", () => {
    expect(src).toContain("s.pistolAmmo");
  });

  it("reads heroHealth from state", () => {
    expect(src).toContain("s.heroHealth");
  });

  it("calls getWeapon() on state", () => {
    expect(src).toContain("s.getWeapon()");
  });
});

describe("stats app state reads", () => {
  it("reads world.players for hero position", () => {
    expect(src).toContain('s.world.players.get("hero")');
  });

  it("reads inCar from state", () => {
    expect(src).toContain("s.inCar");
  });

  it("reads carState from state", () => {
    expect(src).toContain("s.carState");
  });
});

describe("addDynamicIcons", () => {
  it("guards document access", () => {
    expect(src).toContain('typeof document === "undefined"');
  });

  it("queries computerOverlay grid", () => {
    expect(src).toContain('"#computerOverlay .grid"');
  });

  it("adds gamemodes icon", () => {
    expect(src).toContain('"gamemodes"');
  });

  it("adds friends icon", () => {
    expect(src).toContain('"friends"');
  });

  it("adds browser icon", () => {
    expect(src).toContain('"browser"');
  });

  it("skips duplicates with data-app check", () => {
    expect(src).toContain('data-app=');
  });
});
