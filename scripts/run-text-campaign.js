// Cross-platform launcher for the text-only Playwright campaign.
// It keeps Chromium as small as possible: no video, no trace, no screenshots,
// no WebGL flags unless PW_VISUAL=1 or PW_WEBGL=1 is explicitly set.

import { spawnSync } from "node:child_process";

const wavesArg = process.argv.find(arg => arg.startsWith("--waves="));
const maxMsArg = process.argv.find(arg => arg.startsWith("--max-ms="));

const env = {
  ...process.env,
  CAMPAIGN_WAVES: wavesArg ? wavesArg.split("=")[1] : process.env.CAMPAIGN_WAVES || "3",
  CAMPAIGN_MAX_MS: maxMsArg ? maxMsArg.split("=")[1] : process.env.CAMPAIGN_MAX_MS || "120000",
  CAMPAIGN_SHOT_WAIT_MS: process.env.CAMPAIGN_SHOT_WAIT_MS || "80",
  CAMPAIGN_WAVE_WAIT_MS: process.env.CAMPAIGN_WAVE_WAIT_MS || "150",
  PW_WIDTH: process.env.PW_WIDTH || "1",
  PW_HEIGHT: process.env.PW_HEIGHT || "1",
  PW_VIDEO: "",
  PW_TRACE: "",
  PW_VISUAL: process.env.PW_VISUAL || "",
  PW_WEBGL: process.env.PW_WEBGL || "",
};

const result = spawnSync(
  "npx",
  ["playwright", "test", "tests/playwright/text_wave_campaign.spec.js", "--workers=1"],
  { stdio: "inherit", shell: true, env }
);

process.exit(result.status ?? 1);
