import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.MEMORIES_E2E_PORT || 19317);
const baseURL = `http://127.0.0.1:${port}`;

export const crossBrowserAdminToken = "cross-browser-layout-token";

const androidChrome = devices["Pixel 7"];
const iPhoneSafari = devices["iPhone 13"];

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
      use: { ...androidChrome },
    },
    {
      name: "webkit-mobile",
      use: { ...iPhoneSafari },
    },
    {
      name: "samsung-internet-android",
      use: {
        ...androidChrome,
        userAgent:
          "Mozilla/5.0 (Linux; Android 15; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/28.0 Chrome/130.0.0.0 Mobile Safari/537.36",
      },
    },
    {
      name: "wechat-android",
      use: {
        ...androidChrome,
        userAgent:
          "Mozilla/5.0 (Linux; Android 16; Pixel 7 Build/BP2A.250805.005) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/140.0.0.0 Mobile Safari/537.36 MicroMessenger/8.0.50.2800(0x2800323A) Process/tools WeChat/arm64 Weixin NetType/WIFI Language/zh_TW ABI/arm64",
      },
    },
    {
      name: "wechat-ios",
      use: {
        ...iPhoneSafari,
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/22G86 MicroMessenger/8.0.50 NetType/WIFI Language/zh_TW",
      },
    },
    {
      name: "line-android",
      use: {
        ...androidChrome,
        userAgent:
          "Mozilla/5.0 (Linux; Android 15; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36 Line/14.21.1",
      },
    },
    {
      name: "line-ios",
      use: {
        ...iPhoneSafari,
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/22G86 Line/14.21.1",
      },
    },
    {
      name: "facebook-android",
      use: {
        ...androidChrome,
        userAgent:
          "Mozilla/5.0 (Linux; Android 15; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.0.0 Mobile Safari/537.36 [FBAN/FB4A;FBAV/500.0.0.0.0;]",
      },
    },
    {
      name: "facebook-ios",
      use: {
        ...iPhoneSafari,
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/22G86 [FBAN/FBIOS;FBAV/500.0.0.0.0;]",
      },
    },
    {
      name: "instagram-android",
      use: {
        ...androidChrome,
        userAgent:
          "Mozilla/5.0 (Linux; Android 15; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36 Instagram 350.0.0.0.0 Android",
      },
    },
    {
      name: "instagram-ios",
      use: {
        ...iPhoneSafari,
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/22G86 Instagram 350.0.0.0.0",
      },
    },
  ],
  webServer: {
    command: `MEMORIES_ADMIN_TOKEN=${crossBrowserAdminToken} PORT=${port} pnpm run start`,
    url: `${baseURL}/Memories/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
