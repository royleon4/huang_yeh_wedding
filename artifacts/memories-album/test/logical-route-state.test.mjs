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

test("public group, subgroup, language, and photo routes round-trip", () => {
  const routes = [
    ["/Memories/group1", "zh", 0, null, null],
    ["/Memories/group1/subgroup2", "zh", 0, 1, null],
    ["/Memories/en/group2/subgroup3", "en", 1, 2, null],
    [
      "/Memories/en/group3/subgroup1/photos/drive%3A123%2F456",
      "en",
      2,
      0,
      "drive:123/456",
    ],
  ];

  for (const [path, language, groupIndex, subgroupIndex, photoId] of routes) {
    const parsed = readPublicRoute(path);
    assert.equal(parsed.kind, "gallery");
    assert.equal(parsed.language, language);
    assert.equal(parsed.groupIndex, groupIndex);
    assert.equal(parsed.subgroupIndex, subgroupIndex);
    assert.equal(parsed.photoId, photoId);
    assert.equal(parsed.canonicalPath, path);
  }
});

test("route builders use logical ordinal groups and encode photo identifiers", () => {
  assert.equal(
    publicGalleryPath({
      language: "en",
      groupNumber: 2,
      subgroupNumber: 3,
      photoId: "drive:123/456",
    }),
    "/Memories/en/group2/subgroup3/photos/drive%3A123%2F456",
  );
  assert.equal(publicModalPath("upload", "en"), "/Memories/en/upload");
  assert.equal(publicModalPath("people"), "/Memories/people");
});

test("Chinese and English roots recover to their first logical group", () => {
  assert.equal(readPublicRoute("/Memories/").canonicalPath, "/Memories/group1");
  assert.equal(
    readPublicRoute("/Memories/en/").canonicalPath,
    "/Memories/en/group1",
  );
  const invalid = readPublicRoute("/Memories/en/group1/subgroup0");
  assert.equal(invalid.kind, "invalid");
  assert.equal(invalid.canonicalPath, "/Memories/en/group1");
});

test("semantic routes from the previous release remain readable for migration", () => {
  const parsed = readPublicRoute(
    "/Memories/albums/wedding/processes/ceremony-01/photos/photo-9",
  );
  assert.equal(parsed.kind, "legacyGallery");
  assert.equal(parsed.language, "zh");
  assert.equal(parsed.albumId, "wedding");
  assert.equal(parsed.filterId, "ceremony-01");
  assert.equal(parsed.photoId, "photo-9");
});

test("administrator tabs use four logical groups after subcategory settings move into General", () => {
  const tabs = ["general", "albums", "photos", "categories"];
  tabs.forEach((tab, index) => {
    const path = adminTabPath(tab);
    assert.equal(path, `/Memories/admin/group${index + 1}`);
    assert.equal(readAdminTab(path), tab);
  });
  assert.equal(readAdminTab("/Memories/admin/photos"), "photos");
  assert.equal(readAdminTab("/Memories/admin/subcategory-ui"), "general");
  assert.equal(readAdminTab("/Memories/admin/group5"), "general");
  assert.equal(adminTabPath("subcategory-ui"), "/Memories/admin/group1");
  assert.equal(readAdminTab("/Memories/admin/group99"), "albums");
  assert.equal(readAdminTab("/Memories/admin/"), "albums");
});

test("deep logical paths select the correct React surface", () => {
  assert.equal(routeSurface("/Memories/admin/login"), "login");
  assert.equal(routeSurface("/Memories/admin/group3"), "admin");
  assert.equal(routeSurface("/Memories/en/group1/subgroup2"), "memories");
});
