import assert from "node:assert/strict";
import test from "node:test";
import { adminErrorMessage } from "../src/client/admin-client.mjs";

const errorCases = [
  {
    name: "unauthorized response",
    error: Object.assign(new Error("Unauthorized"), { status: 401 }),
    message: "管理密碼錯誤，或登入已過期。",
  },
  {
    name: "temporarily unavailable service",
    error: Object.assign(new Error("Unavailable"), { status: 503 }),
    message: "管理服務暫時無法使用，請稍後再試。",
  },
  {
    name: "request timeout",
    error: Object.assign(new Error("Timed out"), {
      code: "REQUEST_TIMEOUT",
    }),
    message: "伺服器回應逾時，請再試一次。",
  },
  {
    name: "rate limiting",
    error: Object.assign(new Error("Rate limited"), { status: 429 }),
    message: "登入嘗試次數過多，請稍後再試。",
  },
  {
    name: "network failure",
    error: new TypeError("Failed to fetch"),
    message: "無法連線至伺服器，請檢查網路。",
  },
];

test("administrator errors map to actionable messages", async (t) => {
  for (const { name, error, message } of errorCases) {
    await t.test(name, () => {
      assert.equal(adminErrorMessage(error), message);
    });
  }
});
