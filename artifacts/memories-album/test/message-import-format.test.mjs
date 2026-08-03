import assert from "node:assert/strict";
import test from "node:test";
import { parseMessageImport } from "../src/server/messages/import-format.mjs";

test("parses bilingual CSV headers and a local datetime to the minute", () => {
  const messages = parseMessageImport(
    '\uFEFF姓名,留言,日期時間\n小安,"祝福你們，永遠幸福",2026-06-20 11:03\n',
    { timeZoneOffsetMinutes: -480 },
  );
  assert.equal(messages.length, 1);
  assert.equal(messages[0].visitorName, "小安");
  assert.equal(messages[0].body, "祝福你們，永遠幸福");
  assert.equal(messages[0].messageAt, "2026-06-20T03:03:00.000Z");
});

test("parses ISO datetime values with an explicit timezone", () => {
  const messages = parseMessageImport(
    "name,message,datetime\nAn,God bless you,2026-06-20T11:03:00+08:00\n",
    { timeZoneOffsetMinutes: 720 },
  );
  assert.equal(messages[0].messageAt, "2026-06-20T03:03:00.000Z");
});

test("keeps the legacy date header and applies the administrator timezone", () => {
  const messages = parseMessageImport(
    "姓名,留言,日期\n小安,百年好合,2026-06-20\n",
    { timeZoneOffsetMinutes: -480 },
  );
  assert.equal(messages[0].messageAt, "2026-06-19T16:00:00.000Z");
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

test("rejects an invalid administrator timezone offset", () => {
  for (const value of [841, -841, 30.5, "unknown"]) {
    assert.throws(
      () =>
        parseMessageImport("name,message,datetime\nAn,Blessings,2026-06-20 11:03\n", {
          timeZoneOffsetMinutes: value,
        }),
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
