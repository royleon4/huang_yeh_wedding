import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { adminPhotoWorkspaceUiTransform } from "../admin-photo-workspace-ui-transform.mjs";
import { logicalRouteUiTransform } from "../logical-route-ui-transform.mjs";
import { processContentUiTransform } from "../process-content-ui-transform.mjs";
import { publicBootstrapUiTransform } from "../public-bootstrap-ui-transform.mjs";
import { websiteCopyUiTransform } from "../website-copy-ui-transform.mjs";

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, "..");

async function source(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

function run(plugin, code, relativePath) {
  const id = path.join(root, relativePath);
  return plugin.transform(code, id)?.code ?? code;
}

test("public application waits for one shared bootstrap before first React render", async () => {
  let main = await source("src/client/main.jsx");
  main = run(logicalRouteUiTransform(), main, "src/client/main.jsx");
  main = run(publicBootstrapUiTransform(), main, "src/client/main.jsx");

  assert.match(main, /await loadPublicBootstrap\(\)/);
  assert.match(main, /applyServerProcesses\(bootstrap\.processes, bootstrap\.allProcess\)/);
  assert.match(main, /surface === "memories"/);
  assert.match(main, /void renderApplication\(\)/);
  assert.doesNotMatch(main, /hydrateProcessesFromServer/);
  assert.doesNotMatch(main, /useEffect|useState/);
});

test("public gallery first render uses edited albums, copy, and settings", async () => {
  let app = await source("src/client/App.jsx");
  app = run(processContentUiTransform(), app, "src/client/App.jsx");
  app = run(adminPhotoWorkspaceUiTransform(), app, "src/client/App.jsx");
  app = run(logicalRouteUiTransform(), app, "src/client/App.jsx");
  app = run(websiteCopyUiTransform(), app, "src/client/App.jsx");
  app = run(publicBootstrapUiTransform(), app, "src/client/App.jsx");

  assert.match(app, /const initialPublicBootstrap = getPublicBootstrap\(\)/);
  assert.match(app, /initialPublicBootstrap\.albums/);
  assert.match(app, /initialPublicBootstrap\.settings\.siteCopy/);
  assert.match(app, /initialPublicBootstrap\.settings\.galleryMediaOrder/);
  assert.match(app, /initialPublicBootstrap\.settings\.pinnedPhotoIdsByProcess/);
  assert.match(app, /const albumsResolved = true/);
  assert.doesNotMatch(app, /fetchAlbums/);
  assert.doesNotMatch(app, /fetch\("\/Memories\/api\/settings"/);
  assert.doesNotMatch(app, /setSiteCopy|setGalleryMediaOrder|setPinnedPhotoIdsByProcess/);
});

test("selector and upload modal reuse bootstrap instead of refetching settings", async () => {
  const plugin = publicBootstrapUiTransform();
  const selector = run(
    plugin,
    await source("src/client/ProcessSelector.jsx"),
    "src/client/ProcessSelector.jsx",
  );
  const upload = run(
    plugin,
    await source("src/client/UploadModal.jsx"),
    "src/client/UploadModal.jsx",
  );

  assert.match(selector, /getPublicBootstrap\(\)\.settings/);
  assert.doesNotMatch(selector, /settingsPromise|processSelectorSettings|api\/settings/);
  assert.doesNotMatch(selector, /useEffect|useState/);

  assert.match(upload, /const publicBootstrap = getPublicBootstrap\(\)/);
  assert.match(upload, /publicBootstrap\.settings\.guestUploadCategorySelectionEnabled/);
  assert.match(upload, /normalizeProcesses\(publicBootstrap\.processes\)/);
  assert.doesNotMatch(upload, /Promise\.all/);
  assert.doesNotMatch(upload, /api\/settings|api\/processes/);
});

test("production Vite route chain enables bootstrap after existing compatibility transforms", async () => {
  const config = await source("vite.routes.config.js");
  assert.match(config, /publicBootstrapUiTransform/);
  assert.match(
    config,
    /publicLayoutPolishUiTransform\(\),\s*publicBootstrapUiTransform\(\)/,
  );
});
