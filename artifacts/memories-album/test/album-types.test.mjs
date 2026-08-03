import assert from "node:assert/strict";
import test from "node:test";
import {
  ALBUM_TYPES,
  normalizeAlbumType,
} from "../album-types.mjs";
import { MemoryAlbumRepository } from "../src/server/albums/memory-repository.mjs";

test("supports album, message, and blog content types", () => {
  assert.deepEqual(ALBUM_TYPES, ["album", "message", "blog"]);
  assert.equal(normalizeAlbumType("BLOG"), "blog");
  assert.equal(normalizeAlbumType("unknown"), "album");
});

test("allows exactly one message album", async () => {
  const repository = new MemoryAlbumRepository([
    {
      id: "messages",
      titleZh: "留言區",
      titleEn: "Guestbook",
      albumType: "message",
      displayOrder: 1,
      isVisible: true,
      isSystem: true,
    },
  ]);

  await assert.rejects(
    repository.createAlbum({
      id: "other-messages",
      titleZh: "另一個留言區",
      titleEn: "Another Guestbook",
      albumType: "message",
      isVisible: true,
    }),
    (error) => error?.code === "MESSAGE_ALBUM_EXISTS",
  );

  await assert.rejects(
    repository.updateAlbum({
      ...(await repository.listAdminAlbums())[0],
      albumType: "album",
    }),
    (error) => error?.code === "MESSAGE_ALBUM_REQUIRED",
  );
});
