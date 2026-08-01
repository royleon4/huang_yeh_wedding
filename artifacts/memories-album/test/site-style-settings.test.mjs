import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import test from "node:test";
import sharp from "sharp";
import { DEFAULT_SITE_COPY, normalizeSiteCopy } from "../src/site-copy.mjs";
import {
  DEFAULT_SITE_STYLE,
  HERO_BACKGROUND_ADMIN_PATH,
  HERO_BACKGROUND_OUTPUT_HEIGHT,
  HERO_BACKGROUND_OUTPUT_WIDTH,
  HERO_BACKGROUND_PUBLIC_PATH,
  applySiteStyle,
  heroBackgroundMetadata,
  isValidSiteStyle,
  normalizeSiteStyle,
  normalizeStoredHeroBackground,
  siteStyleCssVariables,
} from "../src/site-style.mjs";
import {
  createAdminSettingsApi,
  createSettingsApi,
} from "../src/server/settings/api.mjs";

function customStyle() {
  return {
    ...DEFAULT_SITE_STYLE,
    paperColor: "#eee8dc",
    primaryColor: "#245a47",
    heroTitleColor: "#173b31",
    heroOverlayOpacity: 0.55,
    bottomNavBackgroundColor: "#fffaf0",
  };
}

async function sourceImage() {
  return sharp({
    create: {
      width: 800,
      height: 1200,
      channels: 4,
      background: { r: 42, g: 91, b: 73, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
}

async function withStyleServer(run) {
  let siteStyle = normalizeSiteStyle(DEFAULT_SITE_STYLE);
  let siteCopy = normalizeSiteCopy(DEFAULT_SITE_COPY);
  let heroBackground = null;
  const repository = {
    async getPublicSettings() {
      return {
        siteStyle,
        siteCopy,
        heroBackground: heroBackgroundMetadata(heroBackground),
      };
    },
    async setSiteStyle(value) {
      siteStyle = normalizeSiteStyle(value);
      return { siteStyle };
    },
    async setSiteCopy(value) {
      siteCopy = normalizeSiteCopy(value);
      return { siteCopy };
    },
    async getHeroBackground() {
      return heroBackground;
    },
    async setHeroBackground(value) {
      heroBackground = normalizeStoredHeroBackground(value);
      return heroBackground;
    },
    async clearHeroBackground() {
      heroBackground = null;
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

test("site style validation and CSS variables keep a readable typed contract", () => {
  const style = customStyle();
  assert.equal(isValidSiteStyle(style), true);
  assert.equal(isValidSiteStyle({ ...style, primaryColor: "green" }), false);
  assert.equal(isValidSiteStyle({ ...style, heroOverlayOpacity: 1 }), false);
  assert.equal(normalizeSiteStyle({ heroOverlayOpacity: -1 }).heroOverlayOpacity, 0);
  assert.equal(normalizeSiteStyle({ heroOverlayOpacity: 4 }).heroOverlayOpacity, 0.95);

  const variables = siteStyleCssVariables(style);
  assert.equal(variables["--paper"], "#eee8dc");
  assert.equal(variables["--leaf"], "#245a47");
  assert.equal(variables["--memories-hero-title-color"], "#173b31");
  assert.equal(variables["--memories-hero-overlay-opacity"], "0.55");
  assert.match(variables["--memories-hero-overlay-layer"], /0\.55/);
});

test("site style is applied before render without exposing image bytes", () => {
  const properties = new Map();
  const root = {
    style: {
      setProperty(name, value) {
        properties.set(name, value);
      },
    },
    dataset: {},
  };
  const metadata = {
    configured: true,
    contentType: "image/webp",
    version: "a".repeat(64),
    byteLength: 1234,
    width: HERO_BACKGROUND_OUTPUT_WIDTH,
    height: HERO_BACKGROUND_OUTPUT_HEIGHT,
  };
  applySiteStyle({ siteStyle: customStyle(), heroBackground: metadata }, root);
  assert.equal(root.dataset.memoriesHeroBackground, "true");
  assert.match(
    properties.get("--memories-hero-background-image"),
    /site-style\/hero-background\?v=/,
  );
  assert.equal(properties.get("--memories-bottom-nav-background"), "#fffaf0");
});

test("administrator can save colors and a normalized 1600 by 900 WebP hero background", async () => {
  await withStyleServer(async (origin) => {
    const style = customStyle();
    const styleResponse = await fetch(`${origin}/admin/api/settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ siteStyle: style }),
    });
    assert.equal(styleResponse.status, 200);
    assert.deepEqual((await styleResponse.json()).siteStyle, style);

    const upload = await fetch(`${origin}${HERO_BACKGROUND_ADMIN_PATH}`, {
      method: "PUT",
      headers: { "Content-Type": "image/png" },
      body: await sourceImage(),
    });
    assert.equal(upload.status, 200);
    const metadata = await upload.json();
    assert.equal(metadata.configured, true);
    assert.equal(metadata.contentType, "image/webp");
    assert.equal(metadata.width, HERO_BACKGROUND_OUTPUT_WIDTH);
    assert.equal(metadata.height, HERO_BACKGROUND_OUTPUT_HEIGHT);
    assert.equal(Object.hasOwn(metadata, "data"), false);

    const imageResponse = await fetch(`${origin}${HERO_BACKGROUND_PUBLIC_PATH}`);
    assert.equal(imageResponse.status, 200);
    assert.equal(imageResponse.headers.get("content-type"), "image/webp");
    const image = await sharp(Buffer.from(await imageResponse.arrayBuffer())).metadata();
    assert.equal(image.width, HERO_BACKGROUND_OUTPUT_WIDTH);
    assert.equal(image.height, HERO_BACKGROUND_OUTPUT_HEIGHT);

    const publicSettings = await fetch(`${origin}/Memories/api/settings`).then(
      (response) => response.json(),
    );
    assert.equal(publicSettings.siteStyle.heroOverlayOpacity, 0.55);
    assert.equal(publicSettings.heroBackground.configured, true);
    assert.equal(Object.hasOwn(publicSettings.heroBackground, "data"), false);

    const remove = await fetch(`${origin}${HERO_BACKGROUND_ADMIN_PATH}`, {
      method: "DELETE",
    });
    assert.equal(remove.status, 200);
    assert.equal((await remove.json()).configured, false);
  });
});

test("administrator style card combines background guidance, opacity, title, and reusable colors", async () => {
  const [general, component, componentCss, publicCss, bootstrap, transform, build] =
    await Promise.all([
      readFile(new URL("../src/client/GeneralSettings.jsx", import.meta.url), "utf8"),
      readFile(new URL("../src/client/SiteStyleSettings.jsx", import.meta.url), "utf8"),
      readFile(new URL("../src/client/site-style-settings.css", import.meta.url), "utf8"),
      readFile(new URL("../src/client/site-style-public.css", import.meta.url), "utf8"),
      readFile(new URL("../src/client/public-bootstrap.mjs", import.meta.url), "utf8"),
      readFile(new URL("../public-bootstrap-ui-transform.mjs", import.meta.url), "utf8"),
      readFile(new URL("../scripts/build.mjs", import.meta.url), "utf8"),
    ]);

  assert.match(general, /<SiteStyleSettings \/>/);
  assert.match(component, /樣式與首頁首圖/);
  assert.match(component, /1600 × 900/);
  assert.match(component, /PNG、JPG／JPEG、WebP/);
  assert.match(component, /type="range"/);
  assert.match(component, /網站主標題/);
  assert.match(component, /type="color"/);
  assert.match(component, /useAdminSaveSection\("site-style"/);
  assert.match(componentCss, /site-style-preview/);
  assert.match(componentCss, /grid-template-columns/);
  assert.match(componentCss, /@media \(max-width: 620px\)/);
  assert.match(publicCss, /data-memories-hero-background="true"/);
  assert.match(publicCss, /--memories-hero-background-image/);
  assert.match(bootstrap, /normalizeSiteStyle/);
  assert.match(bootstrap, /normalizeHeroBackgroundMetadata/);
  assert.match(transform, /applySiteStyle/);
  assert.match(transform, /await loadPublicBootstrap\(\)/);
  assert.match(build, /src\/image-setting\.mjs/);
  assert.match(build, /src\/site-style\.mjs/);
});
