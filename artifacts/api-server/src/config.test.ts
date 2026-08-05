import assert from "node:assert/strict";
import test from "node:test";
import { parsePort, requiredEnvironmentValue } from "./config";

test("parsePort accepts only complete TCP port integers", () => {
  assert.equal(parsePort("3000"), 3000);
  assert.equal(parsePort(" 65535 "), 65535);
  for (const value of [undefined, "", "0", "1.5", "12px", "65536", "Infinity"]) {
    assert.throws(() => parsePort(value), /PORT/);
  }
});

test("requiredEnvironmentValue trims values and rejects blanks", () => {
  assert.equal(
    requiredEnvironmentValue("BUCKET", { BUCKET: " wedding-photos " }),
    "wedding-photos",
  );
  assert.throws(
    () => requiredEnvironmentValue("BUCKET", { BUCKET: "   " }),
    /BUCKET environment variable is required/,
  );
});
