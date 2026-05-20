import { defineConfig } from "@playwright/test";

const visualMode = process.env.PW_VISUAL === "1" || process.env.PW_WEBGL === "1";
const baseLaunchArgs = [
  "--disable-gpu",
  "--disable-dev-shm-usage",
  "--disable-background-network-throttling",
  "--js-flags=--max-old-space-size=256",
];
const visualLaunchArgs = [
  "--use-gl=swiftshader",
  "--enable-webgl",
  "--disable-gpu-vsync",
  "--disable-frame-rate-limit",
];

export default defineConfig({
  testDir: "tests/playwright",
  timeout: 300000,
  workers: 1,
  retries: 0,
  use: {
    baseURL: "http://localhost:8080",
    headless: process.env.HEADED ? false : true,
    viewport: { width: Number(process.env.PW_WIDTH || 640), height: Number(process.env.PW_HEIGHT || 360) },
    screenshot: "only-on-failure",
    video: process.env.PW_VIDEO ? "retain-on-failure" : "off",
    trace: process.env.PW_TRACE ? "retain-on-failure" : "off",
    launchOptions: {
      args: visualMode ? [...baseLaunchArgs, ...visualLaunchArgs] : baseLaunchArgs,
    },
  },
  webServer: {
    command: "node game_server.js 8080",
    port: 8080,
    reuseExistingServer: true,
    timeout: 30000,
  },
});
