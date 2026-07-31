import assert from "node:assert/strict";
import test from "node:test";
import {
  createPublicBootstrapLoader,
  normalizePublicSettings,
} from "../src/client/public-bootstrap.mjs";

function jsonResponse(body) {
  return {
    ok: true,
    async json() {
      return body;
    },
  };
}

test("public bootstrap loads albums, settings, and processes once before render", async () => {
  const calls = [];
  const payloads = {
    "/Memories/api/albums": {
      albums: [
        {
          id: "custom",
          titleZh: "編輯後相簿",
          titleEn: "Edited album",
          descriptionZh: "中文說明",
          descriptionEn: "English description",
          displayOrder: 1,
        },
      ],
    },
    "/Memories/api/settings": {
      processWheelEnabled: true,
      processWheelVisibleCount: 4,
      guestUploadCategorySelectionEnabled: false,
      galleryMediaOrder: ["guestPhotos", "weddingPhotos", "text", "video"],
      pinnedPhotoIdsByProcess: { vows: ["photo-1"] },
      siteCopy: {
        zh: { archive: "已編輯標題" },
        en: { archive: "Edited title" },
      },
    },
    "/Memories/api/processes": {
      processes: [
        {
          id: "vows",
          labelZh: "證婚",
          labelEn: "Vows",
          displayOrder: 1,
        },
      ],
      allProcess: {
        id: "all",
        labelZh: "全部時刻",
        labelEn: "All moments",
        showAllPhotos: true,
      },
    },
  };

  const loader = createPublicBootstrapLoader({
    fetchImpl: async (path) => {
      calls.push(path);
      return jsonResponse(payloads[path]);
    },
  });

  const first = await loader.load();
  const second = await loader.load();

  assert.strictEqual(first, second);
  assert.deepEqual(calls.sort(), Object.keys(payloads).sort());
  assert.equal(first.albums[0].zh, "編輯後相簿");
  assert.equal(first.settings.siteCopy.zh.archive, "已編輯標題");
  assert.equal(first.settings.siteCopy.en.archive, "Edited title");
  assert.equal(first.settings.processWheelEnabled, true);
  assert.equal(first.settings.processWheelVisibleCount, 4);
  assert.equal(first.settings.guestUploadCategorySelectionEnabled, false);
  assert.deepEqual(first.settings.pinnedPhotoIdsByProcess.vows, ["photo-1"]);
  assert.equal(first.processes[0].labelZh, "證婚");
  assert.equal(first.allProcess.labelZh, "全部時刻");
  assert.deepEqual(first.resolved, {
    albums: true,
    settings: true,
    processes: true,
  });
});

test("public bootstrap keeps successful resources when another endpoint fails", async () => {
  const loader = createPublicBootstrapLoader({
    fetchImpl: async (path) => {
      if (path === "/Memories/api/settings") {
        throw new Error("settings unavailable");
      }
      if (path === "/Memories/api/albums") {
        return jsonResponse({
          albums: [
            {
              id: "guest",
              titleZh: "訪客照片",
              titleEn: "Guest photos",
              displayOrder: 1,
            },
          ],
        });
      }
      return jsonResponse({ processes: [], allProcess: null });
    },
  });

  const snapshot = await loader.load();
  assert.equal(snapshot.albums[0].zh, "訪客照片");
  assert.equal(snapshot.settings.processWheelEnabled, false);
  assert.equal(snapshot.settings.siteCopy.zh.archive.length > 0, true);
  assert.equal(snapshot.resolved.albums, true);
  assert.equal(snapshot.resolved.settings, false);
  assert.equal(snapshot.resolved.processes, true);
});

test("public settings normalization rejects unsupported wheel density", () => {
  const normalized = normalizePublicSettings({
    processWheelEnabled: true,
    processWheelVisibleCount: 99,
    guestUploadCategorySelectionEnabled: null,
  });
  assert.equal(normalized.processWheelEnabled, true);
  assert.equal(normalized.processWheelVisibleCount, 6);
  assert.equal(normalized.guestUploadCategorySelectionEnabled, true);
});
