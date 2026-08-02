import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { normalizeProcessSelectorSettings } from "../src/process-selector-settings.mjs";
import { createGuestFeaturedSettingsApis } from "../src/server/settings/guest-featured-api.mjs";

function jsonResponse() {
  return {
    status: null,
    body: null,
    writeHead(status) {
      this.status = status;
    },
    end(body) {
      this.body = JSON.parse(body);
    },
  };
}

function jsonRequest(path, body) {
  const request = Readable.from([Buffer.from(JSON.stringify(body))]);
  request.method = "PATCH";
  request.url = path;
  return request;
}

test("label auto scroll defaults on and preserves an explicit off value", () => {
  assert.equal(
    normalizeProcessSelectorSettings().processLabelAutoScrollEnabled,
    true,
  );
  assert.equal(
    normalizeProcessSelectorSettings({
      processLabelAutoScrollEnabled: false,
    }).processLabelAutoScrollEnabled,
    false,
  );
});

test("process selector settings persist the auto-scroll switch with wheel settings", async () => {
  const queries = [];
  const pool = {
    async query(sql, values = []) {
      queries.push({ sql, values });
      return { rows: [] };
    },
  };
  const { adminApi } = createGuestFeaturedSettingsApis({ pool });
  const response = jsonResponse();
  const handled = await adminApi(
    jsonRequest("/admin/api/settings/process-selector", {
      processWheelEnabled: true,
      processWheelVisibleCount: 6,
      processWheelLoopAlbumIds: ["wedding"],
      processLabelAutoScrollEnabled: false,
    }),
    response,
    new URL("http://localhost/admin/api/settings/process-selector"),
  );

  assert.equal(handled, true);
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {
    processWheelEnabled: true,
    processWheelVisibleCount: 6,
    processWheelLoopAlbumIds: ["wedding"],
    processLabelAutoScrollEnabled: false,
  });
  assert.equal(
    queries.some(({ values }) =>
      values.includes("process_label_auto_scroll_enabled"),
    ),
    true,
  );
});

test("label selection uses one smooth sticky-selector scroll path", async () => {
  const [selector, autoScroll, settingsUi] = await Promise.all([
    readFile(
      new URL("../src/client/ProcessSelector.jsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/client/LabelAutoScroll.jsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/client/ProcessSelectorSettings.jsx", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(selector, /<LabelAutoScroll/);
  assert.doesNotMatch(selector, /useEffect|scrollIntoView/);
  assert.match(autoScroll, /\.process-selector-sticky/);
  assert.match(autoScroll, /scrollIntoView\(\{/);
  assert.match(autoScroll, /preferredLabelScrollBehavior/);
  assert.match(autoScroll, /prefers-reduced-motion: reduce/);
  assert.match(autoScroll, /return reduceMotion \? "auto" : "smooth"/);
  assert.match(autoScroll, /block: "start"/);
  assert.match(selector, /processLabelAutoScrollEnabled !== false/);
  assert.doesNotMatch(autoScroll, /window\.scrollTo|window\.scrollBy/);
  assert.match(settingsUi, /選中標籤後自動捲動至內容開頭/);
  assert.match(settingsUi, /\/admin\/api\/settings\/process-selector/);
});
