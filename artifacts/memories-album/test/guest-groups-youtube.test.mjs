import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  filterPhotos,
  guestUploaderGroups,
  youtubeEmbedUrl,
} from "../src/client/gallery-model.mjs";
import {
  normalizeYoutubeVideoId,
  youtubeWatchUrl,
} from "../src/server/processes/youtube.mjs";

const guestPhotos = [
  {
    id: "a",
    source: "guest",
    uploaderName: " 小安 ",
    albumIds: ["guest"],
    processIds: [],
  },
  {
    id: "b",
    source: "guest",
    uploaderName: "小安",
    albumIds: ["guest"],
    processIds: [],
  },
  {
    id: "c",
    source: "guest",
    uploaderName: "阿慧",
    albumIds: ["guest"],
    processIds: [],
  },
  {
    id: "official",
    source: "official",
    uploaderName: "婚禮攝影",
    albumIds: ["wedding"],
    processIds: [],
  },
];

test("guest uploads are grouped automatically by normalized uploader name", () => {
  assert.deepEqual(guestUploaderGroups(guestPhotos), [
    { id: "小安", name: "小安", count: 2 },
    { id: "阿慧", name: "阿慧", count: 1 },
  ]);
  assert.deepEqual(
    filterPhotos(guestPhotos, "小安", "guest").map((photo) => photo.id),
    ["a", "b"],
  );
});

test("YouTube links normalize to a safe video id and privacy-enhanced embed", () => {
  const id = "dQw4w9WgXcQ";
  assert.equal(normalizeYoutubeVideoId(`https://youtu.be/${id}?si=test`), id);
  assert.equal(
    normalizeYoutubeVideoId(`https://www.youtube.com/watch?v=${id}`),
    id,
  );
  assert.equal(youtubeWatchUrl(id), `https://www.youtube.com/watch?v=${id}`);
  const embed = youtubeEmbedUrl(id, true);
  assert.match(embed, /^https:\/\/www\.youtube-nocookie\.com\/embed\//);
  assert.match(embed, /autoplay=1/);
  assert.match(embed, /mute=1/);
  assert.throws(() => normalizeYoutubeVideoId("https://example.com/video"), {
    code: "INVALID_YOUTUBE_URL",
  });
});

test("visitor upload UI no longer offers a classification selector", async () => {
  const source = await readFile(
    new URL("../src/client/UploadModal.jsx", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /classificationChoice|processId|<select/);
  assert.match(source, /依照姓名自動整理/);
});

test("public document policy allows only privacy-enhanced YouTube frames", async () => {
  const source = await readFile(
    new URL("../src/server/security-headers.mjs", import.meta.url),
    "utf8",
  );
  assert.match(source, /frame-src https:\/\/www\.youtube-nocookie\.com/);
});
