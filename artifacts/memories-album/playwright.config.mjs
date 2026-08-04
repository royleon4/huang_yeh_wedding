import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.MEMORIES_E2E_PORT || 19317);
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./test-results/cross-browser",
  timeout: 60_000,
  expect: { timeout: 12_000 },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ["line"],
    ["html", { outputFolder: "cross-browser-report", open: "never" }],
  ],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium-desktop",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox-desktop",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit-desktop",
      use: { ...devices["Desktop Safari"] },
    },
    {
      name: "chromium-mobile",
      use: { ...devices["Pixel 7"] },
    },
    {
      name: "webkit-mobile",
      use: { ...devices["iPhone 13"] },
    },
    {
      name: "wechat-android",
      use: {
        ...devices["Pixel 7"],
        userAgent:
          "Mozilla/5.0 (Linux; Android 16; Pixel 7 Build/BP2A.250805.005) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/140.0.0.0 Mobile Safari/537.36 MicroMessenger/8.0.50.2800(0x2800323A) Process/tools WeChat/arm64 Weixin NetType/WIFI Language/zh_TW ABI/arm64",
      },
    },
  ],
  webServer: {
    command: `PORT=${port} pnpm run start`,
    url: `${baseURL}/Memories/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
