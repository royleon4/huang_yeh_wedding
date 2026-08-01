import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "../src/app.mjs";
import { withListeningServer } from "../test-support/http.mjs";

const STORAGE_ERROR = "DRIVE_RETRYABLE";

function unavailableRuntime() {
  const error = new Error("Drive unavailable");
  error.code = STORAGE_ERROR;
  throw error;
}

test("admin login remains available while public storage data degrades", async () => {
  const server = createServer({
    env: { MEMORIES_ADMIN_TOKEN: "correct-password" },
    getRuntime: unavailableRuntime,
  });

  await withListeningServer(server, async (origin) => {
    const login = await fetch(`${origin}/admin/api/session`, {
      method: "POST",
      headers: { Authorization: "Bearer correct-password" },
    });
    assert.equal(login.status, 200);
    assert.deepEqual(await login.json(), { authenticated: true });

    const degradedCases = [
      {
        path: "/Memories/api/processes",
        expected: {
          allProcess: {
            id: "all",
            labelZh: "全部流程",
            labelEn: "All moments",
            showAllPhotos: true,
          },
          processes: [],
          degraded: true,
          storageError: STORAGE_ERROR,
        },
      },
      {
        path: "/Memories/api/settings",
        expected: {
          primaryNavigationVisible: false,
          guestUploadCategorySelectionEnabled: true,
          degraded: true,
          storageError: STORAGE_ERROR,
        },
      },
    ];

    for (const { path, expected } of degradedCases) {
      const response = await fetch(`${origin}${path}`);
      assert.equal(response.status, 200, path);
      assert.deepEqual(await response.json(), expected, path);
    }
  });
});
