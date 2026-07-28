import assert from "node:assert/strict";
import test from "node:test";
import { adminLoginMessage } from "../src/client/admin-api.mjs";

test("shows the password message only for an unauthorized response", () => {
  assert.equal(
    adminLoginMessage(
      Object.assign(new Error("Unauthorized"), { status: 401 }),
    ),
    "管理密碼錯誤",
  );
});

test("explains when the server or Google Drive is not ready", () => {
  assert.equal(
    adminLoginMessage(Object.assign(new Error("Unavailable"), { status: 503 })),
    "伺服器或 Google Drive 尚未就緒，請稍後再試",
  );
});

test("distinguishes a network failure from a rejected password", () => {
  assert.equal(
    adminLoginMessage(new TypeError("Failed to fetch")),
    "無法連線至伺服器，請檢查網路後再試",
  );
});
