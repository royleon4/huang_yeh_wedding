import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const configUrl = new URL("../playwright.config.mjs", import.meta.url);
const specUrl = new URL(
  "../e2e/cross-browser-layout.spec.mjs",
  import.meta.url,
);
const workflowUrl = new URL(
  "../../../.github/workflows/memories-cross-browser.yml",
  import.meta.url,
);

test("cross-browser gate covers requested browser and in-app representatives", async () => {
  const config = await readFile(configUrl, "utf8");

  for (const project of [
    "chromium-desktop",
    "firefox-desktop",
    "webkit-desktop",
    "chromium-mobile",
    "webkit-mobile",
    "samsung-internet-android",
    "wechat-android",
    "wechat-ios",
    "line-android",
    "line-ios",
    "facebook-android",
    "facebook-ios",
    "instagram-android",
    "instagram-ios",
  ]) {
    assert.match(config, new RegExp(`name: "${project}"`));
  }
  assert.match(config, /Desktop Chrome/);
  assert.match(config, /Desktop Firefox/);
  assert.match(config, /Desktop Safari/);
  assert.match(config, /Pixel 7/);
  assert.match(config, /iPhone 13/);
  assert.match(config, /SamsungBrowser/);
  assert.match(config, /MicroMessenger/);
  assert.match(config, /Line\//);
  assert.match(config, /FBAN\/FB4A/);
  assert.match(config, /FBAN\/FBIOS/);
  assert.match(config, /Instagram/);
  assert.match(config, /MEMORIES_ADMIN_TOKEN=/);
  assert.match(config, /pnpm run start/);
});

test("layout specification checks visible viewport geometry and overflow", async () => {
  const spec = await readFile(specUrl, "utf8");

  assert.match(spec, /position\)\.toBe\("fixed"\)/);
  assert.match(spec, /after\.bottom - after\.viewportHeight/);
  assert.match(spec, /window\.scrollTo\(0, document\.documentElement\.scrollHeight\)/);
  assert.match(spec, /width: 700, height: 900/);
  assert.match(spec, /width: 720, height: 900/);
  assert.match(spec, /position\)\.toBe\("sticky"\)/);
  assert.match(spec, /expectNoHorizontalOverflow/);
  assert.match(spec, /process-video-block iframe/);
  assert.match(spec, /message-album/);
  assert.match(spec, /page\.locator\("\.admin-tabs"\)/);
  assert.match(spec, /Memories\/admin\/api\/session/);
});

test("heavy browser gate runs outside Draft commit validation", async () => {
  const workflow = await readFile(workflowUrl, "utf8");

  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /schedule:/);
  assert.match(workflow, /branches: \[main\]/);
  assert.match(
    workflow,
    /github\.event_name != 'pull_request' \|\| github\.event\.pull_request\.draft == false/,
  );
  assert.match(workflow, /@playwright\/test@1\.60\.0/);
  assert.match(workflow, /chromium firefox webkit/);
  assert.match(workflow, /cancel-in-progress: true/);
});
