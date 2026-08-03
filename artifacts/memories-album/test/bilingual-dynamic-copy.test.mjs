import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("guestbook creation and gallery states have Chinese and English copy", async () => {
  const modal = await source("../src/client/MessageModal.jsx");
  const album = await source("../src/client/MessageAlbum.jsx");
  for (const text of [
    "留下你的祝福",
    "Leave a message",
    "你的姓名（必填）",
    "Your name (required)",
    "留言（必填）",
    "Message (required)",
    "正在整理留言……",
    "Arranging the messages…",
  ]) {
    assert.ok(modal.includes(text) || album.includes(text), `missing copy: ${text}`);
  }
});

test("process selector hint changes with the active language", async () => {
  const wheel = await source("../src/client/ProcessWheel.jsx");
  const transform = await source("../message-album-ui-transform.mjs");
  assert.match(wheel, /Swipe to choose/);
  assert.match(wheel, /滑動選擇/);
  assert.match(wheel, /language === "en"/);
  assert.match(transform, /language=\{lang\}/);
});

test("upload limits and descriptions continue to come from system settings", async () => {
  const publicBootstrap = await source("../public-bootstrap-ui-transform.mjs");
  const adminUpload = await source("../upload-settings-ui-transform.mjs");
  assert.match(publicBootstrap, /guestUploadMaxPhotos/);
  assert.match(publicBootstrap, /Choose up to.*maxUploadPhotos/);
  assert.match(publicBootstrap, /選擇最多.*maxUploadPhotos/);
  assert.match(publicBootstrap, /uploadDescription/);
  assert.match(adminUpload, /adminUploadMaxPhotos/);
  assert.match(adminUpload, /uploadDescription\.zh/);
});
