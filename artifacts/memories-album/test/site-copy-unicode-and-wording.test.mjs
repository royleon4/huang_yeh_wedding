import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_SITE_COPY,
  isValidSiteCopyPatch,
  normalizeSiteCopy,
} from "../src/site-copy.mjs";

test("site copy truncation counts Unicode characters without splitting emoji", () => {
  const title = `${"a".repeat(199)}😀extra`;
  const normalized = normalizeSiteCopy({ zh: { archive: title } });
  assert.equal(Array.from(normalized.zh.archive).length, 200);
  assert.equal(normalized.zh.archive.endsWith("😀"), true);
  assert.equal(normalized.zh.archive.includes("\uFFFD"), false);
});

test("site copy validators use the same Unicode character definition", () => {
  assert.equal(
    isValidSiteCopyPatch({ zh: { archive: "😀".repeat(200) } }),
    true,
  );
  assert.equal(
    isValidSiteCopyPatch({ zh: { archive: "😀".repeat(201) } }),
    false,
  );
});

test("default coming-soon copy does not promise an obsolete phase schedule", () => {
  assert.doesNotMatch(DEFAULT_SITE_COPY.zh.comingBody, /第二階段/);
  assert.doesNotMatch(DEFAULT_SITE_COPY.en.comingBody, /Phase 2/i);
  assert.match(DEFAULT_SITE_COPY.zh.comingBody, /尚未開放/);
  assert.match(DEFAULT_SITE_COPY.en.comingBody, /not available yet/i);
});
