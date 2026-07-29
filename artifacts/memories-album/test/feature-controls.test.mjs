import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const adminSourceUrl = new URL(
  "../src/client/ProcessSyncAdmin.jsx",
  import.meta.url,
);
const adminApiSourceUrl = new URL(
  "../src/client/admin-api.mjs",
  import.meta.url,
);
const enhancementsSourceUrl = new URL(
  "../src/client/GalleryEnhancements.jsx",
  import.meta.url,
);
const bottomNavSourceUrl = new URL(
  "../src/client/BottomCollectionNav.jsx",
  import.meta.url,
);
const stylesUrl = new URL("../src/client/feature-controls.css", import.meta.url);
const bulkPhotoStylesUrl = new URL(
  "../src/client/bulk-photo-admin.css",
  import.meta.url,
);
const bottomNavStylesUrl = new URL(
  "../src/client/bottom-collection-nav.css",
  import.meta.url,
);
const appSourceUrl = new URL("../src/client/App.jsx", import.meta.url);
const mainSourceUrl = new URL("../src/client/main.jsx", import.meta.url);

test("feature navigation is hidden by default and only changed through admin API", async () => {
  const [adminSource, styles] = await Promise.all([
    readFile(adminSourceUrl, "utf8"),
    readFile(stylesUrl, "utf8"),
  ]);
  assert.match(
    adminSource,
    /document\.documentElement\.dataset\.memoriesPrimaryNav = "hidden"/,
  );
  assert.match(styles, /data-memories-primary-nav="hidden"[^}]+\.primary-nav/s);
  assert.match(adminSource, /\/Memories\/api\/admin\/settings/);
});

test("admin has no visible URL or button entrance and opens after five title taps", async () => {
  const [adminSource, appSource, styles] = await Promise.all([
    readFile(adminSourceUrl, "utf8"),
    readFile(appSourceUrl, "utf8"),
    readFile(stylesUrl, "utf8"),
  ]);
  assert.doesNotMatch(adminSource, /searchParams.*admin|\?admin=1/);
  assert.match(adminSource, /tapsRef\.current\.length < 5/);
  assert.match(adminSource, /\/Memories\/api\/admin\/session/);
  assert.match(styles, /\.header-tools \.quiet-button:first-child\s*{\s*display: none;/);
  assert.match(appSource, /className="archive-header"/);
});

test("successful admin authentication renders before storage refresh", async () => {
  const source = await readFile(adminSourceUrl, "utf8");
  assert.match(
    source,
    /sessionStorage\.setItem\("memories-admin-token", token\);[\s\S]*setAuthenticated\(true\);[\s\S]*setBusy\(false\);[\s\S]*window\.setTimeout/,
  );
  assert.doesNotMatch(
    source,
    /setAuthenticated\(true\);\s*await refresh\(\);/,
  );
  assert.match(source, /已登入；分類與設定載入逾時/);
});

test("admin requests have a bounded timeout instead of spinning forever", async () => {
  const source = await readFile(adminApiSourceUrl, "utf8");
  assert.match(source, /new AbortController\(\)/);
  assert.match(source, /controller\.abort\(\)/);
  assert.match(source, /REQUEST_TIMEOUT/);
  assert.match(source, /伺服器回應逾時/);
});

test("collection controls remain sticky and span the viewport", async () => {
  const styles = await readFile(stylesUrl, "utf8");
  assert.match(styles, /\.process-section\s*{[^}]*position: sticky;[^}]*top: 0;/s);
  assert.match(styles, /\.process-section\s*{[^}]*width: 100vw;/s);
  assert.match(styles, /margin-left: calc\(50% - 50vw\)/);
});

test("collections and upload are separated into a fixed bottom navigation", async () => {
  const [source, styles, mainSource] = await Promise.all([
    readFile(bottomNavSourceUrl, "utf8"),
    readFile(bottomNavStylesUrl, "utf8"),
    readFile(mainSourceUrl, "utf8"),
  ]);
  assert.match(source, /婚禮流程/);
  assert.match(source, /訪客上傳/);
  assert.match(source, /生活照/);
  assert.match(source, /className="bottom-upload-action"/);
  assert.match(source, /document\.querySelector\("\.floating-upload-button"\)/);
  assert.match(styles, /\.bottom-collection-nav\s*{[^}]*position: fixed;/s);
  assert.match(styles, /\.collection-tabs,[\s\S]*\.floating-upload-button[\s\S]*display: none !important;/);
  assert.match(styles, /\.bottom-upload-action\s*{[^}]*background: linear-gradient/s);
  assert.match(mainSource, /<BottomCollectionNav \/>/);
});

test("changing a collection or process scrolls to the first gallery item", async () => {
  const source = await readFile(enhancementsSourceUrl, "utf8");
  assert.match(source, /closest\("\.process-chip, \.collection-tab"\)/);
  assert.match(source, /document\.getElementById\("archive-gallery"\)/);
  assert.match(source, /window\.scrollTo\(\{ top: Math\.max\(0, top\), behavior: "smooth" \}\)/);
});

test("authenticated admin can delete one or multiple selected photos", async () => {
  const [source, styles, mainSource] = await Promise.all([
    readFile(enhancementsSourceUrl, "utf8"),
    readFile(bulkPhotoStylesUrl, "utf8"),
    readFile(mainSourceUrl, "utf8"),
  ]);
  assert.match(source, /sessionStorage\.getItem\("memories-admin-token"\)/);
  assert.match(source, /\/Memories\/api\/admin\/photos\//);
  assert.match(source, /method: "DELETE"/);
  assert.match(source, /const selectedPhotoIds = new Set\(\)/);
  assert.match(source, /data-select-visible/);
  assert.match(source, /data-delete-selected/);
  assert.match(source, /刪除這張/);
  assert.match(source, /刪除已選/);
  assert.match(styles, /\.admin-photo-selector\s*{/);
  assert.match(styles, /\.admin-photo-bulk-toolbar\s*{[^}]*position: fixed;/s);
  assert.match(mainSource, /import "\.\/bulk-photo-admin\.css"/);
  assert.match(mainSource, /<GalleryEnhancements \/>/);
});

test("React renders before the process API finishes", async () => {
  const source = await readFile(mainSourceUrl, "utf8");
  assert.doesNotMatch(source, /^await hydrateProcessesFromServer\(\);/m);
  assert.match(source, /useEffect\(\(\) => \{/);
  assert.match(source, /void hydrateProcessesFromServer\(\)\.then/);
  assert.match(source, /createRoot\(document\.getElementById\("root"\)\)\.render/);
});
