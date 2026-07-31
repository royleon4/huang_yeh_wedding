import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import test from "node:test";
import sharp from "sharp";
import {
  EMPTY_SITE_ICON_METADATA,
  SITE_ICON_ADMIN_PATH,
  SITE_ICON_FILE_ERROR_CODES,
  SITE_ICON_MAX_UPLOAD_BYTES,
  SITE_ICON_OUTPUT_CONTENT_TYPE,
  SITE_ICON_OUTPUT_SIZE,
  SITE_ICON_PUBLIC_PATH,
  normalizeSiteIconMetadata,
  normalizeStoredSiteIcon,
  siteIconMetadata,
  validateSiteIconFile,
} from "../src/site-icon.mjs";
import {
  applySiteIcon,
  loadAdminSiteIcon,
  removeAdminSiteIcon,
  replaceAdminSiteIcon,
} from "../src/client/site-icon-client.mjs";
import {
  createAdminSettingsApi,
  createSettingsApi,
} from "../src/server/settings/api.mjs";

async function withSiteIconServer(run) {
  let icon = null;
  const repository = {
    async getPublicSettings() {
      return { siteIcon: siteIconMetadata(icon) };
    },
    async getSiteIcon() {
      return icon;
    },
    async setSiteIcon(value) {
      icon = normalizeStoredSiteIcon(value);
      return icon;
    },
    async clearSiteIcon() {
      icon = null;
      return null;
    },
  };
  const publicApi = createSettingsApi({ repository });
  const adminApi = createAdminSettingsApi({ repository });
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    if (
      !(await publicApi(request, response, url)) &&
      !(await adminApi(request, response, url))
    ) {
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

async function sourcePng() {
  return sharp({
    create: {
      width: 48,
      height: 32,
      channels: 4,
      background: { r: 57, g: 91, b: 73, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
}

function configuredMetadata() {
  return {
    configured: true,
    contentType: "image/png",
    version: "a".repeat(64),
    byteLength: 4,
  };
}

function fakeDocument() {
  const links = [];
  const head = {
    querySelector(selector) {
      const rel = selector.match(/link\[rel="([^"]+)"\]/)?.[1];
      return links.find(
        (link) => link.rel === rel && link.dataset.memoriesSiteIcon === "true",
      );
    },
    append(link) {
      links.push(link);
    },
  };
  return {
    links,
    head,
    createElement() {
      return { dataset: {} };
    },
  };
}

test("stored site icon and public metadata share one validated contract", () => {
  const stored = {
    ...configuredMetadata(),
    data: Buffer.from("icon").toString("base64"),
  };
  delete stored.configured;
  assert.deepEqual(normalizeStoredSiteIcon(stored), stored);
  assert.deepEqual(siteIconMetadata(stored), configuredMetadata());
  assert.equal(Object.hasOwn(siteIconMetadata(stored), "data"), false);
  assert.equal(normalizeStoredSiteIcon({ ...stored, byteLength: 5 }), null);
  assert.deepEqual(normalizeSiteIconMetadata(configuredMetadata()), configuredMetadata());
  assert.equal(
    normalizeSiteIconMetadata({ ...configuredMetadata(), version: "invalid" }),
    EMPTY_SITE_ICON_METADATA,
  );
});

test("site icon file validation is shared by the administrator editor", () => {
  assert.deepEqual(validateSiteIconFile(null), {
    valid: false,
    code: SITE_ICON_FILE_ERROR_CODES.required,
  });
  assert.deepEqual(validateSiteIconFile({ type: "image/gif", size: 10 }), {
    valid: false,
    code: SITE_ICON_FILE_ERROR_CODES.unsupportedType,
  });
  assert.deepEqual(
    validateSiteIconFile({
      type: "image/png",
      size: SITE_ICON_MAX_UPLOAD_BYTES + 1,
    }),
    { valid: false, code: SITE_ICON_FILE_ERROR_CODES.tooLarge },
  );
  assert.deepEqual(validateSiteIconFile({ type: "image/webp", size: 10 }), {
    valid: true,
    code: null,
  });
});

test("site icon client commands preserve request methods and normalize responses", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      status: 200,
      async json() {
        return configuredMetadata();
      },
    };
  };
  const file = { type: "image/png", size: 4 };
  assert.deepEqual(await loadAdminSiteIcon({ fetchImpl }), configuredMetadata());
  assert.deepEqual(
    await replaceAdminSiteIcon(file, { fetchImpl }),
    configuredMetadata(),
  );
  assert.deepEqual(await removeAdminSiteIcon({ fetchImpl }), configuredMetadata());
  assert.deepEqual(
    calls.map((call) => call.options.method),
    ["GET", "PUT", "DELETE"],
  );
  assert.equal(calls[1].options.body, file);
  assert.equal(calls[1].options.headers["Content-Type"], "image/png");
  assert.equal(calls[2].options.body, undefined);
});

test("browser and Apple icon links use the same validated metadata", () => {
  const documentRef = fakeDocument();
  applySiteIcon(configuredMetadata(), documentRef, () => 123);
  assert.equal(documentRef.links.length, 2);
  assert.deepEqual(
    documentRef.links.map((link) => link.rel),
    ["icon", "apple-touch-icon"],
  );
  assert.ok(
    documentRef.links.every((link) =>
      link.href.includes(`v=${"a".repeat(64)}`),
    ),
  );

  applySiteIcon(EMPTY_SITE_ICON_METADATA, documentRef, () => 456);
  assert.equal(documentRef.links.length, 2, "existing link nodes are reused");
  assert.ok(
    documentRef.links.every((link) => link.href.endsWith("?removed=456")),
  );
});

test("administrator uploads a normalized PNG favicon and can remove it", async () => {
  await withSiteIconServer(async (origin) => {
    const before = await fetch(`${origin}${SITE_ICON_ADMIN_PATH}`);
    assert.equal(before.status, 200);
    assert.equal((await before.json()).configured, false);

    const upload = await fetch(`${origin}${SITE_ICON_ADMIN_PATH}`, {
      method: "PUT",
      headers: { "Content-Type": "image/png" },
      body: await sourcePng(),
    });
    assert.equal(upload.status, 200);
    const metadata = await upload.json();
    assert.equal(metadata.configured, true);
    assert.equal(metadata.contentType, SITE_ICON_OUTPUT_CONTENT_TYPE);
    assert.match(metadata.version, /^[a-f0-9]{64}$/);
    assert.ok(metadata.byteLength > 0);

    const publicIcon = await fetch(`${origin}${SITE_ICON_PUBLIC_PATH}`);
    assert.equal(publicIcon.status, 200);
    assert.equal(publicIcon.headers.get("content-type"), "image/png");
    assert.equal(publicIcon.headers.get("cache-control"), "no-cache, max-age=0");
    const bytes = Buffer.from(await publicIcon.arrayBuffer());
    const imageMetadata = await sharp(bytes).metadata();
    assert.equal(imageMetadata.width, SITE_ICON_OUTPUT_SIZE);
    assert.equal(imageMetadata.height, SITE_ICON_OUTPUT_SIZE);

    const notModified = await fetch(`${origin}${SITE_ICON_PUBLIC_PATH}`, {
      headers: { "If-None-Match": `"${metadata.version}"` },
    });
    assert.equal(notModified.status, 304);

    const remove = await fetch(`${origin}${SITE_ICON_ADMIN_PATH}`, {
      method: "DELETE",
    });
    assert.equal(remove.status, 200);
    assert.equal((await remove.json()).configured, false);
    assert.equal((await fetch(`${origin}${SITE_ICON_PUBLIC_PATH}`)).status, 404);
  });
});

test("site icon upload rejects unsupported or invalid files", async () => {
  await withSiteIconServer(async (origin) => {
    const unsupported = await fetch(`${origin}${SITE_ICON_ADMIN_PATH}`, {
      method: "PUT",
      headers: { "Content-Type": "image/gif" },
      body: Buffer.from("gif"),
    });
    assert.equal(unsupported.status, 415);
    assert.equal((await unsupported.json()).code, "UNSUPPORTED_SITE_ICON_TYPE");

    const invalid = await fetch(`${origin}${SITE_ICON_ADMIN_PATH}`, {
      method: "PUT",
      headers: { "Content-Type": "image/png" },
      body: Buffer.from("not-an-image"),
    });
    assert.equal(invalid.status, 422);
    assert.equal((await invalid.json()).code, "INVALID_SITE_ICON");
  });
});

test("general settings exposes a responsive unified-save site icon editor", async () => {
  const [general, editor, client, shared, css, html, repository, api, build] =
    await Promise.all([
      readFile(new URL("../src/client/GeneralSettings.jsx", import.meta.url), "utf8"),
      readFile(new URL("../src/client/SiteIconSettings.jsx", import.meta.url), "utf8"),
      readFile(new URL("../src/client/site-icon-client.mjs", import.meta.url), "utf8"),
      readFile(new URL("../src/site-icon.mjs", import.meta.url), "utf8"),
      readFile(new URL("../src/client/site-icon-settings.css", import.meta.url), "utf8"),
      readFile(new URL("../index.html", import.meta.url), "utf8"),
      readFile(new URL("../src/server/settings/repository.mjs", import.meta.url), "utf8"),
      readFile(new URL("../src/server/settings/api.mjs", import.meta.url), "utf8"),
      readFile(new URL("../scripts/build.mjs", import.meta.url), "utf8"),
    ]);

  assert.match(general, /<SiteIconSettings \/>/);
  assert.match(editor, /useAdminSaveSection\("site-icon"/);
  assert.match(editor, /type="file"/);
  assert.match(editor, /validateSiteIconFile/);
  assert.match(editor, /kind: "replace"/);
  assert.match(editor, /kind: "remove"/);
  assert.match(editor, /replaceAdminSiteIcon/);
  assert.match(editor, /removeAdminSiteIcon/);
  assert.match(client, /normalizeSiteIconMetadata/);
  assert.doesNotMatch(client, /VERSION_PATTERN/);
  assert.match(client, /apple-touch-icon/);
  assert.match(shared, /EMPTY_SITE_ICON_METADATA/);
  assert.match(shared, /SITE_ICON_FILE_ERROR_CODES/);
  assert.match(css, /aspect-ratio:\s*1/);
  assert.match(css, /min-height:\s*2\.75rem/);
  assert.match(css, /@media \(max-width: 420px\)/);
  assert.match(html, /rel="icon"/);
  assert.match(html, /rel="apple-touch-icon"/);
  assert.match(html, /data-memories-site-icon/);
  assert.match(repository, /SITE_ICON_KEY/);
  assert.match(repository, /setSiteIcon/);
  assert.match(repository, /clearSiteIcon/);
  assert.match(api, /createAdminSiteIconApi/);
  assert.match(api, /createSiteIconApi/);
  assert.match(build, /cp\("src\/site-icon\.mjs", "dist\/site-icon\.mjs"\)/);
});
