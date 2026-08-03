import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { albumLabelsUiTransform } from "../album-labels-ui-transform.mjs";
import {
  albumSupportsPhotoLabels,
  buildAlbumLabelGroups,
  validSelectedAlbumLabel,
} from "../src/client/album-labels.mjs";
import { createAdminSessionCookie } from "../src/server/admin/auth.mjs";
import { createAdminCategoryApi } from "../src/server/categories/admin-api.mjs";
import { AlbumScopedPhotoRepository } from "../src/server/photos/album-scoped-repository.mjs";

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, "..");
const adminToken = "album-label-test-token";

async function source(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

function cookie() {
  return createAdminSessionCookie({
    configuredToken: adminToken,
    createNonce: () => "fixed",
  }).header.split(";", 1)[0];
}

async function withApi(api, run) {
  const server = createServer(async (request, response) => {
    if (await api(request, response)) return;
    response.statusCode = 404;
    response.end();
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

test("label groups omit guest, non-photo, and empty albums", () => {
  const albums = [
    { id: "wedding", titleZh: "婚禮流程", albumType: "album" },
    { id: "guest", titleZh: "訪客相簿", albumType: "album" },
    { id: "life", titleZh: "生活照", albumType: "album" },
    { id: "empty", titleZh: "空相簿", albumType: "album" },
    { id: "messages", titleZh: "留言區", albumType: "message" },
  ];
  const labels = [
    { id: "ceremony", albumId: "wedding", labelZh: "證婚", displayOrder: 2 },
    { id: "arrival", albumId: "wedding", labelZh: "入場", displayOrder: 1 },
    { id: "daily", albumId: "life", labelZh: "日常", displayOrder: 1 },
    { id: "guest-label", albumId: "guest", labelZh: "不顯示", displayOrder: 1 },
    { id: "message-label", albumId: "messages", labelZh: "不顯示", displayOrder: 1 },
  ];

  assert.equal(albumSupportsPhotoLabels(albums[0]), true);
  assert.equal(albumSupportsPhotoLabels(albums[1]), false);
  assert.equal(albumSupportsPhotoLabels(albums[4]), false);
  assert.deepEqual(
    buildAlbumLabelGroups(albums, labels).map((group) => [
      group.album.id,
      group.labels.map((label) => label.id),
    ]),
    [
      ["wedding", ["arrival", "ceremony"]],
      ["life", ["daily"]],
    ],
  );
  assert.equal(validSelectedAlbumLabel(labels, "daily", ["life"])?.id, "daily");
  assert.equal(validSelectedAlbumLabel(labels, "daily", ["wedding"]), null);
  assert.equal(validSelectedAlbumLabel(labels, "guest-label", ["guest"]), null);
});

test("migration scopes labels to albums and enforces matching photo membership", async () => {
  const migration = await source("db/015_album_scoped_labels.sql");
  assert.match(migration, /ADD COLUMN IF NOT EXISTS album_id text/);
  assert.match(migration, /SET album_id = 'wedding'/);
  assert.match(migration, /REFERENCES memories_albums\(id\)/);
  assert.match(migration, /CHECK \(album_id <> 'guest'\)/);
  assert.match(migration, /CREATE CONSTRAINT TRIGGER memories_validate_photo_label_album/);
  assert.match(migration, /DEFERRABLE INITIALLY DEFERRED/);
  assert.match(migration, /album_id = required_album_id/);
  assert.doesNotMatch(migration, /DROP\s+(TABLE|COLUMN)\b/i);
});

test("administrator label API creates local and Drive labels and rejects guest", async () => {
  const created = [];
  const repository = {
    async listProcesses() {
      return [];
    },
    async listEligibleLabelAlbums() {
      return [
        { id: "wedding", albumType: "album" },
        { id: "life", albumType: "album" },
      ];
    },
    async listLabels({ albumId = null } = {}) {
      const labels = [
        { id: "ceremony", albumId: "wedding", labelZh: "證婚", displayOrder: 1 },
        { id: "daily", albumId: "life", labelZh: "日常", displayOrder: 1 },
        { id: "hidden", albumId: "messages", labelZh: "不回傳", displayOrder: 1 },
      ];
      return labels.filter((label) => !albumId || label.albumId === albumId);
    },
    async createAlbumLabel(input) {
      created.push(["local", input]);
      return { ...input, displayOrder: 2, syncState: "local" };
    },
  };
  const synchronizer = {
    async createProcess(input) {
      created.push(["drive", input]);
      return {
        id: "drive-label",
        albumId: "wedding",
        ...input,
        displayOrder: 2,
        syncState: "synced",
      };
    },
  };
  const api = createAdminCategoryApi({
    repository,
    synchronizer,
    adminToken,
    createId: () => "local-label",
  });

  await withApi(api, async (origin) => {
    const headers = {
      Cookie: cookie(),
      "Content-Type": "application/json",
      "X-Memories-Admin": "1",
    };

    const listed = await fetch(`${origin}/admin/api/album-labels`, {
      headers: { Cookie: cookie() },
    });
    assert.equal(listed.status, 200);
    assert.deepEqual(
      (await listed.json()).labels.map((label) => [label.id, label.albumId]),
      [
        ["ceremony", "wedding"],
        ["daily", "life"],
      ],
    );

    const life = await fetch(`${origin}/admin/api/album-labels`, {
      method: "POST",
      headers,
      body: JSON.stringify({ albumId: "life", labelZh: "旅行" }),
    });
    assert.equal(life.status, 201);
    const lifeBody = await life.json();
    assert.equal(lifeBody.label.id, "local-label");
    assert.equal(lifeBody.label.albumId, "life");

    const wedding = await fetch(`${origin}/admin/api/album-labels`, {
      method: "POST",
      headers,
      body: JSON.stringify({ albumId: "wedding", labelZh: "送客" }),
    });
    assert.equal(wedding.status, 201);
    assert.equal((await wedding.json()).label.albumId, "wedding");

    const guest = await fetch(`${origin}/admin/api/album-labels`, {
      method: "POST",
      headers,
      body: JSON.stringify({ albumId: "guest", labelZh: "不可建立" }),
    });
    assert.equal(guest.status, 422);
    assert.equal((await guest.json()).code, "INVALID_LABEL_ALBUM");
  });

  assert.equal(created[0][0], "local");
  assert.equal(created[0][1].albumId, "life");
  assert.equal(created[1][0], "drive");
});

test("Drive reconciliation replaces only wedding labels", async () => {
  const queries = [];
  const client = {
    async query(sql, values = []) {
      queries.push({ sql, values });
      if (sql.includes("UPDATE memories_photos")) {
        return { rows: [{ id: "photo-1", album_memberships_overridden: true }] };
      }
      return { rows: [] };
    },
    release() {},
  };
  const repository = new AlbumScopedPhotoRepository({
    async connect() {
      return client;
    },
    async query(sql, values) {
      return client.query(sql, values);
    },
  });

  await repository.replacePhotoProcessByDriveFile(
    "drive-file",
    "wedding-process",
    "wedding-folder",
    "wedding",
  );

  const deletion = queries.find((query) =>
    query.sql.includes("DELETE FROM memories_photo_processes relationship"),
  );
  assert(deletion);
  assert.match(deletion.sql, /label\.album_id = 'wedding'/);
});

test("administrator transform adds per-album creation and grouped photo selection", async () => {
  const [adminApp, workspace] = await Promise.all([
    source("src/client/AdminApp.jsx"),
    source("src/client/AdminPhotoWorkspace.jsx"),
  ]);
  const transform = albumLabelsUiTransform();
  const transformedAdmin = transform.transform(
    adminApp,
    "/workspace/src/client/AdminApp.jsx",
  ).code;
  const transformedWorkspace = transform.transform(
    workspace,
    "/workspace/src/client/AdminPhotoWorkspace.jsx",
  ).code;

  assert.match(transformedAdmin, /import AlbumLabelManager/);
  assert.match(transformedAdmin, /<AlbumLabelManager album=\{album\} busy=\{busy\} \/>/);
  assert.match(transformedWorkspace, /子分類（標籤）/);
  assert.match(transformedWorkspace, /albumLabelGroups\.map\(\(group\) =>/);
  assert.match(transformedWorkspace, /<optgroup/);
  assert.match(
    transformedWorkspace,
    /disabled=\{!uploadAlbumIds\.includes\(group\.album\.id\)\}/,
  );
  assert.match(transformedWorkspace, /目前沒有可供新增照片使用的標籤/);
  assert.match(transformedWorkspace, /訪客相簿不提供標籤/);
});

test("repository separates public wedding processes from all administrator labels", async () => {
  const repository = await source("src/server/processes/repository.mjs");
  const wrapper = await source("src/server/photos/admin-with-changes-api.mjs");
  const runtime = await source("src/server/runtime.mjs");

  assert.match(repository, /async listProcesses\(\)/);
  assert.match(repository, /album_id = 'wedding'/);
  assert.match(repository, /async listLabels\(/);
  assert.match(repository, /async createAlbumLabel\(/);
  assert.match(repository, /album\.id <> 'guest'/);
  assert.match(repository, /album\.album_type = 'album'/);
  assert.match(
    repository,
    /deactivateMissingDriveProcesses[\s\S]*album_id = 'wedding'/,
  );
  assert.match(wrapper, /labelAwareCategoryRepository/);
  assert.match(wrapper, /return \(\) => target\.listLabels\(\)/);
  assert.match(runtime, /new AlbumScopedPhotoRepository\(pool\)/);
});
