import assert from "node:assert/strict";
import test from "node:test";
import { parseMessageImport } from "../src/server/messages/import-format.mjs";

test("parses bilingual CSV headers and a local datetime to the minute", () => {
  const messages = parseMessageImport(
    '\uFEFF姓名,留言,日期時間\n小安,"祝福你們，永遠幸福",2026-06-20 11:03\n',
  );
  assert.equal(messages.length, 1);
  assert.equal(messages[0].visitorName, "小安");
  assert.equal(messages[0].body, "祝福你們，永遠幸福");

  const date = new Date(messages[0].messageAt);
  assert.equal(date.getFullYear(), 2026);
  assert.equal(date.getMonth(), 5);
  assert.equal(date.getDate(), 20);
  assert.equal(date.getHours(), 11);
  assert.equal(date.getMinutes(), 3);
  assert.equal(date.getSeconds(), 0);
});

test("parses ISO datetime values with an explicit timezone", () => {
  const messages = parseMessageImport(
    "name,message,datetime\nAn,God bless you,2026-06-20T11:03:00+08:00\n",
  );
  assert.equal(messages[0].messageAt, "2026-06-20T03:03:00.000Z");
});

test("keeps the legacy date header and defaults it to local midnight", () => {
  const messages = parseMessageImport(
    "姓名,留言,日期\n小安,百年好合,2026-06-20\n",
  );
  const date = new Date(messages[0].messageAt);
  assert.equal(date.getFullYear(), 2026);
  assert.equal(date.getMonth(), 5);
  assert.equal(date.getDate(), 20);
  assert.equal(date.getHours(), 0);
  assert.equal(date.getMinutes(), 0);
});

test("parses TSV and defaults an omitted datetime", () => {
  const messages = parseMessageImport("name\tmessage\nAn\tGod bless you\n");
  assert.equal(messages.length, 1);
  assert.equal(messages[0].visitorName, "An");
  assert.equal(messages[0].body, "God bless you");
  assert.ok(Number.isFinite(new Date(messages[0].messageAt).getTime()));
});

test("rejects an invalid hour or minute", () => {
  for (const value of ["2026-06-20 24:00", "2026-06-20T11:60"]) {
    assert.throws(
      () => parseMessageImport(`name,message,datetime\nAn,Blessings,${value}\n`),
      (error) => error?.code === "INVALID_MESSAGE_IMPORT",
    );
  }
});

test("rejects a missing required header", () => {
  assert.throws(
    () => parseMessageImport("name,datetime\nAn,2026-06-20 11:03\n"),
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
