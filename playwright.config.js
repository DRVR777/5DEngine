import { defineConfig } from "@playwright/test";

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
      args: [
        "--use-gl=swiftshader",
        "--enable-webgl",
        "--disable-gpu-vsync",
        "--disable-frame-rate-limit",
        "--disable-background-timer-throttling",
        "--disable-dev-shm-usage",
        "--js-flags=--max-old-space-size=256",
      ],
    },
  },
  webServer: {
    command: "node game_server.js 8080",
    port: 8080,
    reuseExistingServer: true,
    timeout: 30000,
  },
});
