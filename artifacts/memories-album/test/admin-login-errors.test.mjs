import assert from "node:assert/strict";
import test from "node:test";
import { adminErrorMessage } from "../src/client/admin-client.mjs";

test("shows the password message only for an unauthorized response", () => {
  assert.equal(
    adminErrorMessage(
      Object.assign(new Error("Unauthorized"), { status: 401 }),
    ),
    "管理密碼錯誤，或登入已過期。",
  );
});

test("reports a temporarily unavailable administrator login service", () => {
  assert.equal(
    adminErrorMessage(Object.assign(new Error("Unavailable"), { status: 503 })),
    "管理服務暫時無法使用，請稍後再試。",
  );
});

test("reports request timeout instead of leaving the button spinning", () => {
  assert.equal(
    adminErrorMessage(
      Object.assign(new Error("Timed out"), { code: "REQUEST_TIMEOUT" }),
    ),
    "伺服器回應逾時，請再試一次。",
  );
});

test("reports administrator login rate limiting", () => {
  assert.equal(
    adminErrorMessage(
      Object.assign(new Error("Rate limited"), { status: 429 }),
    ),
    "登入嘗試次數過多，請稍後再試。",
  );
});

test("distinguishes a network failure from a rejected password", () => {
  assert.equal(
    adminErrorMessage(new TypeError("Failed to fetch")),
    "無法連線至伺服器，請檢查網路。",
  );
});
