import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import test from "node:test";
import { processContentUiTransform } from "../process-content-ui-transform.mjs";
import { websiteCopyUiTransform } from "../website-copy-ui-transform.mjs";
import {
  DEFAULT_SITE_COPY,
  isValidSiteCopy,
  normalizeSiteCopy,
} from "../src/site-copy.mjs";
import {
  createAdminSettingsApi,
  createSettingsApi,
} from "../src/server/settings/api.mjs";

function customCopy() {
  const copy = normalizeSiteCopy(DEFAULT_SITE_COPY);
  copy.zh.archive = "詠葉婚禮\n照片檔案館";
  copy.zh.subtitle = "我們自己編輯的網站說明";
  copy.en.archive = "Leon & YehYeh\nWedding Archive";
  return copy;
}

async function withSettingsServer(run) {
  let siteCopy = normalizeSiteCopy(DEFAULT_SITE_COPY);
  const repository = {
    async getPublicSettings() {
      return { siteCopy };
    },
    async setSiteCopy(value) {
      siteCopy = normalizeSiteCopy(value);
      return { siteCopy };
    },
  };
  const publicApi = createSettingsApi({ repository });
  const adminApi = createAdminSettingsApi({ repository });
  const server = createServer(async (request, response) => {
    if (!(await publicApi(request, response)) && !(await adminApi(request, response))) {
      response.statusCode = 404;
      response.end();
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

test("site copy normalization preserves deliberate title line breaks", () => {
  const normalized = normalizeSiteCopy({
    zh: { archive: "  詠葉婚禮\r\n照片檔案館  " },
  });
  assert.equal(normalized.zh.archive, "詠葉婚禮\n照片檔案館");
  assert.equal(normalized.en.archive, DEFAULT_SITE_COPY.en.archive);
  assert.equal(isValidSiteCopy(customCopy()), true);
  assert.equal(isValidSiteCopy({ zh: {}, en: {} }), false);
});

test("administrator website copy saves and is returned by the public settings API", async () => {
  await withSettingsServer(async (origin) => {
    const expected = customCopy();
    const update = await fetch(`${origin}/admin/api/settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ siteCopy: expected }),
    });
    assert.equal(update.status, 200);
    assert.deepEqual((await update.json()).siteCopy, expected);

    const publicResponse = await fetch(`${origin}/Memories/api/settings`);
    assert.equal(publicResponse.status, 200);
    assert.deepEqual((await publicResponse.json()).siteCopy, expected);
  });
});

test("invalid or oversized website copy is rejected", async () => {
  await withSettingsServer(async (origin) => {
    const invalid = customCopy();
    invalid.zh.archive = "x".repeat(201);
    const response = await fetch(`${origin}/admin/api/settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ siteCopy: invalid }),
    });
    assert.equal(response.status, 422);
    assert.equal((await response.json()).code, "INVALID_SETTING");
  });
});

test("production transform hydrates website copy and renders multiline titles", async () => {
  const source = await readFile(new URL("../src/client/App.jsx", import.meta.url), "utf8");
  const id = "/workspace/src/client/App.jsx";
  const processCode = processContentUiTransform().transform(source, id).code;
  const finalCode = websiteCopyUiTransform().transform(processCode, id).code;
  assert.match(finalCode, /normalizeSiteCopy\(settings\.siteCopy\)/);
  assert.match(finalCode, /const t = \{ \.\.\.COPY\[lang\], \.\.\.siteCopy\[lang\] \}/);
  assert.match(finalCode, /<p className="eyebrow">\{t\.headerEyebrow\}<\/p>/);
  assert.match(finalCode, /import "\.\/site-copy\.css"/);
  assert.match(finalCode, /\[lang, t\.archive\]/);
});

test("administrator general settings exposes the website copy editor", async () => {
  const [general, editor, repository, vite] = await Promise.all([
    readFile(new URL("../src/client/GeneralSettings.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/client/WebsiteCopySettings.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/server/settings/repository.mjs", import.meta.url), "utf8"),
    readFile(new URL("../vite.config.js", import.meta.url), "utf8"),
  ]);
  assert.match(general, /<WebsiteCopySettings \/>/);
  assert.match(editor, /body: \{ siteCopy: draft \}/);
  assert.match(editor, /rows=\{field\.key === "archive" \? 3 : 4\}/);
  assert.match(repository, /SITE_COPY_KEY/);
  assert.match(repository, /setSiteCopy/);
  assert.match(vite, /websiteCopyUiTransform\(\)/);
  assert.match(vite, /runtime\.adminSettingsApi/);
});
