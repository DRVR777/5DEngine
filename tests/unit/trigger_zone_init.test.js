import { readFileSync } from "fs";
import { describe, it, expect } from "vitest";

const src = readFileSync("src/systems/trigger_zone_init.js", "utf8");

describe("trigger_zone_init", () => {
  it("exports mountTriggerZoneInit", () => {
    expect(src).toContain("export function mountTriggerZoneInit");
  });

  it("accepts THREE, scene, showToast", () => {
    expect(src).toContain("THREE");
    expect(src).toContain("scene");
    expect(src).toContain("showToast");
  });

  it("guards on TriggerZones existence", () => {
    expect(src).toContain("typeof TriggerZones");
  });

  it("calls TriggerZones.init with THREE and scene", () => {
    expect(src).toContain("TriggerZones.init(THREE, scene)");
  });

  it("adds a shop zone", () => {
    expect(src).toContain("zone_shop");
    expect(src).toContain("Press E to browse");
  });

  it("adds a danger zone", () => {
    expect(src).toContain("zone_danger");
    expect(src).toContain("DANGER ZONE");
  });

  it("wires zoneEnter and zoneExit events for ScriptRunner", () => {
    expect(src).toContain("zoneEnter");
    expect(src).toContain("zoneExit");
    expect(src).toContain("ScriptRunner");
  });
});
