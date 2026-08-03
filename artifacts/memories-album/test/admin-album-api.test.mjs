import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { createAdminSessionCookie } from "../src/server/admin/auth.mjs";
import { createAdminAlbumApi } from "../src/server/albums/admin-api.mjs";
import { createAlbumApi } from "../src/server/albums/api.mjs";
import { MemoryAlbumRepository } from "../src/server/albums/memory-repository.mjs";

const adminToken = "correct-password";

function adminCookie() {
  return createAdminSessionCookie({
    configuredToken: adminToken,
    createNonce: () => "fixed-nonce",
  }).header.split(";", 1)[0];
}

async function withApis(apis, run) {
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    for (const api of apis) {
      if (await api(request, response, url)) return;
    }
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

test("administrators can add and edit typed albums while visitors only see visible albums", async () => {
  const repository = new MemoryAlbumRepository([
    {
      id: "wedding",
      titleZh: "婚禮流程",
      titleEn: "Wedding moments",
      descriptionZh: "",
      descriptionEn: "",
      albumType: "album",
      displayOrder: 1,
      isVisible: true,
      isSystem: true,
      showSummary: true,
      photoSortMode: "time-asc",
      featuredPhotosEnabled: true,
      featuredPhotoMin: 2,
      featuredPhotoMax: 4,
    },
  ]);
  const adminApi = createAdminAlbumApi({
    repository,
    adminToken,
    createId: () => "11111111-1111-4111-8111-111111111111",
  });
  const publicApi = createAlbumApi({ repository });

  await withApis([adminApi, publicApi], async (origin) => {
    const unauthorized = await fetch(`${origin}/admin/api/albums`);
    assert.equal(unauthorized.status, 401);

    const cookie = adminCookie();
    const missingCsrf = await fetch(`${origin}/admin/api/albums`, {
      method: "POST",
      headers: {
        Cookie: cookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ titleZh: "婚前回憶" }),
    });
    assert.equal(missingCsrf.status, 403);

    const created = await fetch(`${origin}/admin/api/albums`, {
      method: "POST",
      headers: {
        Cookie: cookie,
        "Content-Type": "application/json",
        "X-Memories-Admin": "1",
      },
      body: JSON.stringify({
        titleZh: "婚前回憶",
        titleEn: "Before the wedding",
        descriptionZh: "我們一路走來的日常",
        albumType: "blog",
        photoSortMode: "name-asc",
      }),
    });
    assert.equal(created.status, 201);
    assert.deepEqual(await created.json(), {
      album: {
        id: "11111111-1111-4111-8111-111111111111",
        titleZh: "婚前回憶",
        titleEn: "Before the wedding",
        descriptionZh: "我們一路走來的日常",
        descriptionEn: "",
        albumType: "blog",
        displayOrder: 2,
        isVisible: true,
        isSystem: false,
        showSummary: true,
        photoSortMode: "name-asc",
        featuredPhotosEnabled: false,
        featuredPhotoMin: 1,
        featuredPhotoMax: 3,
      },
    });

    const invalidSort = await fetch(
      `${origin}/admin/api/albums/11111111-1111-4111-8111-111111111111`,
      {
        method: "PATCH",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
          "X-Memories-Admin": "1",
        },
        body: JSON.stringify({ photoSortMode: "not-a-sort-mode" }),
      },
    );
    assert.equal(invalidSort.status, 422);
    assert.equal((await invalidSort.json()).code, "INVALID_ALBUM_SORT");

    const invalidRange = await fetch(
      `${origin}/admin/api/albums/11111111-1111-4111-8111-111111111111`,
      {
        method: "PATCH",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
          "X-Memories-Admin": "1",
        },
        body: JSON.stringify({ featuredPhotoMin: 4, featuredPhotoMax: 2 }),
      },
    );
    assert.equal(invalidRange.status, 422);
    assert.equal((await invalidRange.json()).code, "INVALID_ALBUM_FEATURED_RANGE");

    const updated = await fetch(
      `${origin}/admin/api/albums/11111111-1111-4111-8111-111111111111`,
      {
        method: "PATCH",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
          "X-Memories-Admin": "1",
        },
        body: JSON.stringify({
          titleZh: "交往回憶",
          isVisible: false,
          showSummary: false,
          photoSortMode: "author-desc",
          featuredPhotosEnabled: true,
          featuredPhotoMin: 0,
          featuredPhotoMax: 4,
        }),
      },
    );
    assert.equal(updated.status, 200);
    const updatedAlbum = (await updated.json()).album;
    assert.equal(updatedAlbum.titleZh, "交往回憶");
    assert.equal(updatedAlbum.albumType, "blog");
    assert.equal(updatedAlbum.showSummary, false);
    assert.equal(updatedAlbum.photoSortMode, "author-desc");
    assert.equal(updatedAlbum.featuredPhotosEnabled, true);
    assert.equal(updatedAlbum.featuredPhotoMin, 0);
    assert.equal(updatedAlbum.featuredPhotoMax, 4);

    const adminList = await fetch(`${origin}/admin/api/albums`, {
      headers: { Cookie: cookie },
    });
    assert.equal(adminList.status, 200);
    assert.deepEqual(
      (await adminList.json()).albums.map((album) => album.titleZh),
      ["婚禮流程", "交往回憶"],
    );

    const publicList = await fetch(`${origin}/Memories/api/albums`);
    assert.equal(publicList.status, 200);
    assert.deepEqual(await publicList.json(), {
      albums: [
        {
          id: "wedding",
          titleZh: "婚禮流程",
          titleEn: "Wedding moments",
          descriptionZh: "",
          descriptionEn: "",
          albumType: "album",
          displayOrder: 1,
          showSummary: true,
          photoSortMode: "time-asc",
          featuredPhotosEnabled: true,
          featuredPhotoMin: 2,
          featuredPhotoMax: 4,
        },
      ],
    });
  });
});
