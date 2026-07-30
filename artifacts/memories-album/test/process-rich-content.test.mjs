import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  ALL_PROCESS_DEFINITION,
  filterPhotos,
} from "../src/client/gallery-model.mjs";
import { createProcessApi } from "../src/server/processes/api.mjs";
import { processContentUiTransform } from "../process-content-ui-transform.mjs";

function jsonResponse() {
  return {
    status: null,
    headers: null,
    body: null,
    writeHead(status, headers) {
      this.status = status;
      this.headers = headers;
    },
    end(body) {
      this.body = body;
    },
  };
}

test("all-process photo visibility can suppress wedding photos", () => {
  const previous = ALL_PROCESS_DEFINITION.showAllPhotos;
  const photos = [
    { id: "a", albumIds: ["wedding"], processIds: [] },
    { id: "b", albumIds: ["wedding"], processIds: ["vows"] },
  ];
  try {
    ALL_PROCESS_DEFINITION.showAllPhotos = true;
    assert.deepEqual(
      filterPhotos(photos, "all", "wedding").map((photo) => photo.id),
      ["a", "b"],
    );
    ALL_PROCESS_DEFINITION.showAllPhotos = false;
    assert.deepEqual(filterPhotos(photos, "all", "wedding"), []);
    assert.deepEqual(
      filterPhotos(photos, "vows", "wedding").map((photo) => photo.id),
      ["b"],
    );
  } finally {
    ALL_PROCESS_DEFINITION.showAllPhotos = previous;
  }
});

test("public process API includes fixed all-process and rich content", async () => {
  const api = createProcessApi({
    repository: {
      async listProcesses() {
        return [
          {
            id: "vows",
            labelZh: "證婚",
            labelEn: "Vows",
            displayOrder: 1,
            youtubeVideoId: null,
            youtubeAutoplay: false,
            syncState: "synced",
            lastSyncedAt: null,
          },
        ];
      },
    },
    contentRepository: {
      async listContent() {
        return [
          {
            processKey: "all",
            labelZh: "全部流程",
            labelEn: "All moments",
            showAllPhotos: false,
            contentHtmlZh: "<p>總覽</p>",
            contentHtmlEn: "<p>Overview</p>",
            dividerPaddingTop: 8,
            dividerPaddingBottom: 14,
          },
          {
            processKey: "vows",
            contentHtmlZh: "<p>誓言</p>",
            contentHtmlEn: "",
            dividerPaddingTop: 10,
            dividerPaddingBottom: 11,
          },
        ];
      },
    },
  });
  const response = jsonResponse();
  const handled = await api(
    { method: "GET", url: "/Memories/api/processes" },
    response,
    new URL("http://localhost/Memories/api/processes"),
  );
  assert.equal(handled, true);
  assert.equal(response.status, 200);
  const payload = JSON.parse(response.body);
  assert.equal(payload.allProcess.id, "all");
  assert.equal(payload.allProcess.showAllPhotos, false);
  assert.equal(payload.allProcess.contentHtmlZh, "<p>總覽</p>");
  assert.equal(payload.processes[0].contentHtmlZh, "<p>誓言</p>");
  assert.equal(payload.processes[0].dividerPaddingBottom, 11);
});

test("UI transform integrates optional selector, admin tab, editor, and public content", async () => {
  const transform = processContentUiTransform();
  const appSource = await readFile(
    new URL("../src/client/App.jsx", import.meta.url),
    "utf8",
  );
  const adminSource = await readFile(
    new URL("../src/client/AdminApp.jsx", import.meta.url),
    "utf8",
  );
  const gallery = transform.transform(
    appSource,
    "/workspace/src/client/App.jsx",
  ).code;
  const admin = transform.transform(
    adminSource,
    "/workspace/src/client/AdminApp.jsx",
  ).code;
  assert.match(gallery, /ALL_PROCESS_DEFINITION/);
  assert.match(gallery, /ProcessRichContent/);
  assert.match(gallery, /ProcessSelector/);
  assert.match(gallery, /variant="guest"/);
  assert.match(gallery, /number: "00"/);
  assert.match(gallery, /photosSuppressed/);
  assert.match(admin, /<AllProcessEditor \/>/);
  assert.match(admin, /ProcessContentEditor processKey=\{category\.id\}/);
  assert.match(admin, /ProcessSelectorSettings/);
  assert.match(admin, /\["subcategory-ui", "子分類操作"\]/);
  assert.match(admin, /tab === "subcategory-ui"/);
  assert.match(admin, /categories\.length \+ 1/);
  assert.match(admin, /!upload\.albumIds\.includes\("wedding"\)/);
});

test("selector preserves traditional buttons and passes wheel settings", async () => {
  const selector = await readFile(
    new URL("../src/client/ProcessSelector.jsx", import.meta.url),
    "utf8",
  );
  assert.match(selector, /processWheelEnabled/);
  assert.match(selector, /processWheelVisibleCount/);
  assert.match(selector, /visibleCount=\{settings\.processWheelVisibleCount\}/);
  assert.match(selector, /className="process-strip"/);
  assert.match(selector, /className=\{`process-chip/);
  assert.match(selector, /DEFAULT_SETTINGS/);
});

test("process wheel reuses traditional gallery offset and supports configurable mobile density", async () => {
  const [component, selector, styles, settings] = await Promise.all([
    readFile(new URL("../src/client/ProcessWheel.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/client/ProcessSelector.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/client/process-wheel.css", import.meta.url), "utf8"),
    readFile(new URL("../src/client/ProcessSelectorSettings.jsx", import.meta.url), "utf8"),
  ]);
  assert.match(component, /closestItem/);
  assert.match(component, /setTimeout\(selectCenteredItem, 90\)/);
  assert.doesNotMatch(component, /firstSelectedContent/);
  assert.doesNotMatch(component, /\.process-video-block/);
  assert.doesNotMatch(component, /\.masonry-grid \.photo-card/);
  assert.match(selector, /function scrollToGalleryStart/);
  assert.match(selector, /document\.querySelector\("\.process-section"\)/);
  assert.match(selector, /gallery\.getBoundingClientRect\(\)\.top - stickyHeight - 10/);
  assert.match(selector, /onSelect=\{selectWithTraditionalPositioning\}/);
  assert.match(component, /processWheelVisibleCount|visibleCount/);
  assert.match(styles, /--wheel-mobile-item-width/);
  assert.match(styles, /scroll-snap-align: center/);
  assert.match(styles, /scroll-snap-type: x mandatory/);
  assert.match(settings, /VISIBLE_COUNT_OPTIONS = \[3, 4, 5, 6, 7, 8\]/);
});

test("rich content migration is additive only", async () => {
  const migration = await readFile(
    new URL("../db/012_process_rich_content.sql", import.meta.url),
    "utf8",
  );
  assert.match(migration, /CREATE TABLE IF NOT EXISTS memories_process_content/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS memories_process_attachments/);
  assert.doesNotMatch(migration, /DROP\s+(TABLE|COLUMN)/i);
});
