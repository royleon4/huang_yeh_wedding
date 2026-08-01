import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { transformProgressivePhotoLoading } from "../progressive-photo-loading-ui-transform.mjs";

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, "..");
const appPath = path.join(root, "src/client/App.jsx");
const viteConfigPath = path.join(root, "vite.config.js");

test("gallery publishes two photo pages before continuing during idle time", async () => {
  const source = await readFile(appPath, "utf8");
  const transformed = transformProgressivePhotoLoading(source);

  assert.match(transformed, /const INITIAL_PAGE_COUNT = 2/);
  assert.match(
    transformed,
    /const query = new URLSearchParams\(\{ limit: "100" \}\)/,
  );
  assert.match(transformed, /while \(hasMore && pages < INITIAL_PAGE_COUNT\)/);
  assert.match(transformed, /initialPhotos\.then\(\(photos\) =>/);
  assert.match(transformed, /return continueLoading\(\(nextPhotos\) =>/);
  assert.match(transformed, /window\.requestIdleCallback\(finish, \{ timeout: 750 \}\)/);
  assert.match(transformed, /cancelPhotoLoad\(\)/);
  assert.doesNotMatch(transformed, /do \{[\s\S]*pages < 20/);
});

test("background failure keeps the initial gallery and abort is not shown as an error", async () => {
  const source = await readFile(appPath, "utf8");
  const transformed = transformProgressivePhotoLoading(source);

  assert.match(transformed, /initialPhotoWindowDelivered = true/);
  assert.match(transformed, /error\?\.name === "AbortError"/);
  assert.match(
    transformed,
    /if \(!initialPhotoWindowDelivered && !useMockFallback\)/,
  );
  assert.match(transformed, /localOnly\.length > 0/);
});

test("production runs progressive loading before transforms that rewrite the gallery", async () => {
  const config = await readFile(viteConfigPath, "utf8");
  const progressiveIndex = config.indexOf("progressivePhotoLoadingUiTransform(),");
  const processIndex = config.indexOf("processContentUiTransform(),");
  const workspaceIndex = config.indexOf("adminPhotoWorkspaceUiTransform(),");

  assert.ok(progressiveIndex >= 0);
  assert.ok(processIndex > progressiveIndex);
  assert.ok(workspaceIndex > progressiveIndex);
});

test("transform refuses silently drifting source contracts", () => {
  assert.throws(
    () => transformProgressivePhotoLoading("export default function App() {}"),
    /could not find legacy all-photo request loop/,
  );
});
