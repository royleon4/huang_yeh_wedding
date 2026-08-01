import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { adminPhotoWorkspaceUiTransform } from "../admin-photo-workspace-ui-transform.mjs";
import { logicalRouteUiTransform } from "../logical-route-ui-transform.mjs";
import { processContentUiTransform } from "../process-content-ui-transform.mjs";
import {
  progressivePhotoLoadingUiTransform,
  transformProgressivePhotoLoading,
} from "../progressive-photo-loading-ui-transform.mjs";
import { publicBootstrapUiTransform } from "../public-bootstrap-ui-transform.mjs";
import { websiteCopyUiTransform } from "../website-copy-ui-transform.mjs";

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, "..");
const appPath = path.join(root, "src/client/App.jsx");

function run(plugin, code, relativePath = "src/client/App.jsx") {
  const id = path.join(root, relativePath);
  return plugin.transform(code, id)?.code ?? code;
}

test("gallery publishes two photo pages before continuing during idle time", async () => {
  const source = await readFile(appPath, "utf8");
  const transformed = transformProgressivePhotoLoading(source);

  assert.match(transformed, /const INITIAL_PAGE_COUNT = 2/);
  assert.match(transformed, /const PAGE_LIMIT = 100/);
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

test("progressive loading remains compatible with the production transform chain", async () => {
  let app = await readFile(appPath, "utf8");
  app = run(progressivePhotoLoadingUiTransform(), app);
  app = run(processContentUiTransform(), app);
  app = run(adminPhotoWorkspaceUiTransform(), app);
  app = run(logicalRouteUiTransform(), app);
  app = run(websiteCopyUiTransform(), app);
  app = run(publicBootstrapUiTransform(), app);

  assert.match(app, /const initialPublicBootstrap = getPublicBootstrap\(\)/);
  assert.match(app, /const INITIAL_PAGE_COUNT = 2/);
  assert.match(app, /void fetchAllPhotos\(\)/);
  assert.doesNotMatch(app, /void fetchAlbums\(\)/);
});

test("transform refuses silently drifting source contracts", () => {
  assert.throws(
    () => transformProgressivePhotoLoading("export default function App() {}"),
    /could not find legacy all-photo request loop/,
  );
});
