import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const adminSourceUrl = new URL(
  "../src/client/ProcessSyncAdmin.jsx",
  import.meta.url,
);
const appSourceUrl = new URL("../src/client/App.jsx", import.meta.url);
const bottomNavSourceUrl = new URL(
  "../src/client/BottomCollectionNav.jsx",
  import.meta.url,
);
const stateSourceUrl = new URL(
  "../src/client/MemoriesState.jsx",
  import.meta.url,
);
const stylesUrl = new URL(
  "../src/client/feature-controls.css",
  import.meta.url,
);
const bulkPhotoStylesUrl = new URL(
  "../src/client/bulk-photo-admin.css",
  import.meta.url,
);
const bottomNavStylesUrl = new URL(
  "../src/client/bottom-collection-nav.css",
  import.meta.url,
);
const mainSourceUrl = new URL("../src/client/main.jsx", import.meta.url);

test("feature navigation is hidden by React state and changed through admin API", async () => {
  const [adminSource, appSource, styles] = await Promise.all([
    readFile(adminSourceUrl, "utf8"),
    readFile(appSourceUrl, "utf8"),
    readFile(stylesUrl, "utf8"),
  ]);
  assert.match(adminSource, /setPrimaryNavigationVisible/);
  assert.match(adminSource, /\/Memories\/api\/admin\/settings/);
  assert.match(appSource, /primaryNavigationVisible \? "" : "is-hidden"/);
  assert.match(styles, /\.primary-nav\.is-hidden\s*{\s*display: none;/);
});

test("admin has no visible URL or button entrance and opens after five title taps", async () => {
  const [adminSource, appSource, stateSource] = await Promise.all([
    readFile(adminSourceUrl, "utf8"),
    readFile(appSourceUrl, "utf8"),
    readFile(stateSourceUrl, "utf8"),
  ]);
  assert.doesNotMatch(adminSource, /searchParams.*admin|\?admin=1/);
  assert.match(stateSource, /titleTaps\.current\.length < 5/);
  assert.match(adminSource, /\/Memories\/api\/admin\/session/);
  assert.match(appSource, /onClick=\{recordArchiveTitleTap\}/);
  assert.doesNotMatch(appSource, />\s*\{adminMode \?/);
});

test("collection controls remain sticky and span the viewport", async () => {
  const styles = await readFile(stylesUrl, "utf8");
  assert.match(
    styles,
    /\.process-section\s*{[^}]*position: sticky;[^}]*top: 0;/s,
  );
  assert.match(styles, /\.process-section\s*{[^}]*width: 100vw;/s);
  assert.match(styles, /margin-left: calc\(50% - 50vw\)/);
});

test("bottom navigation calls shared React state directly", async () => {
  const [source, styles, mainSource] = await Promise.all([
    readFile(bottomNavSourceUrl, "utf8"),
    readFile(bottomNavStylesUrl, "utf8"),
    readFile(mainSourceUrl, "utf8"),
  ]);
  assert.match(source, /useMemoriesState/);
  assert.match(source, /onClick=\{openUpload\}/);
  assert.match(source, /selectCollection\(item\.id\)/);
  assert.doesNotMatch(source, /document\.|MutationObserver|\.click\(\)/);
  assert.match(styles, /\.bottom-collection-nav\s*{[^}]*position: fixed;/s);
  assert.match(mainSource, /<MemoriesStateProvider>/);
  assert.match(mainSource, /<BottomCollectionNav \/>/);
});

test("collection and process changes scroll through owned React refs", async () => {
  const source = await readFile(appSourceUrl, "utf8");
  assert.match(source, /galleryRef\.current/);
  assert.match(source, /processSectionRef\.current/);
  assert.match(
    source,
    /window\.scrollTo\(\{ top: Math\.max\(0, top\), behavior: "smooth" \}\)/,
  );
});

test("filter changes abort stale initial and load-more photo requests", async () => {
  const source = await readFile(appSourceUrl, "utf8");
  assert.match(source, /photoRequestGenerationRef/);
  assert.match(source, /loadMoreControllerRef\.current\?\.abort\(\)/);
  assert.match(source, /generation !== photoRequestGenerationRef\.current/);
  assert.match(source, /signal: controller\.signal/);
});

test("album closure blocks guest upload controls but preserves admin access", async () => {
  const [appSource, bottomNavSource] = await Promise.all([
    readFile(appSourceUrl, "utf8"),
    readFile(bottomNavSourceUrl, "utf8"),
  ]);
  assert.match(appSource, /!albumOpen && !adminAuthenticated/);
  assert.match(bottomNavSource, /albumOpen/);
  assert.match(
    bottomNavSource,
    /disabled=\{!albumOpen && !adminAuthenticated\}/,
  );
});

test("lightbox receives visible and accessible retry labels", async () => {
  const source = await readFile(appSourceUrl, "utf8");
  assert.match(source, /errorTitle: t\.photoErrorTitle/);
  assert.match(source, /retry: t\.retry/);
});

test("authenticated admin can trash one or multiple selected photos", async () => {
  const [source, styles, bulkStyles, mainSource] = await Promise.all([
    readFile(appSourceUrl, "utf8"),
    readFile(stylesUrl, "utf8"),
    readFile(bulkPhotoStylesUrl, "utf8"),
    readFile(mainSourceUrl, "utf8"),
  ]);
  assert.match(source, /adminAuthenticated &&/);
  assert.match(source, /\/Memories\/api\/admin\/photos\//);
  assert.match(source, /method: "DELETE"/);
  assert.match(source, /selectedAdminPhotoIds/);
  assert.match(source, /全選已載入照片/);
  assert.match(source, /移至垃圾桶/);
  assert.match(styles, /\.admin-delete-photo\s*{/);
  assert.match(bulkStyles, /\.admin-photo-selector\s*{/);
  assert.match(
    bulkStyles,
    /\.admin-photo-bulk-toolbar\s*{[^}]*position: fixed;/s,
  );
  assert.match(
    bulkStyles,
    /\.admin-photo-bulk-toolbar button\s*{[^}]*min-height: 2\.75rem;/s,
  );
  assert.match(mainSource, /import "\.\/bulk-photo-admin\.css"/);
  assert.doesNotMatch(source, /sessionStorage/);
  assert.doesNotMatch(mainSource, /GalleryEnhancements/);
});

test("process hydration updates state without remounting the app", async () => {
  const [stateSource, mainSource] = await Promise.all([
    readFile(stateSourceUrl, "utf8"),
    readFile(mainSourceUrl, "utf8"),
  ]);
  assert.match(stateSource, /request\("\/Memories\/api\/processes"\)/);
  assert.match(stateSource, /dispatch\(\{ type: "processes"/);
  assert.match(mainSource, /<App \/>/);
  assert.doesNotMatch(mainSource, /<App key=/);
});

test("cross-component DOM mutation bridges are removed", async () => {
  const sources = await Promise.all([
    readFile(appSourceUrl, "utf8"),
    readFile(adminSourceUrl, "utf8"),
    readFile(bottomNavSourceUrl, "utf8"),
    readFile(mainSourceUrl, "utf8"),
  ]);
  const combined = sources.join("\n");
  assert.doesNotMatch(combined, /MutationObserver|CustomEvent|\.click\(\)/);
  assert.doesNotMatch(combined, /querySelector(All)?\(/);
});
