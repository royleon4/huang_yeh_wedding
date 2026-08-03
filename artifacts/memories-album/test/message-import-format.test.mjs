import assert from "node:assert/strict";
import test from "node:test";
import { parseMessageImport } from "../src/server/messages/import-format.mjs";

test("parses bilingual CSV headers and quoted messages", () => {
  const messages = parseMessageImport(
    '\uFEFF姓名,留言,日期\n小安,"祝福你們，永遠幸福",2026-06-20\n',
  );
  assert.equal(messages.length, 1);
  assert.equal(messages[0].visitorName, "小安");
  assert.equal(messages[0].body, "祝福你們，永遠幸福");
  assert.match(messages[0].messageAt, /^2026-06-20/);
});

test("parses TSV and defaults an omitted date", () => {
  const messages = parseMessageImport("name\tmessage\nAn\tGod bless you\n");
  assert.equal(messages.length, 1);
  assert.equal(messages[0].visitorName, "An");
  assert.equal(messages[0].body, "God bless you");
  assert.ok(Number.isFinite(new Date(messages[0].messageAt).getTime()));
});

test("rejects a missing required header", () => {
  assert.throws(
    () => parseMessageImport("name,date\nAn,2026-06-20\n"),
    (error) => error?.code === "INVALID_MESSAGE_IMPORT",
  );
});

test("rejects imports over the configured row limit", () => {
  assert.throws(
    () => parseMessageImport("name,message\nA,One\nB,Two\n", { maximumRows: 1 }),
    (error) => error?.code === "INVALID_MESSAGE_IMPORT",
  );
});

test("rejects overlong message content", () => {
  assert.throws(
    () => parseMessageImport(`name,message\nA,${"x".repeat(1001)}\n`),
    (error) => error?.code === "INVALID_MESSAGE_IMPORT",
  );
});
