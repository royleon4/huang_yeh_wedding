import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { createAdminSessionCookie } from "../src/server/admin/auth.mjs";
import { MemoryAlbumRepository } from "../src/server/albums/memory-repository.mjs";
import {
  createAdminMessageApi,
  createMessageApi,
} from "../src/server/messages/api.mjs";

const adminToken = "correct-password";

function adminCookie() {
  return createAdminSessionCookie({
    configuredToken: adminToken,
    createNonce: () => "guestbook-nonce",
  }).header.split(";", 1)[0];
}

function adminHeaders({ json = false } = {}) {
  return {
    Cookie: adminCookie(),
    "X-Memories-Admin": "1",
    ...(json ? { "Content-Type": "application/json" } : {}),
  };
}

class MemoryMessageRepository {
  constructor() {
    this.messages = [];
  }

  async listPublicMessages({ albumId }) {
    return this.messages.filter(
      (message) => message.albumId === albumId && message.visibility === "public",
    );
  }

  async listAdminMessages({ albumId }) {
    return this.messages.filter((message) => message.albumId === albumId);
  }

  async createMessage(message) {
    this.messages.unshift({ ...message });
    return { ...message };
  }

  async updateVisibility({ id, albumId, visibility }) {
    const index = this.messages.findIndex(
      (message) => message.id === id && message.albumId === albumId,
    );
    if (index < 0) return null;
    this.messages[index] = { ...this.messages[index], visibility };
    return { ...this.messages[index] };
  }

  async deleteMessage({ id, albumId }) {
    const index = this.messages.findIndex(
      (message) => message.id === id && message.albumId === albumId,
    );
    if (index < 0) return null;
    const [deleted] = this.messages.splice(index, 1);
    return deleted.id;
  }

  async importMessages(messages) {
    this.messages.unshift(...messages.map((message) => ({
      ...message,
      visibility: "public",
      source: "admin_import",
    })));
    return messages.map((message) => ({
      ...message,
      visibility: "public",
      source: "admin_import",
    }));
  }
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
  try {
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

function albumRepository() {
  return new MemoryAlbumRepository([
    {
      id: "messages",
      titleZh: "留言區",
      titleEn: "Guestbook",
      descriptionZh: "",
      descriptionEn: "",
      albumType: "message",
      displayOrder: 1,
      isVisible: true,
      isSystem: true,
    },
  ]);
}

test("guests can create and list required-name messages without a category", async () => {
  const repository = new MemoryMessageRepository();
  const api = createMessageApi({
    repository,
    albumRepository: albumRepository(),
    createId: () => "message-1",
  });

  await withApis([api], async (origin) => {
    const invalid = await fetch(`${origin}/Memories/api/settings/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitorName: "", message: "Blessings" }),
    });
    assert.equal(invalid.status, 422);

    const created = await fetch(`${origin}/Memories/api/settings/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitorName: "小安", message: "祝福你們永遠幸福" }),
    });
    assert.equal(created.status, 201);
    const createdMessage = (await created.json()).message;
    assert.equal(createdMessage.albumId, "messages");
    assert.equal(createdMessage.visitorName, "小安");
    assert.equal(createdMessage.body, "祝福你們永遠幸福");
    assert.equal(Object.hasOwn(createdMessage, "visibility"), false);

    const listed = await fetch(`${origin}/Memories/api/settings/messages`);
    assert.equal(listed.status, 200);
    const payload = await listed.json();
    assert.equal(payload.albumId, "messages");
    assert.equal(payload.messages.length, 1);
    assert.equal(payload.messages[0].id, "message-1");
  });
});

test("administrators can import the documented bilingual CSV format", async () => {
  const repository = new MemoryMessageRepository();
  let id = 0;
  const api = createAdminMessageApi({
    repository,
    albumRepository: albumRepository(),
    adminToken,
    createId: () => `import-${++id}`,
  });

  await withApis([api], async (origin) => {
    const unauthorized = await fetch(`${origin}/admin/api/settings/messages`);
    assert.equal(unauthorized.status, 401);

    const imported = await fetch(`${origin}/admin/api/settings/messages/import`, {
      method: "POST",
      headers: adminHeaders({ json: true }),
      body: JSON.stringify({
        content: "姓名,留言,日期\n小安,百年好合,2026-06-20\nAn,God bless you,2026-06-21\n",
      }),
    });
    assert.equal(imported.status, 201);
    assert.equal((await imported.json()).imported, 2);

    const listed = await fetch(`${origin}/admin/api/settings/messages`, {
      headers: { Cookie: adminCookie() },
    });
    assert.equal(listed.status, 200);
    const payload = await listed.json();
    assert.deepEqual(payload.format.headers, ["name", "message", "date"]);
    assert.equal(payload.format.maximumRows, 500);
    assert.equal(payload.messages.length, 2);
    assert.equal(payload.messages[0].visibility, "public");
    assert.equal(payload.messages[0].source, "admin_import");
  });
});

test("administrators can hide, restore, and permanently delete a message", async () => {
  const repository = new MemoryMessageRepository();
  const albums = albumRepository();
  const publicApi = createMessageApi({
    repository,
    albumRepository: albums,
    createId: () => "moderated-message",
  });
  const adminApi = createAdminMessageApi({
    repository,
    albumRepository: albums,
    adminToken,
  });

  await withApis([publicApi, adminApi], async (origin) => {
    const created = await fetch(`${origin}/Memories/api/settings/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitorName: "Leon", message: "Test message" }),
    });
    assert.equal(created.status, 201);

    const unauthorizedHide = await fetch(
      `${origin}/admin/api/settings/messages/moderated-message`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visibility: "hidden" }),
      },
    );
    assert.equal(unauthorizedHide.status, 401);

    const hidden = await fetch(
      `${origin}/admin/api/settings/messages/moderated-message`,
      {
        method: "PATCH",
        headers: adminHeaders({ json: true }),
        body: JSON.stringify({ visibility: "hidden" }),
      },
    );
    assert.equal(hidden.status, 200);
    assert.equal((await hidden.json()).message.visibility, "hidden");

    const publicWhileHidden = await fetch(
      `${origin}/Memories/api/settings/messages`,
    );
    assert.equal((await publicWhileHidden.json()).messages.length, 0);

    const adminWhileHidden = await fetch(
      `${origin}/admin/api/settings/messages`,
      { headers: { Cookie: adminCookie() } },
    );
    const hiddenMessages = (await adminWhileHidden.json()).messages;
    assert.equal(hiddenMessages.length, 1);
    assert.equal(hiddenMessages[0].visibility, "hidden");

    const restored = await fetch(
      `${origin}/admin/api/settings/messages/moderated-message`,
      {
        method: "PATCH",
        headers: adminHeaders({ json: true }),
        body: JSON.stringify({ visibility: "public" }),
      },
    );
    assert.equal(restored.status, 200);
    assert.equal((await restored.json()).message.visibility, "public");

    const publicAfterRestore = await fetch(
      `${origin}/Memories/api/settings/messages`,
    );
    assert.equal((await publicAfterRestore.json()).messages.length, 1);

    const deleted = await fetch(
      `${origin}/admin/api/settings/messages/moderated-message`,
      {
        method: "DELETE",
        headers: adminHeaders(),
      },
    );
    assert.equal(deleted.status, 200);
    assert.deepEqual(await deleted.json(), {
      deleted: true,
      id: "moderated-message",
    });

    const publicAfterDelete = await fetch(
      `${origin}/Memories/api/settings/messages`,
    );
    assert.equal((await publicAfterDelete.json()).messages.length, 0);

    const adminAfterDelete = await fetch(
      `${origin}/admin/api/settings/messages`,
      { headers: { Cookie: adminCookie() } },
    );
    assert.equal((await adminAfterDelete.json()).messages.length, 0);
  });
});
