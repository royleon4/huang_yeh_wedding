import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { adminAccordionUiTransform } from "../admin-accordion-ui-transform.mjs";
import { adminPhotoWorkspaceUiTransform } from "../admin-photo-workspace-ui-transform.mjs";
import { guestLabelsUiTransform } from "../guest-labels-ui-transform.mjs";
import { logicalRouteUiTransform } from "../logical-route-ui-transform.mjs";
import { processContentUiTransform } from "../process-content-ui-transform.mjs";
import { publicBootstrapUiTransform } from "../public-bootstrap-ui-transform.mjs";
import { websiteCopyUiTransform } from "../website-copy-ui-transform.mjs";
import {
  LATEST_GUEST_FILTER_ID,
  filterPhotos,
  guestUploaderGroups,
} from "../src/client/gallery-model.mjs";
import { normalizePublicSettings } from "../src/client/public-bootstrap.mjs";
import {
  mergeGuestUploaderLabelOrder,
  normalizeGuestLabelVisibilitySettings,
  normalizeGuestLatestPhotoCount,
  normalizeGuestUploaderLabelOrder,
} from "../src/guest-label-settings.mjs";

const photos = [
  {
    id: "old-a",
    source: "guest",
    uploaderName: "小安",
    albumIds: ["guest"],
    processIds: [],
    createdAt: "2026-06-01T00:00:00.000Z",
  },
  {
    id: "new-b",
    source: "guest",
    uploaderName: "阿慧",
    albumIds: ["guest"],
    processIds: [],
    createdAt: "2026-07-03T00:00:00.000Z",
  },
  {
    id: "newest-c",
    source: "guest",
    uploaderName: "新朋友",
    albumIds: ["guest"],
    processIds: [],
    createdAt: "2026-07-04T00:00:00.000Z",
  },
];

function run(plugin, source, id) {
  return plugin.transform(source, id)?.code ?? source;
}

test("saved guest label order stays authoritative and new names append", () => {
  assert.deepEqual(
    mergeGuestUploaderLabelOrder(
      ["阿慧", "小安"],
      ["小安", "阿慧", "新朋友"],
    ),
    ["阿慧", "小安", "新朋友"],
  );
  assert.deepEqual(
    guestUploaderGroups(photos, ["阿慧", "小安"]),
    [
      { id: "阿慧", name: "阿慧", count: 1 },
      { id: "小安", name: "小安", count: 1 },
      { id: "新朋友", name: "新朋友", count: 1 },
    ],
  );
  assert.deepEqual(normalizeGuestUploaderLabelOrder([" 小安 ", "小安", "阿慧"]), [
    "小安",
    "阿慧",
  ]);
});

test("latest guest label returns the configured newest photos", () => {
  const many = Array.from({ length: 55 }, (_, index) => ({
    id: `photo-${index}`,
    source: "guest",
    uploaderName: "訪客",
    albumIds: ["guest"],
    processIds: [],
    createdAt: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
  }));
  const latest = filterPhotos(many, LATEST_GUEST_FILTER_ID, "guest", {
    latestGuestPhotoCount: 30,
  });
  assert.equal(latest.length, 30);
  assert.equal(latest[0].id, "photo-54");
  assert.equal(latest.at(-1).id, "photo-25");
  assert.equal(normalizeGuestLatestPhotoCount(49), 49);
  assert.equal(normalizeGuestLatestPhotoCount(51), 40);
});

test("public bootstrap normalizes three guest label visibility settings before first render", () => {
  const settings = normalizePublicSettings({
    guestLatestPhotosLabelVisible: false,
    guestAllVisitorsLabelVisible: true,
    guestNameLabelsVisible: false,
    guestUploaderLabelOrder: ["阿慧", "小安"],
    guestLatestPhotoCount: 35,
  });
  assert.equal(settings.guestLatestPhotosLabelVisible, false);
  assert.equal(settings.guestAllVisitorsLabelVisible, true);
  assert.equal(settings.guestNameLabelsVisible, false);
  assert.deepEqual(settings.guestUploaderLabelOrder, ["阿慧", "小安"]);
  assert.equal(settings.guestLatestPhotoCount, 35);

  assert.deepEqual(
    normalizeGuestLabelVisibilitySettings({ guestUploaderLabelsVisible: false }),
    {
      guestLatestPhotosLabelVisible: false,
      guestAllVisitorsLabelVisible: false,
      guestNameLabelsVisible: false,
    },
    "the previous one-checkbox setting remains a fallback for saved deployments",
  );
});

test("administrator exposes exactly three guest label visibility checkboxes", async () => {
  const [general, component, css, repository, api, adminSource] = await Promise.all([
    readFile(new URL("../src/client/GeneralSettings.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/client/GuestLabelSettings.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/client/guest-label-settings.css", import.meta.url), "utf8"),
    readFile(
      new URL("../src/server/settings/repository.mjs", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../src/server/settings/api.mjs", import.meta.url), "utf8"),
    readFile(new URL("../src/client/AdminApp.jsx", import.meta.url), "utf8"),
  ]);

  let admin = run(
    adminAccordionUiTransform(),
    adminSource,
    "/workspace/src/client/AdminApp.jsx",
  );
  admin = run(
    guestLabelsUiTransform(),
    admin,
    "/workspace/src/client/AdminApp.jsx",
  );

  assert.doesNotMatch(general, /GuestLabelSettings/);
  assert.match(admin, /album\.id === "guest"/);
  assert.match(admin, /訪客相簿標籤/);
  assert.match(admin, /admin-guest-label-accordion/);
  assert.doesNotMatch(
    admin,
    /<details className="admin-accordion admin-guest-label-accordion" open/,
  );
  assert.equal(
    [...component.matchAll(/type="checkbox"/g)].length,
    3,
    "the block must contain exactly the three requested checkboxes",
  );
  assert.match(component, /顯示最新照片標籤/);
  assert.match(component, /顯示所有訪客標籤/);
  assert.match(component, /顯示姓名標籤/);
  assert.match(component, /guestLatestPhotosLabelVisible/);
  assert.match(component, /guestAllVisitorsLabelVisible/);
  assert.match(component, /guestNameLabelsVisible/);
  assert.match(component, /guestUploaderLabelOrder/);
  assert.match(component, /guestLatestPhotoCount/);
  assert.match(component, /draggable=\{!saving\}/);
  assert.match(component, /onDragStart|onDrop/);
  assert.match(component, /useAdminSaveSection\("guest-uploader-labels"/);
  assert.match(css, /grid-template-columns:\s*minmax\(0, 1\.4fr\)/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(repository, /guest_latest_photos_label_visible/);
  assert.match(repository, /guest_all_visitors_label_visible/);
  assert.match(repository, /guest_name_labels_visible/);
  assert.match(repository, /ORDER BY MIN\(p\.created_at\) ASC/);
  assert.match(repository, /mergeGuestUploaderLabelOrder/);
  assert.match(api, /setGuestLatestPhotosLabelVisible/);
  assert.match(api, /setGuestAllVisitorsLabelVisible/);
  assert.match(api, /setGuestNameLabelsVisible/);
  assert.match(api, /isValidGuestUploaderLabelOrder/);
  assert.match(api, /MIN_GUEST_LATEST_PHOTO_COUNT/);
});

test("production gallery independently includes latest all-visitor and name labels", async () => {
  const id = "/workspace/src/client/App.jsx";
  let code = await readFile(new URL("../src/client/App.jsx", import.meta.url), "utf8");
  code = run(processContentUiTransform(), code, id);
  code = run(adminPhotoWorkspaceUiTransform(), code, id);
  code = run(logicalRouteUiTransform(), code, id);
  code = run(websiteCopyUiTransform(), code, id);
  code = run(publicBootstrapUiTransform(), code, id);
  code = run(guestLabelsUiTransform(), code, id);

  assert.match(code, /guestLatestPhotosLabelVisible/);
  assert.match(code, /guestAllVisitorsLabelVisible/);
  assert.match(code, /guestNameLabelsVisible/);
  assert.match(code, /guestUploaderLabelOrder/);
  assert.match(code, /LATEST_GUEST_FILTER_ID/);
  assert.match(code, /Latest photos/);
  assert.match(code, /effectiveFilter/);
  assert.match(code, /activeGuestFilterVisible/);
  assert.match(code, /latestGuestPhotoCount: guestLatestPhotoCount/);
  assert.match(code, /guestAllVisitorsLabelVisible\s*\? \[/);
  assert.match(code, /guestLatestPhotosLabelVisible\s*\? \[/);
  assert.match(code, /guestNameLabelsVisible\s*\? guestGroups\.map/);
  assert.doesNotMatch(code, /guestUploaderLabelsVisible/);
});

test("production build copies the shared guest label settings module", async () => {
  const build = await readFile(new URL("../scripts/build.mjs", import.meta.url), "utf8");
  assert.match(
    build,
    /cp\("src\/guest-label-settings\.mjs", "dist\/guest-label-settings\.mjs"\)/,
  );
});
