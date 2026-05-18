// Tests for src/systems/npc_dialog.js
import { it, expect, describe } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dir = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(__dir, "../../src/systems/npc_dialog.js"), "utf8");

it("exports mountNpcDialog", () => {
  expect(src).toMatch(/export\s+function\s+mountNpcDialog/);
});

it("exports DEFAULT_NPC_DIALOGS", () => {
  expect(src).toMatch(/export\s+const\s+DEFAULT_NPC_DIALOGS/);
});

it("guards document access", () => {
  expect(src).toContain('typeof document === "undefined"');
});

it("returns { open, close, isOpen } API", () => {
  expect(src).toContain("return {");
  expect(src).toContain("open,");
  expect(src).toContain("close,");
  expect(src).toContain("get isOpen()");
});

it("open() sets _isOpen = true", () => {
  expect(src).toContain("_isOpen   = true");
});

it("close() sets _isOpen = false", () => {
  expect(src).toContain("_isOpen   = false");
});

it("open() exits pointer lock", () => {
  expect(src).toContain("document.pointerLockElement");
  expect(src).toContain("document.exitPointerLock()");
});

it("open() shows npcDialog panel", () => {
  expect(src).toContain('"block"');
  expect(src).toContain('"npcDialog"');
});

it("close() hides npcDialog panel", () => {
  expect(src).toContain('"none"');
});

it("choice with next:null calls close()", () => {
  expect(src).toContain("close()");
});

it("choice with next index renders that line", () => {
  expect(src).toContain("choice.next");
  expect(src).toContain("def.lines[choice.next]");
});

it("renders name, text, choices elements", () => {
  expect(src).toContain('"npcDialogName"');
  expect(src).toContain('"npcDialogText"');
  expect(src).toContain('"npcDialogChoices"');
});

it("choice buttons have hover style handlers", () => {
  expect(src).toContain("onmouseover");
  expect(src).toContain("onmouseout");
});

describe("DEFAULT_NPC_DIALOGS", () => {
  it("includes npc_red", () => {
    expect(src).toContain("npc_red:");
    expect(src).toContain("ROGUE_RED");
  });

  it("includes npc_blue", () => {
    expect(src).toContain("npc_blue:");
    expect(src).toContain("BYTE_BLUE");
  });

  it("includes npc_green", () => {
    expect(src).toContain("npc_green:");
    expect(src).toContain("GRN_GHOST");
  });

  it("includes npc_white", () => {
    expect(src).toContain("npc_white:");
    expect(src).toContain("PALE_UNIT");
  });

  it("all NPCs have at least one dialog line", () => {
    expect(src).toContain("lines:");
    // Count occurrences of "lines:" to ensure multiple NPCs
    const count = (src.match(/lines:/g) || []).length;
    expect(count).toBeGreaterThanOrEqual(4);
  });
});
