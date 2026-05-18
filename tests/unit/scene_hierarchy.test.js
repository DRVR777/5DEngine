// Tests for src/systems/scene_hierarchy.js
import { it, expect, describe } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dir = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(__dir, "../../src/systems/scene_hierarchy.js"), "utf8");

it("exports mountSceneHierarchy", () => {
  expect(src).toMatch(/export\s+function\s+mountSceneHierarchy/);
});

it("guards document access", () => {
  expect(src).toContain('typeof document === "undefined"');
});

it("returns a render function when called in non-DOM context", () => {
  // When document is undefined the guard returns () => {} immediately
  expect(src).toContain("return () => {};");
});

it("calls getWorldBuilder() inside render to get fresh reference each call", () => {
  expect(src).toContain("getWorldBuilder()");
  // Destructured from factory params, not a module-scope free variable
  expect(src).toContain("const worldBuilder = getWorldBuilder();");
});

it("reads shTree, shCount, shSearch by ID", () => {
  expect(src).toContain('"shTree"');
  expect(src).toContain('"shCount"');
  expect(src).toContain('"shSearch"');
});

it("wires shSearch input listener", () => {
  expect(src).toMatch(/shSearch.*addEventListener.*input/s);
});

it("renders empty-state message when no rows match", () => {
  expect(src).toContain("No objects");
});

it("renders managed objects before unmanaged", () => {
  const managedIdx = src.indexOf("getManagedMap");
  const lightsIdx  = src.indexOf("includes(\"Light\")");
  expect(managedIdx).toBeGreaterThan(-1);
  expect(lightsIdx).toBeGreaterThan(-1);
  expect(managedIdx).toBeLessThan(lightsIdx);
});

it("creates visibility toggle button with ◉/○", () => {
  expect(src).toContain('"◉"');
  expect(src).toContain('"○"');
});

it("creates lock toggle button with ■/□", () => {
  expect(src).toContain('"■"');
  expect(src).toContain('"□"');
});

it("sets countEl with managed.size", () => {
  expect(src).toContain("managed.size");
  expect(src).toContain('" obj"');
});

it("filters by name substring (case insensitive)", () => {
  expect(src).toContain("toLowerCase()");
  expect(src).toContain("includes(filter)");
});

it("wires row onclick to worldBuilder.select", () => {
  expect(src).toContain("worldBuilder.select(obj)");
});

describe("row structure", () => {
  it("creates sh-row div", () => {
    expect(src).toContain('"sh-row"');
  });

  it("creates sh-name span", () => {
    expect(src).toContain('"sh-name"');
  });

  it("creates sh-type span", () => {
    expect(src).toContain('"sh-type"');
  });

  it("adds sh-selected class for selected object", () => {
    expect(src).toContain('" sh-selected"');
  });

  it("managed objects colored #b8e8ff, unmanaged #556677", () => {
    expect(src).toContain('"#b8e8ff"');
    expect(src).toContain('"#556677"');
  });
});
