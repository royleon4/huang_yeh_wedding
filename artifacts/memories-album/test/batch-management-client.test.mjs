import assert from "node:assert/strict";
import test from "node:test";
import {
  fetchPrivateBatch,
  parsePrivateBatchLocation,
  rotatePrivateLink,
  withdrawPrivatePhoto,
} from "../src/client/batch-management-client.mjs";

const batchId = "11111111-1111-4111-8111-111111111111";
const photoId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

test("private management credentials are read from the URL fragment, not the request path", () => {
  assert.deepEqual(
    parsePrivateBatchLocation(
      `/Memories/manage/${batchId}`,
      "#token=private%20token",
    ),
    { batchId, token: "private token" },
  );
  assert.deepEqual(
    parsePrivateBatchLocation(`/Memories/manage/${batchId}`, ""),
    { batchId, token: null },
  );
  assert.equal(
    parsePrivateBatchLocation("/Memories/manage/not-a-uuid", "#token=x"),
    null,
  );
});

test("private management requests keep the token in the Authorization header", async () => {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, options });
    return new Response(
      JSON.stringify(
        options.method === "POST"
          ? {
              manageUrl: `/Memories/manage/${batchId}#token=replacement`,
            }
          : options.method === "DELETE"
            ? { withdrawn: true, photoId }
            : { batch: { id: batchId, photos: [] } },
      ),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  };

  await fetchPrivateBatch({ batchId, token: "private", fetchImpl });
  await withdrawPrivatePhoto({
    batchId,
    photoId,
    token: "private",
    fetchImpl,
  });
  await rotatePrivateLink({ batchId, token: "private", fetchImpl });

  assert.deepEqual(
    calls.map((call) => call.url),
    [
      `/Memories/api/upload-batches/${batchId}`,
      `/Memories/api/upload-batches/${batchId}/photos/${photoId}`,
      `/Memories/api/upload-batches/${batchId}/management-token`,
    ],
  );
  assert.ok(calls.every((call) => !call.url.includes("private")));
  assert.ok(
    calls.every(
      (call) => call.options.headers.Authorization === "Bearer private",
    ),
  );
  assert.deepEqual(
    calls.map((call) => call.options.method ?? "GET"),
    ["GET", "DELETE", "POST"],
  );
});
