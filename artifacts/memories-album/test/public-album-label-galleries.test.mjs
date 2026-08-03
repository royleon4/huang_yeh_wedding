import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { logicalRouteUiTransform } from "../logical-route-ui-transform.mjs";
import { processContentUiTransform } from "../process-content-ui-transform.mjs";
import { publicAlbumLabelsUiTransform } from "../public-album-labels-ui-transform.mjs";
import {
  allAlbumLabel,
  filterPhotosByAlbumLabel,
  labelsForAlbum,
} from "../src/client/public-album-labels.mjs";
import { createProcessApi } from "../src/server/processes/api.mjs";

async function withApi(api, run) {
  const server = createServer(async (request, response) => {
    if (await api(request, response)) return;
    response.statusCode = 404;
    response.end();
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

test("public labels are grouped by owning album and preserve display order", () => {
  const labels = [
    { id: "life-2", albumId: "life", displayOrder: 2 },
    { id: "wedding-1", albumId: "wedding", displayOrder: 1 },
    { id: "life-1", albumId: "life", displayOrder: 1 },
    { id: "legacy-wedding", displayOrder: 2 },
  ];
  assert.deepEqual(
    labelsForAlbum(labels, "life").map((label) => label.id),
    ["life-1", "life-2"],
  );
  assert.deepEqual(
    labelsForAlbum(labels, "wedding").map((label) => label.id),
    ["wedding-1", "legacy-wedding"],
  );
});

test("the first virtual label is generated from the current album name", () => {
  const album = { zh: "生活照", en: "Life photos" };
  assert.equal(allAlbumLabel(album, "zh"), "全部生活照");
  assert.equal(allAlbumLabel(album, "en"), "All Life photos");
});

test("non-guest album labels filter photos by label membership", () => {
  const photos = [
    { id: "a", processIds: ["daily"] },
    { id: "b", processIds: ["travel"] },
    { id: "c", processIds: [] },
  ];
  assert.deepEqual(
    filterPhotosByAlbumLabel(photos, "travel", "life").map((photo) => photo.id),
    ["b"],
  );
  assert.deepEqual(
    filterPhotosByAlbumLabel(photos, "all", "life").map((photo) => photo.id),
    ["a", "b", "c"],
  );
  assert.deepEqual(
    filterPhotosByAlbumLabel(photos, "someone", "guest").map((photo) => photo.id),
    ["a", "b", "c"],
  );
});

test("public process API returns labels from every album with album ownership", async () => {
  let legacyCalled = false;
  const api = createProcessApi({
    repository: {
      async listLabels() {
        return [
          {
            id: "ceremony",
            albumId: "wedding",
            labelZh: "證婚",
            labelEn: "Ceremony",
            displayOrder: 1,
          },
          {
            id: "travel",
            albumId: "life",
            labelZh: "旅行",
            labelEn: "Trips",
            displayOrder: 1,
          },
        ];
      },
      async listProcesses() {
        legacyCalled = true;
        return [];
      },
    },
  });

  await withApi(api, async (origin) => {
    const response = await fetch(`${origin}/Memories/api/processes`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(
      body.processes.map((label) => [label.id, label.albumId]),
      [
        ["ceremony", "wedding"],
        ["travel", "life"],
      ],
    );
    assert.equal(legacyCalled, false);
  });
});

test("public transform renders grouped album labels and route subgroups", async () => {
  const appPath = new URL("../src/client/App.jsx", import.meta.url);
  const mainPath = new URL("../src/client/main.jsx", import.meta.url);
  const appSource = await readFile(appPath, "utf8");
  const mainSource = await readFile(mainPath, "utf8");

  const processTransform = processContentUiTransform();
  const labelTransform = publicAlbumLabelsUiTransform();
  const routeTransform = logicalRouteUiTransform();

  const processApp = processTransform.transform(appSource, appPath.pathname).code;
  const labeledApp = labelTransform.transform(processApp, appPath.pathname).code;

  assert.match(labeledApp, /const activeLabels = labelsForAlbum\(processes, activeCollection\)/);
  assert.match(labeledApp, /const activeAllLabel = allAlbumLabel\(activeCollectionDefinition, lang\)/);
  assert.match(labeledApp, /activeCollection !== "guest" && activeLabels\.length > 0/);
  assert.match(labeledApp, /\{ id: "all", number: "00", label: activeAllLabel \}/);
  assert.match(labeledApp, /filterPhotosByAlbumLabel\(/);

  const routedApp = routeTransform.transform(labeledApp, appPath.pathname).code;
  const routedLabels = labelTransform.transform(routedApp, appPath.pathname).code;
  assert.match(
    routedLabels,
    /if \(collectionId === "guest"\) return guestGroups;[\s\S]*return labelsForAlbum\(processes, collectionId\);/,
  );

  const labeledMain = labelTransform.transform(mainSource, mainPath.pathname).code;
  assert.match(labeledMain, /albumId: process\.albumId \?\? "wedding"/);
  assert.match(labeledMain, /left\.albumId\.localeCompare\(right\.albumId\)/);
});

test("public label transforms run after photo ordering without changing copy order", async () => {
  const baseConfig = await readFile(new URL("../vite.config.js", import.meta.url), "utf8");
  const routeConfig = await readFile(
    new URL("../vite.routes.config.js", import.meta.url),
    "utf8",
  );

  assert.match(
    baseConfig,
    /adminPhotoWorkspaceUiTransform\(\),\s*publicAlbumLabelsUiTransform\(\)/,
  );
  assert.match(
    routeConfig,
    /logicalRouteUiTransform\(\),\s*websiteCopyUiTransform\(\),\s*publicAlbumLabelsUiTransform\(\)/,
  );
});
