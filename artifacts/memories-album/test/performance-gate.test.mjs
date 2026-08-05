import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const mainUrl = new URL("../src/client/main.jsx", import.meta.url);
const monitorUrl = new URL(
  "../src/client/performance-monitor.mjs",
  import.meta.url,
);
const photoFeedUrl = new URL(
  "../src/client/public-photo-feed.mjs",
  import.meta.url,
);
const viteUrl = new URL("../vite.routes.config.js", import.meta.url);
const packageUrl = new URL("../package.json", import.meta.url);
const analyzerUrl = new URL("../scripts/analyze-bundle.mjs", import.meta.url);

test("private surfaces are split from the public entry without adding DOM wrappers", async () => {
  const main = await readFile(mainUrl, "utf8");

  assert.doesNotMatch(main, /import AdminApp from/);
  assert.doesNotMatch(main, /import AdminLoginPage from/);
  assert.doesNotMatch(main, /import BatchManagementPage from/);
  assert.match(main, /lazy\(\(\) => import\("\.\/AdminApp\.jsx"\)\)/);
  assert.match(main, /lazy\(\(\) => import\("\.\/AdminLoginPage\.jsx"\)\)/);
  assert.match(main, /import\("\.\/BatchManagementPage\.jsx"\)/);
  assert.match(main, /<Suspense fallback=\{null\}>/);
});

test("native performance diagnostics cover LCP CLS INP and navigation timing", async () => {
  const monitor = await readFile(monitorUrl, "utf8");

  assert.match(monitor, /largest-contentful-paint/);
  assert.match(monitor, /layout-shift/);
  assert.match(monitor, /interactionId/);
  assert.match(monitor, /__MEMORIES_WEB_VITALS__/);
  assert.match(monitor, /domContentLoadedEventEnd/);
  assert.match(monitor, /transferSize/);
});

test("public feed uses a small first page and yields before background pages", async () => {
  const photoFeed = await readFile(photoFeedUrl, "utf8");

  assert.match(photoFeed, /PUBLIC_PHOTO_PAGE_LIMIT = 24/);
  assert.match(photoFeed, /requestIdleCallback/);
  assert.match(photoFeed, /onInitialPage/);
  assert.match(photoFeed, /onPage/);
  assert.match(photoFeed, /await yieldImpl\(\{ signal \}\)/);
});

test("production builds emit and enforce bundle evidence", async () => {
  const [vite, packageJson, analyzer] = await Promise.all([
    readFile(viteUrl, "utf8"),
    readFile(packageUrl, "utf8"),
    readFile(analyzerUrl, "utf8"),
  ]);

  assert.match(vite, /manifest: true/);
  assert.match(packageJson, /analyze-bundle\.mjs --check/);
  assert.match(analyzer, /entryGzipBytes/);
  assert.match(analyzer, /largestChunkGzipBytes/);
  assert.match(analyzer, /totalJavaScriptGzipBytes/);
  assert.match(analyzer, /AdminApp\.jsx/);
  assert.match(analyzer, /bundle-report\.json/);
});
