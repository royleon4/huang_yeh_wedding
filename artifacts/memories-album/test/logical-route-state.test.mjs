import assert from "node:assert/strict";
import test from "node:test";
import {
  adminTabPath,
  publicGalleryPath,
  publicModalPath,
  readAdminTab,
  readPublicRoute,
  routeSurface,
} from "../src/client/route-state.mjs";

test("public album, process, guest, generic, and photo routes round-trip", () => {
  const routes = [
    ["/Memories/albums/wedding", "wedding", "all", null],
    [
      "/Memories/albums/wedding/processes/ceremony-01",
      "wedding",
      "ceremony-01",
      null,
    ],
    [
      "/Memories/albums/guest/guests/%E9%BB%83%E5%BF%97%E5%8B%A4",
      "guest",
      "黃志勤",
      null,
    ],
    [
      "/Memories/albums/life/filters/family/photos/photo-9",
      "life",
      "family",
      "photo-9",
    ],
  ];

  for (const [path, albumId, filterId, photoId] of routes) {
    const parsed = readPublicRoute(path);
    assert.equal(parsed.kind, "gallery");
    assert.equal(parsed.albumId, albumId);
    assert.equal(parsed.filterId, filterId);
    assert.equal(parsed.photoId, photoId);
    assert.equal(parsed.canonicalPath, path);
  }
});

test("route builders encode identifiers safely", () => {
  assert.equal(
    publicGalleryPath({
      albumId: "guest",
      filterId: "葉 藝慧/家人",
      photoId: "drive:123/456",
    }),
    "/Memories/albums/guest/guests/%E8%91%89%20%E8%97%9D%E6%85%A7%2F%E5%AE%B6%E4%BA%BA/photos/drive%3A123%2F456",
  );
  assert.equal(publicModalPath("upload"), "/Memories/upload");
  assert.equal(publicModalPath("people"), "/Memories/people");
});

test("root aliases and malformed paths recover to the canonical album", () => {
  assert.equal(
    readPublicRoute("/Memories/").canonicalPath,
    "/Memories/albums/wedding",
  );
  const invalid = readPublicRoute("/Memories/albums/wedding/processes");
  assert.equal(invalid.kind, "invalid");
  assert.equal(invalid.canonicalPath, "/Memories/albums/wedding");
});

test("all current administrator tabs have stable deep links", () => {
  for (const tab of [
    "general",
    "albums",
    "photos",
    "categories",
    "subcategory-ui",
  ]) {
    const path = adminTabPath(tab);
    assert.equal(path, `/Memories/admin/${tab}`);
    assert.equal(readAdminTab(path), tab);
  }
  assert.equal(readAdminTab("/Memories/admin/unknown"), "albums");
  assert.equal(readAdminTab("/Memories/admin/"), "albums");
});

test("deep administrator paths select the administrator React surface", () => {
  assert.equal(routeSurface("/Memories/admin/login"), "login");
  assert.equal(routeSurface("/Memories/admin/photos"), "admin");
  assert.equal(routeSurface("/Memories/admin/subcategory-ui"), "admin");
  assert.equal(routeSurface("/Memories/albums/wedding"), "memories");
});
