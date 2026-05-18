// Tests for src/ui/computer_ui_events.js
import { it, expect, describe } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dir = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(__dir, "../../src/ui/computer_ui_events.js"), "utf8");

it("exports mountComputerUI", () => {
  expect(src).toMatch(/export\s+function\s+mountComputerUI/);
});

it("guards document access", () => {
  expect(src).toContain('typeof document === "undefined"');
});

describe("dependencies", () => {
  it("accepts getAPPS", () => {
    expect(src).toContain("getAPPS");
  });

  it("accepts getDeviceBus", () => {
    expect(src).toContain("getDeviceBus");
  });

  it("accepts getHeroMedia and setHeroMedia", () => {
    expect(src).toContain("getHeroMedia");
    expect(src).toContain("setHeroMedia");
  });

  it("accepts getMpState", () => {
    expect(src).toContain("getMpState");
  });

  it("accepts closeComputer", () => {
    expect(src).toContain("closeComputer");
  });

  it("accepts setGameMode", () => {
    expect(src).toContain("setGameMode");
  });

  it("accepts setFirstLaunch", () => {
    expect(src).toContain("setFirstLaunch");
  });
});

describe("computerOverlay click delegation", () => {
  it("listens on computerOverlay", () => {
    expect(src).toContain('"computerOverlay"');
  });

  it("handles computerClose button", () => {
    expect(src).toContain('"computerClose"');
    expect(src).toContain("closeComputer()");
  });

  it("handles insert media action", () => {
    expect(src).toContain('"insert"');
    expect(src).toContain("insertMedia");
  });

  it("handles eject media action", () => {
    expect(src).toContain('"eject"');
    expect(src).toContain("ejectMedia");
  });

  it("handles join-server action", () => {
    expect(src).toContain('"join-server"');
    expect(src).toContain("window.location.href");
  });

  it("handles friend-request action", () => {
    expect(src).toContain('"friend-request"');
    expect(src).toContain("/api/friend_request");
  });

  it("handles accept-friend action", () => {
    expect(src).toContain('"accept-friend"');
    expect(src).toContain("/api/friend_accept");
  });

  it("handles set-mode action", () => {
    expect(src).toContain("set-mode");
    expect(src).toContain("setGameMode(mode)");
  });

  it("opens apps in window pane", () => {
    expect(src).toContain('"appHome"');
    expect(src).toContain('"appTitle"');
    expect(src).toContain('"appBody"');
    expect(src).toContain('"appWindow"');
  });
});

describe("wireRadioApp", () => {
  it("wires rfSend button", () => {
    expect(src).toContain('"rfSend"');
    expect(src).toContain("wireRadioApp");
  });

  it("calls deviceBus send on radioA", () => {
    expect(src).toContain('"radioA"');
    expect(src).toContain('"rf"');
  });
});

describe("wireServersApp", () => {
  it("wires serverScanBtn", () => {
    expect(src).toContain('"serverScanBtn"');
  });

  it("fetches /scan endpoint", () => {
    expect(src).toContain('"/scan"');
  });

  it("renders join and friend buttons", () => {
    expect(src).toContain("join-server");
    expect(src).toContain("friend-request");
  });
});

describe("wireFriendsApp", () => {
  it("fetches /api/friends", () => {
    expect(src).toContain('"/api/friends"');
  });

  it("wires friendRefreshBtn", () => {
    expect(src).toContain('"friendRefreshBtn"');
  });

  it("syncs pending friend requests from server", () => {
    expect(src).toContain("pendingFriendRequests");
  });
});

describe("game mode handler", () => {
  it("emits GAME_MODE_CHANGED event", () => {
    expect(src).toContain('"GAME_MODE_CHANGED"');
  });

  it("shows difficultyScreen for non-peaceful modes", () => {
    expect(src).toContain('"difficultyScreen"');
    expect(src).toContain('"peaceful"');
  });
});
