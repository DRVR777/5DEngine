import { readFileSync } from "fs";
import { describe, it, expect } from "vitest";

const src = readFileSync("src/render/loaders.js", "utf8");

describe("loaders", () => {
  it("exports mountLoaders", () => {
    expect(src).toContain("export function mountLoaders");
  });

  it("creates Loaders object", () => {
    expect(src).toContain("const Loaders = {}");
  });

  it("dynamically imports GLTFLoader", () => {
    expect(src).toContain("GLTFLoader");
  });

  it("dynamically imports OBJLoader", () => {
    expect(src).toContain("OBJLoader");
  });

  it("dynamically imports MTLLoader", () => {
    expect(src).toContain("MTLLoader");
  });

  it("dynamically imports FBXLoader", () => {
    expect(src).toContain("FBXLoader");
  });

  it("returns Loaders", () => {
    expect(src).toContain("return { Loaders }");
  });
});
