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

test("reports a temporarily unavailable administrator login service", () => {
  assert.equal(
    adminLoginMessage(Object.assign(new Error("Unavailable"), { status: 503 })),
    "管理登入服務暫時無法使用，請稍後再試",
  );
});

test("reports request timeout instead of leaving the button spinning", () => {
  assert.equal(
    adminLoginMessage(
      Object.assign(new Error("Timed out"), { code: "REQUEST_TIMEOUT" }),
    ),
    "伺服器回應逾時，請再按一次進入管理",
  );
});

test("distinguishes a network failure from a rejected password", () => {
  assert.equal(
    adminLoginMessage(new TypeError("Failed to fetch")),
    "無法連線至伺服器，請檢查網路後再試",
  );
});
